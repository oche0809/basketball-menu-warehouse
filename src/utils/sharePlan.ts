import type { PracticeMenu, PracticePlan, SavedPlan } from '../types/menu'
import { normalizePlan } from './plan'
import { snapshotPlan } from './savedPlans'
import { newId } from './storage'

// 練習計画の共有（生徒 → 先生など）。共有用テキストは、人が読める一覧と、アプリに取り込むためのコードの2つでできている。
// コードは計画の中身（menuId・時間・メモ）を JSON にして Base64 にしたもの。通信は一切しない（コピー＆貼り付けで渡す）
const CODE_START = 'BMW-PLAN:'
const CODE_END = ':END'
const MAX_ITEMS = 100
const MAX_TEXT = 1000

type SharedItem = { m: string; d: number; n?: string; x?: string; t?: string }
type SharedPayload = { v: 1; title: string; date: string; target: string; players: number; plannedDuration: number; items: SharedItem[] }

const clip = (s: unknown, max = MAX_TEXT) => (typeof s === 'string' ? s.slice(0, max) : '')

// 日本語を含む文字列を Base64 にする（btoa は ASCII しか扱えないため、いったん UTF-8 のバイト列にする）
function encodeBase64(text: string) {
  let binary = ''
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b)
  return btoa(binary)
}

function decodeBase64(code: string) {
  const binary = atob(code)
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

const formatDateText = (date: string) => {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : date
}

// 共有用テキストを作る。今の練習計画・保存済み計画のどちらでも使える
export function buildShareText(plan: PracticePlan | SavedPlan, menus: PracticeMenu[]): string {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const items = plan.items.map((i) => {
    const menu = menuMap.get(i.menuId)
    const title = menu?.title ?? ('title' in i && typeof i.title === 'string' ? i.title : '（メニュー名なし）')
    return { item: i, title, category: menu?.category ?? '' }
  })
  const total = plan.items.reduce((sum, i) => sum + i.duration, 0)
  const payload: SharedPayload = {
    v: 1,
    title: plan.title,
    date: plan.date,
    target: plan.target,
    players: plan.players,
    plannedDuration: plan.plannedDuration,
    items: items.map(({ item, title }) => ({
      m: item.menuId,
      d: item.duration,
      ...(item.note && { n: item.note }),
      ...(item.nextNote && { x: item.nextNote }),
      t: title,
    })),
  }
  const lines = [
    `🏀 練習計画「${plan.title || '今日の練習'}」`,
    [`練習日：${formatDateText(plan.date)}`, `対象：${plan.target}`, plan.players > 0 && `人数：${plan.players}人`, `予定：${plan.plannedDuration}分`, `合計：${total}分`]
      .filter(Boolean)
      .join(' / '),
    '',
    ...items.flatMap(({ item, title, category }, i) => [
      `${i + 1}. ${title}${category ? `（${category}）` : ''} … ${item.duration}分`,
      ...(item.note ? [`   メモ：${item.note.replace(/\n/g, ' ')}`] : []),
    ]),
    '',
    '▼ 先生のアプリに取り込むためのコード（ここから下も全部いっしょに送ってください）',
    `${CODE_START}${encodeBase64(JSON.stringify(payload))}${CODE_END}`,
  ]
  return lines.join('\n')
}

// 共有用テキストを読み取り、保存済み計画として取り込める形にする。
// 今のメニュー倉庫にないメニューは取り込まず、名前を missing で知らせる
export function parseShareText(text: string, menus: PracticeMenu[]): { saved: SavedPlan; missing: string[] } {
  const start = text.indexOf(CODE_START)
  const end = start >= 0 ? text.indexOf(CODE_END, start + CODE_START.length) : -1
  if (start < 0 || end < 0) {
    throw new Error('取り込み用のコード（BMW-PLAN: で始まる部分）が見つかりませんでした。共有用テキストを最後まで全部貼り付けてください。')
  }
  // LINE などで途中に改行や空白が入っても読めるように、空白は取り除く
  const code = text.slice(start + CODE_START.length, end).replace(/\s+/g, '')
  let raw: unknown
  try {
    raw = JSON.parse(decodeBase64(code))
  } catch {
    throw new Error('取り込み用のコードが途中で切れているか、こわれています。もう一度、共有用テキストを全部コピーしてもらってください。')
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (o.v !== 1 || !Array.isArray(o.items)) throw new Error('この取り込み用のコードには対応していません。アプリを最新にしてから、もう一度お試しください。')

  const ids = new Set(menus.map((m) => m.id))
  const missing: string[] = []
  const items = []
  for (const v of (o.items as unknown[]).slice(0, MAX_ITEMS)) {
    const i = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    if (typeof i.m !== 'string' || typeof i.d !== 'number' || !Number.isFinite(i.d)) continue
    if (!ids.has(i.m)) {
      missing.push(clip(i.t, 80) || i.m)
      continue
    }
    items.push({ id: newId(), menuId: i.m, duration: Math.min(120, Math.max(5, Math.round(i.d))), note: clip(i.n), nextNote: clip(i.x) })
  }
  if (items.length === 0) throw new Error('取り込めるメニューがありませんでした（このアプリのメニュー倉庫にないメニューだけでした）。')

  const plan = normalizePlan({
    title: clip(o.title, 100) || '共有された練習計画',
    date: typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : undefined,
    target: clip(o.target, 50) || undefined,
    players: typeof o.players === 'number' ? Math.min(999, Math.max(0, Math.round(o.players))) : 0,
    plannedDuration: typeof o.plannedDuration === 'number' ? Math.min(600, Math.max(5, Math.round(o.plannedDuration))) : undefined,
    reflection: '',
    items,
  })
  return { saved: snapshotPlan(plan, menus), missing }
}
