import { useLayoutEffect, useState } from 'react'
import type { PracticeMenu, PracticePlan, SavedPlan, SavedPlanItem } from '../types/menu'
import { ALL, inRange, normalizeForSearch, toWords, type Range } from './filters'
import { normalizePlan, today } from './plan'
import { loadJSON, newId, saveJSON } from './storage'

const SAVED_KEY = 'basketball-menu-warehouse-saved-plans'

const isText = (v: unknown): v is string => typeof v === 'string'

export function normalizeSaved(v: unknown): SavedPlan | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  const plan = normalizePlan(o)
  const rawItems = (Array.isArray(o.items) ? o.items : []) as Record<string, unknown>[]
  // 保存時点のメニュー情報（Phase 4 以前のデータにはないので、あれば残す）
  const items: SavedPlanItem[] = plan.items.map((item) => {
    const raw = rawItems.find((r) => r?.id === item.id) ?? {}
    return {
      ...item,
      ...(isText(raw.title) && { title: raw.title }),
      ...(isText(raw.category) && { category: raw.category }),
      ...(Array.isArray(raw.tags) && { tags: raw.tags.filter(isText) }),
    }
  })
  return { ...plan, items, id: o.id, savedAt: isText(o.savedAt) ? o.savedAt : '', favorite: o.favorite === true }
}

// 保存時点のスナップショット。以後、現在の計画を変えても保存済みは変わらない
export function snapshotPlan(plan: PracticePlan, menus: PracticeMenu[]): SavedPlan {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const copy = structuredClone(plan)
  const items = copy.items.map((i) => {
    const m = menuMap.get(i.menuId)
    return m ? { ...i, title: m.title, category: m.category, tags: [...m.tags] } : i
  })
  return { ...copy, items, id: newId(), savedAt: new Date().toISOString(), favorite: false }
}

// 再利用：練習日は今日、振り返りは引き継がない。メモ・次回改善メモは引き継ぐ
// 倉庫から削除されたメニューは現在の計画には入れない（保存済み側はそのまま）
export function planFromSaved(saved: SavedPlan, menuIds: Set<string>): PracticePlan {
  return {
    title: saved.title,
    date: today(),
    target: saved.target,
    players: saved.players,
    plannedDuration: saved.plannedDuration,
    reflection: '',
    items: saved.items
      .filter((i) => menuIds.has(i.menuId))
      .map((i) => ({ id: newId(), menuId: i.menuId, duration: i.duration, note: i.note ?? '', nextNote: i.nextNote ?? '' })),
  }
}

export const planTotal = (plan: SavedPlan) => plan.items.reduce((sum, i) => sum + i.duration, 0)

export const SAVED_DURATION_RANGES: Range[] = [
  { label: '30分以内', min: 0, max: 30 },
  { label: '31〜60分', min: 31, max: 60 },
  { label: '61〜90分', min: 61, max: 90 },
  { label: '91〜120分', min: 91, max: 120 },
  { label: '121分以上', min: 121, max: Infinity },
]

export const SAVED_COUNT_RANGES: Range[] = [
  { label: '1〜3個', min: 1, max: 3 },
  { label: '4〜6個', min: 4, max: 6 },
  { label: '7〜10個', min: 7, max: 10 },
  { label: '11個以上', min: 11, max: Infinity },
]

export type SavedFilter = { query: string; target: string; duration: string; count: string; favoritesOnly: boolean }

export const EMPTY_SAVED_FILTER: SavedFilter = { query: '', target: ALL, duration: ALL, count: ALL, favoritesOnly: false }

// 保存済み計画に残っている情報で検索する（保存時の情報がない古いデータだけ、現在の倉庫の情報で補う）
function searchText(plan: SavedPlan, menuMap: Map<string, PracticeMenu>) {
  const parts = [plan.title, plan.target, plan.reflection ?? '']
  for (const i of plan.items) {
    const m = menuMap.get(i.menuId)
    parts.push(i.title ?? m?.title ?? '', i.category ?? m?.category ?? '', ...(i.tags ?? m?.tags ?? []), i.note ?? '', i.nextNote ?? '')
  }
  return normalizeForSearch(parts.join('\n'))
}

export function filterSavedPlans(plans: SavedPlan[], menus: PracticeMenu[], f: SavedFilter) {
  const words = toWords(f.query)
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  return plans.filter((p) => {
    if (f.favoritesOnly && !p.favorite) return false
    if (f.target !== ALL && p.target !== f.target) return false
    if (f.duration !== ALL && !inRange(f.duration, SAVED_DURATION_RANGES, planTotal(p))) return false
    if (f.count !== ALL && !inRange(f.count, SAVED_COUNT_RANGES, p.items.length)) return false
    if (words.length === 0) return true
    const text = searchText(p, menuMap)
    return words.every((w) => text.includes(w))
  })
}

function loadSaved(): SavedPlan[] {
  const data = loadJSON(SAVED_KEY)
  return Array.isArray(data) ? data.map(normalizeSaved).filter((p): p is SavedPlan => p !== null) : []
}

export function useSavedPlans() {
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(loadSaved)

  useLayoutEffect(() => saveJSON(SAVED_KEY, savedPlans), [savedPlans])

  const savePlan = (plan: PracticePlan, menus: PracticeMenu[]) => setSavedPlans((prev) => [...prev, snapshotPlan(plan, menus)])

  const deleteSaved = (id: string) => setSavedPlans((prev) => prev.filter((p) => p.id !== id))

  const toggleSavedFavorite = (id: string) => setSavedPlans((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)))

  const replaceSaved = (list: SavedPlan[]) => setSavedPlans(list)

  return {
    savedPlans: [...savedPlans].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    savePlan,
    deleteSaved,
    toggleSavedFavorite,
    replaceSaved,
  }
}
