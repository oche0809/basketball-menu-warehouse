import type { PracticeMenu, PracticePlan, SavedPlan } from '../types/menu'
import { normalizeAnimation } from './animation'
import { normalizePlan, today } from './plan'
import { normalizeSaved } from './savedPlans'

const APP_ID = 'basketball-menu-warehouse'

const TEXT_KEYS = [
  'id', 'title', 'category', 'difficulty', 'targetLevel', 'players', 'purpose',
  'setup', 'instructions', 'progression', 'regression', 'createdAt', 'updatedAt',
] as const
const LIST_KEYS = ['equipment', 'coachingPoints', 'commonMistakes', 'tags'] as const
// 出典・参考情報（任意）。旧形式のバックアップにはない
const SOURCE_KEYS = ['sourceType', 'sourceTitle', 'sourceUrl', 'sourceNote'] as const

// plan・savedPlans を含まない古いファイルでは null（今の内容をそのまま残す）
export type BackupData = { menus: PracticeMenu[]; plan: PracticePlan | null; savedPlans: SavedPlan[] | null }

export function exportMenus(menus: PracticeMenu[], plan: PracticePlan, savedPlans: SavedPlan[]) {
  const data = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), menus, plan, savedPlans }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${APP_ID}-${today()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const isText = (v: unknown): v is string => typeof v === 'string'

function toMenu(v: unknown): PracticeMenu | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const valid =
    TEXT_KEYS.every((k) => isText(o[k])) &&
    LIST_KEYS.every((k) => Array.isArray(o[k]) && (o[k] as unknown[]).every(isText)) &&
    typeof o.duration === 'number' && Number.isFinite(o.duration) &&
    typeof o.favorite === 'boolean' &&
    (o.title as string).trim() !== ''
  if (!valid) return null
  // 余計な項目は取り込まない
  const menu: Record<string, unknown> = {}
  for (const k of [...TEXT_KEYS, ...LIST_KEYS, 'duration', 'favorite']) menu[k] = o[k]
  for (const k of SOURCE_KEYS) if (isText(o[k]) && o[k]) menu[k] = o[k]
  // 動きのアニメーション（任意）。旧形式にはない・壊れている場合は取り込まない
  const animation = normalizeAnimation(o.animation)
  if (animation) menu.animation = animation
  return menu as PracticeMenu
}

// 書き出したファイル（{ app, menus, plan? }）と、localStorageと同じ配列形式の両方を受け付ける
// 練習計画を含まない古いファイルでは plan は null
export function parseBackup(text: string): BackupData | null {
  try {
    const data = JSON.parse(text)
    const list = Array.isArray(data) ? data : data?.app === APP_ID ? data.menus : null
    if (!Array.isArray(list)) return null
    const menus = list.map(toMenu)
    if (menus.some((m) => m === null)) return null
    const ids = new Set(menus.map((m) => m!.id))
    if (ids.size !== menus.length) return null
    // plan は Phase 1 形式（配列）でも Phase 2 形式（オブジェクト）でも読み込める
    let plan: PracticePlan | null = null
    if (data?.plan && typeof data.plan === 'object') {
      plan = normalizePlan(data.plan)
      plan.items = plan.items.filter((i) => ids.has(i.menuId))
    }
    // 保存済み計画は、倉庫にないメニューを含んでいてもそのまま残す
    const savedPlans = Array.isArray(data?.savedPlans)
      ? (data.savedPlans as unknown[]).map(normalizeSaved).filter((p): p is SavedPlan => p !== null)
      : null
    return { menus: menus as PracticeMenu[], plan, savedPlans }
  } catch {
    return null
  }
}
