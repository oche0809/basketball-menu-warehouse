import { DIFFICULTIES } from '../data/options'
import type { PracticeMenu } from '../types/menu'

export const ALL = 'すべて'

export type Range = { label: string; min: number; max: number }

export const PLAYER_RANGES: Range[] = [
  { label: '1〜2人', min: 1, max: 2 },
  { label: '3〜5人', min: 3, max: 5 },
  { label: '6〜9人', min: 6, max: 9 },
  { label: '10人以上', min: 10, max: Infinity },
]

export const DURATION_RANGES: Range[] = [
  { label: '5分以内', min: 0, max: 5 },
  { label: '6〜10分', min: 6, max: 10 },
  { label: '11〜20分', min: 11, max: 20 },
  { label: '21〜30分', min: 21, max: 30 },
  { label: '31分以上', min: 31, max: Infinity },
]

export type Conditions = {
  players: string
  duration: string
  difficulty: string
  targetLevel: string
  equipment: string
  // 選んだタグをすべて持つメニューだけ（AND）
  tags: string[]
}

export const EMPTY_CONDITIONS: Conditions = {
  players: ALL,
  duration: ALL,
  difficulty: ALL,
  targetLevel: ALL,
  equipment: ALL,
  tags: [],
}

// 人数は自由記述（例：「2人1組」「2〜3人1組」「全員（4〜5列）」）なので、最初の「N人」「N〜M人」を読み取る
function parsePlayers(text: string): [number, number] | null {
  const s = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const m = s.match(/(\d+)\s*(?:[〜～~\-－]\s*(\d+))?\s*人/)
  if (m) return [Number(m[1]), Number(m[2] ?? m[1])]
  if (s.includes('全員')) return [10, Infinity]
  return null
}

// 「ボール（1人1個）」と「ボール」を同じ道具として扱う
export const equipmentName = (e: string) => e.replace(/[（(].*$/, '').trim()

export function inRange(label: string, ranges: Range[], min: number, max = min) {
  const r = ranges.find((x) => x.label === label)
  return !r || (min <= r.max && max >= r.min)
}

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))

export function buildOptions(menus: PracticeMenu[]) {
  return {
    difficulty: DIFFICULTIES,
    targetLevel: uniq(menus.map((m) => m.targetLevel)),
    equipment: uniq(menus.flatMap((m) => m.equipment.map(equipmentName))),
    tag: uniq(menus.flatMap((m) => m.tags)),
  }
}

// 全角・半角や大文字・小文字の違いを吸収して比較する
export const normalizeForSearch = (s: string) => s.normalize('NFKC').toLowerCase()

// スペース（全角も含む）区切りのキーワード。すべて含むものだけ一致（AND）
export const toWords = (query: string) => normalizeForSearch(query).trim().split(/\s+/).filter(Boolean)

function matchesKeyword(menu: PracticeMenu, words: string[]) {
  const text = normalizeForSearch([menu.title, menu.purpose, menu.setup, menu.instructions, ...menu.tags, ...menu.coachingPoints].join('\n'))
  return words.every((w) => text.includes(w))
}

function matchesConditions(m: PracticeMenu, c: Conditions) {
  if (c.players !== ALL) {
    const p = parsePlayers(m.players)
    if (!p || !inRange(c.players, PLAYER_RANGES, p[0], p[1])) return false
  }
  return (
    (c.duration === ALL || inRange(c.duration, DURATION_RANGES, m.duration)) &&
    (c.difficulty === ALL || m.difficulty === c.difficulty) &&
    (c.targetLevel === ALL || m.targetLevel === c.targetLevel) &&
    (c.equipment === ALL || m.equipment.some((e) => equipmentName(e) === c.equipment)) &&
    c.tags.every((t) => m.tags.includes(t))
  )
}

export function filterMenus(menus: PracticeMenu[], query: string, category: string, conditions: Conditions) {
  const words = toWords(query)
  return menus
    .filter((m) => (category === ALL || m.category === category) && matchesKeyword(m, words) && matchesConditions(m, conditions))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
