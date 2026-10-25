import { useLayoutEffect, useState } from 'react'
import { CATEGORIES } from '../data/options'
import type { PracticeLogEntry, PracticeMenu, PracticePlan, PracticePlanItem } from '../types/menu'
import { today } from './plan'
import { loadJSON, saveJSON } from './storage'

const LOG_KEY = 'basketball-menu-warehouse-practice-log'

const isText = (v: unknown): v is string => typeof v === 'string'

export function normalizeLogEntry(v: unknown): PracticeLogEntry | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (!isText(o.date) || !/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !isText(o.itemId) || !isText(o.menuId)) return null
  return {
    id: `${o.date}:${o.itemId}`,
    date: o.date,
    itemId: o.itemId,
    menuId: o.menuId,
    title: isText(o.title) ? o.title : '',
    category: isText(o.category) ? o.category : 'その他',
    duration: typeof o.duration === 'number' && Number.isFinite(o.duration) ? o.duration : 0,
    planTitle: isText(o.planTitle) ? o.planTitle : '',
    recordedAt: isText(o.recordedAt) ? o.recordedAt : '',
  }
}

export function normalizeLog(v: unknown): PracticeLogEntry[] {
  if (!Array.isArray(v)) return []
  const map = new Map<string, PracticeLogEntry>()
  for (const x of v) {
    const e = normalizeLogEntry(x)
    if (e) map.set(e.id, e)
  }
  return [...map.values()]
}

export function usePracticeLog() {
  const [entries, setEntries] = useState<PracticeLogEntry[]>(() => normalizeLog(loadJSON(LOG_KEY)))

  useLayoutEffect(() => saveJSON(LOG_KEY, entries), [entries])

  // 実施済みにしたときに記録する。練習日は計画の日付（未入力なら今日）
  const record = (plan: PracticePlan, item: PracticePlanItem, menu: PracticeMenu | undefined) => {
    const date = plan.date || today()
    const entry: PracticeLogEntry = {
      id: `${date}:${item.id}`,
      date,
      itemId: item.id,
      menuId: item.menuId,
      title: menu?.title ?? '（削除されたメニュー）',
      category: menu?.category ?? 'その他',
      duration: item.duration,
      planTitle: plan.title,
      recordedAt: new Date().toISOString(),
    }
    setEntries((prev) => [...prev.filter((e) => e.id !== entry.id), entry])
  }

  // 実施済みを取り消したときは、その記録も消す
  const unrecord = (plan: PracticePlan, item: PracticePlanItem) => {
    const id = `${plan.date || today()}:${item.id}`
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id))

  // 後から記録を追加する（保存済み計画からまとめて・手入力）。同じ日の同じ項目は上書き
  const addEntries = (list: Omit<PracticeLogEntry, 'id' | 'recordedAt'>[]) => {
    const recordedAt = new Date().toISOString()
    const added = list.map((e) => ({ ...e, id: `${e.date}:${e.itemId}`, recordedAt }))
    const ids = new Set(added.map((e) => e.id))
    setEntries((prev) => [...prev.filter((e) => !ids.has(e.id)), ...added])
  }

  // 記録の日付・時間を直す（日付を変えると id も変わる）
  const updateEntry = (id: string, patch: { date: string; duration: number }) =>
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id)
      if (!target) return prev
      const next = { ...target, ...patch, id: `${patch.date}:${target.itemId}` }
      return [...prev.filter((e) => e.id !== id && e.id !== next.id), next]
    })

  const replaceLog = (list: PracticeLogEntry[]) => setEntries(list)

  return { entries, record, unrecord, remove, addEntries, updateEntry, replaceLog }
}

export type PracticeLogActions = ReturnType<typeof usePracticeLog>

// 日付（YYYY-MM-DD）の差（日数）
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000)
}

export function daysAgoDate(days: number, base = today()) {
  const d = new Date(Date.parse(base) - days * 86400000)
  return d.toISOString().slice(0, 10)
}

// メニューごとの最後の実施日と回数
export function lastDoneMap(entries: PracticeLogEntry[]) {
  const map = new Map<string, { date: string; count: number }>()
  for (const e of entries) {
    const cur = map.get(e.menuId)
    map.set(e.menuId, { date: cur && cur.date > e.date ? cur.date : e.date, count: (cur?.count ?? 0) + 1 })
  }
  return map
}

// 偏りチェックで「やっていない」と知らせる、練習の中心になるカテゴリ
const CORE_CATEGORIES = ['ドリブル', 'パス', 'シュート', '1on1', 'ディフェンス', 'リバウンド', 'トランジション']

// 期間（days 日以内。null＝すべて）の集計
export function analyzeLog(entries: PracticeLogEntry[], menus: PracticeMenu[], days: number | null, base = today()) {
  const from = days === null ? '' : daysAgoDate(days - 1, base)
  const inRange = entries.filter((e) => e.date >= from && e.date <= base)
  const totalMinutes = inRange.reduce((s, e) => s + e.duration, 0)
  const practiceDays = new Set(inRange.map((e) => e.date)).size

  const byCategory = CATEGORIES.map((category) => {
    const list = inRange.filter((e) => e.category === category)
    return { category, minutes: list.reduce((s, e) => s + e.duration, 0), count: list.length }
  }).filter((c) => c.count > 0)
  byCategory.sort((a, b) => b.minutes - a.minutes)

  const missing = inRange.length > 0 ? CORE_CATEGORIES.filter((c) => !inRange.some((e) => e.category === c)) : []
  // 1つのカテゴリが半分以上を占めているとき
  const dominant = totalMinutes >= 60 ? byCategory.find((c) => c.minutes / totalMinutes >= 0.5) ?? null : null

  // しばらくやっていないお気に入り（30日以上前・または一度もない）
  const last = lastDoneMap(entries)
  const staleFavorites = menus
    .filter((m) => m.favorite)
    .map((m) => ({ menu: m, last: last.get(m.id)?.date ?? null }))
    .filter((x) => x.last === null || daysBetween(x.last, base) >= 30)
    .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))

  return { inRange, totalMinutes, practiceDays, byCategory, missing, dominant, staleFavorites }
}
