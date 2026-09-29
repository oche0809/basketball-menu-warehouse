import { useEffect, useState } from 'react'
import { BUILTIN_ANIMATIONS } from '../data/menuAnimations'
import officialData from '../data/officialAnimations.json'
import { createLibraryMenus } from '../data/libraryMenus'
import { createLibraryMenus2 } from '../data/libraryMenus2'
import { createSampleMenus } from '../data/sampleMenus'
import type { MenuAnimation } from '../types/menu'
import { OFFICIAL_ANIMATIONS, validateAnimation } from './animation'
import { loadJSON, saveJSON } from './storage'

// 公式アニメーションのファイル形式（GitHubの src/data/officialAnimations.json と同じ）
export const OFFICIAL_FORMAT = 'basketball-menu-warehouse/official-animations'
export const OFFICIAL_FILE_NAME = 'officialAnimations.json'

// 公式メニュー（アプリに入っているメニュー）のID。先生が自分で追加したメニューは、ほかの人の倉庫にはないので公式にできない
export const OFFICIAL_MENU_IDS = new Set([...createSampleMenus(), ...createLibraryMenus(), ...createLibraryMenus2()].map((m) => m.id))

// 公式として採用できるか：公式メニューで、公式・アプリ内蔵の動きがまだないこと（内蔵の8件は置き換えない）
export function officialAdoptError(id: string): string | null {
  if (!OFFICIAL_MENU_IDS.has(id)) return '自分で追加したメニューは公式にできません（ほかの人の倉庫にはないため）。'
  if (BUILTIN_ANIMATIONS[id]) return 'アプリ内蔵の動きがあるメニューです（置き換えません）。'
  if (OFFICIAL_ANIMATIONS[id]) return 'すでに公式の動きがあります（置き換えません）。'
  return null
}

// ---- 採用待ち（このブラウザだけに保存。書き出してGitHubに入れるまでは公式ではない） ----

const DRAFT_KEY = 'basketball-menu-warehouse-official-draft'
export type OfficialDraft = Record<string, MenuAnimation>

function loadDraft(): OfficialDraft {
  const data = loadJSON(DRAFT_KEY)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const draft: OfficialDraft = {}
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    // GitHubに反映されて公式になったもの（公開済み）は、採用待ちから外す
    if (OFFICIAL_ANIMATIONS[id]) continue
    const { animation } = validateAnimation(value)
    if (animation && !officialAdoptError(id)) draft[id] = animation
  }
  return draft
}

export function useOfficialDraft() {
  const [draft, setDraft] = useState<OfficialDraft>(loadDraft)
  useEffect(() => saveJSON(DRAFT_KEY, draft), [draft])
  // 採用できるものだけ入れ、入れた件数を返す
  const adopt = (items: { id: string; animation: MenuAnimation }[]) => {
    const ok = items.filter(({ id }) => !officialAdoptError(id))
    setDraft((d) => ({ ...d, ...Object.fromEntries(ok.map(({ id, animation }) => [id, animation])) }))
    return ok.length
  }
  const remove = (id: string) =>
    setDraft((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })
  return { draft, adopt, remove }
}

// ---- 書き出し・読み込み ----

// 今の公式データ（ファイルのまま。チェックに通らない項目も消さずに残す）に採用待ちを加えた、GitHubに入れるファイルの中身
function mergeOfficial(draft: OfficialDraft): Record<string, unknown> {
  const current = (officialData as { animations?: Record<string, unknown> }).animations ?? {}
  return { ...current, ...draft }
}

// 書き出すファイルに入る件数
export const officialFileCount = (draft: OfficialDraft) => Object.keys(mergeOfficial(draft)).length

export function buildOfficialFile(draft: OfficialDraft): string {
  const merged = mergeOfficial(draft)
  const animations = Object.fromEntries(
    Object.keys(merged)
      .sort()
      .map((id) => [id, merged[id]]),
  )
  return JSON.stringify({ format: OFFICIAL_FORMAT, version: 1, animations }, null, 2) + '\n'
}

export function downloadOfficialFile(draft: OfficialDraft) {
  const url = URL.createObjectURL(new Blob([buildOfficialFile(draft)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = OFFICIAL_FILE_NAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type OfficialFileResult = {
  fatal?: string
  // 採用待ちに入れられるもの
  items: { id: string; animation: MenuAnimation }[]
  // すでに公式として公開済み（同じ内容）
  published: string[]
  errors: { id: string; messages: string[] }[]
}

// 書き出した公式データファイルを読み込み、1件ずつ確かめる（ユーザーのバックアップとは別物）
export function parseOfficialFile(text: string): OfficialFileResult {
  const empty = { items: [], published: [], errors: [] }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ...empty, fatal: 'JSONファイルとして読み込めませんでした。' }
  }
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  if (!o || o.format !== OFFICIAL_FORMAT || !o.animations || typeof o.animations !== 'object' || Array.isArray(o.animations)) {
    return { ...empty, fatal: '公式アニメーションのファイルではありません（メニューのバックアップファイルは「データ」メニューから読み込んでください）。' }
  }
  const result: OfficialFileResult = { items: [], published: [], errors: [] }
  for (const [id, value] of Object.entries(o.animations as Record<string, unknown>)) {
    const { animation, errors } = validateAnimation(value)
    if (!animation) {
      result.errors.push({ id, messages: errors })
      continue
    }
    if (OFFICIAL_ANIMATIONS[id] && JSON.stringify(OFFICIAL_ANIMATIONS[id]) === JSON.stringify(animation)) {
      result.published.push(id)
      continue
    }
    const error = officialAdoptError(id)
    if (error) result.errors.push({ id, messages: [error] })
    else result.items.push({ id, animation })
  }
  return result
}
