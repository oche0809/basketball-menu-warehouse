import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { PracticeMenu, PracticePlan, PracticePlanItem } from '../types/menu'
import { loadJSON, newId, saveJSON } from './storage'

const PLAN_KEY = 'basketball-menu-warehouse-practice-plan'
const MIN_DURATION = 5

export const PLAN_TARGETS = ['全学年', '1年生', '2年生', '3年生', '1・2年生', '2・3年生', 'その他']

export function today() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function isPlanItem(v: unknown): v is PracticePlanItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.menuId === 'string' && typeof o.duration === 'number' && Number.isFinite(o.duration)
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)
const text = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

// Phase 1 の保存形式（項目の配列だけ）も受け付け、足りない情報は初期値で補う
export function normalizePlan(data: unknown): PracticePlan {
  const o = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>
  const items = Array.isArray(data) ? data : Array.isArray(o.items) ? o.items : []
  return {
    title: text(o.title, '今日の練習'),
    date: text(o.date, today()),
    target: text(o.target, PLAN_TARGETS[0]),
    players: num(o.players, 0),
    plannedDuration: Math.max(MIN_DURATION, num(o.plannedDuration, 120)),
    reflection: text(o.reflection, ''),
    items: items.filter(isPlanItem).map((i) => ({ ...i, duration: Math.max(MIN_DURATION, i.duration), note: typeof i.note === 'string' ? i.note : '', nextNote: typeof i.nextNote === 'string' ? i.nextNote : '' })),
  }
}

export function usePracticePlan(menus: PracticeMenu[]) {
  const [plan, setPlan] = useState<PracticePlan>(() => normalizePlan(loadJSON(PLAN_KEY)))

  const planRef = useRef(plan)

  useLayoutEffect(() => {
    planRef.current = plan
    saveJSON(PLAN_KEY, plan)
  }, [plan])

  // 最新の計画（入力確定の直後でも最新）を返す
  const getPlan = () => planRef.current

  // 再読み込み・タブを閉じる直前に、入力中の欄を確定させて保存する
  useEffect(() => {
    const flush = () => {
      const el = document.activeElement
      if (el instanceof HTMLElement && el !== document.body) flushSync(() => el.blur())
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  const setItems = (fn: (items: PracticePlanItem[]) => PracticePlanItem[]) =>
    setPlan((p) => {
      const items = fn(p.items)
      return items === p.items ? p : { ...p, items }
    })

  // メニュー倉庫で削除されたメニューは計画から外す
  useEffect(() => {
    const ids = new Set(menus.map((m) => m.id))
    setItems((prev) => (prev.every((i) => ids.has(i.menuId)) ? prev : prev.filter((i) => ids.has(i.menuId))))
  }, [menus])

  const addItem = (menu: PracticeMenu) => {
    setItems((prev) => [...prev, { id: newId(), menuId: menu.id, duration: Math.max(MIN_DURATION, menu.duration), note: '', nextNote: '' }])
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === id)
      const to = from + dir
      if (from < 0 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  const changeDuration = (id: string, delta: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, duration: Math.max(MIN_DURATION, i.duration + delta) } : i)))
  }

  const changeNote = (id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)))
  }

  const changeNextNote = (id: string, nextNote: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, nextNote } : i)))
  }

  const updateInfo = (patch: Partial<Omit<PracticePlan, 'items'>>) => setPlan((p) => ({ ...p, ...patch }))

  const clearPlan = () => setItems(() => [])

  const replacePlan = (next: PracticePlan) => setPlan(next)

  return { plan, getPlan, items: plan.items, addItem, removeItem, moveItem, changeDuration, changeNote, changeNextNote, updateInfo, clearPlan, replacePlan }
}

export type PlanActions = ReturnType<typeof usePracticePlan>
