import { createLibraryMenus } from '../data/libraryMenus'
import { createLibraryMenus2 } from '../data/libraryMenus2'
import { createLibraryMenus3 } from '../data/libraryMenus3'
import { createLibraryMenus4 } from '../data/libraryMenus4'
import { createLibraryMenus5 } from '../data/libraryMenus5'
import { createSampleMenus } from '../data/sampleMenus'
import type { MenuAnimation, MenuVideo, PracticeMenu, PracticePlan } from '../types/menu'
import { normalizeAnimation } from './animation'
import { normalizeVideos } from './referenceVideos'

// 生徒用ページ（見るだけ）。練習計画の中身をURLに入れて渡す。サーバーには保存しない。
// 公式メニューは id だけ（生徒の端末のアプリにも同じメニューがある）。先生が作ったメニューや、
// 先生が変えた動き・動画は中身もURLに入れる

// 生徒のページで使う、メニューの見せる部分だけ
export type StudentMenu = {
  title: string
  category: string
  purpose: string
  setup: string
  instructions: string
  coachingPoints: string[]
  animation?: MenuAnimation
  videos?: MenuVideo[]
}

export type StudentItem = { menuId: string; duration: number; note?: string; menu: StudentMenu | null }
export type StudentPlan = { title: string; date: string; items: StudentItem[] }

type PayloadItem = { m: string; d: number; n?: string; c?: Partial<StudentMenu>; a?: MenuAnimation; v?: MenuVideo[] }
export type StudentPayload = { v: 1; t: string; d: string; i: PayloadItem[] }

let officialCache: Map<string, PracticeMenu> | null = null
function officialMenus() {
  officialCache ??= new Map(
    [...createSampleMenus(), ...createLibraryMenus(), ...createLibraryMenus2(), ...createLibraryMenus3(), ...createLibraryMenus4(), ...createLibraryMenus5()].map((m) => [m.id, m]),
  )
  return officialCache
}

const toStudentMenu = (m: PracticeMenu): StudentMenu => ({
  title: m.title,
  category: m.category,
  purpose: m.purpose,
  setup: m.setup,
  instructions: m.instructions,
  coachingPoints: m.coachingPoints,
})

// チームページ（teamBoard.ts）でも同じ形で保存する
export function buildStudentPayload(plan: PracticePlan, menus: PracticeMenu[], withNotes: boolean): StudentPayload {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const official = officialMenus()
  const items = plan.items.flatMap((item): PayloadItem[] => {
    const menu = menuMap.get(item.menuId)
    if (!menu) return []
    const p: PayloadItem = { m: item.menuId, d: item.duration }
    if (withNotes && item.note?.trim()) p.n = item.note.trim()
    if (!official.has(menu.id)) p.c = toStudentMenu(menu)
    const animation = normalizeAnimation(menu.animation)
    if (animation) p.a = animation
    const videos = normalizeVideos(menu.videos)
    if (videos) p.v = videos
    return [p]
  })
  return { v: 1, t: plan.title, d: plan.date, i: items }
}

// Base64URL（URLにそのまま入れられる文字だけ）
function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

// 先頭1文字で形式を表す：z＝圧縮あり、j＝圧縮なし（圧縮が使えない古いブラウザ用）
export async function encodeStudentPlan(plan: PracticePlan, menus: PracticeMenu[], withNotes: boolean) {
  const json = new TextEncoder().encode(JSON.stringify(buildStudentPayload(plan, menus, withNotes)))
  if (typeof CompressionStream === 'function') {
    try {
      return 'z' + toBase64Url(await transform(json, new CompressionStream('deflate-raw')))
    } catch {
      // 下の圧縮なしへ
    }
  }
  return 'j' + toBase64Url(json)
}

export function studentViewUrl(code: string) {
  return `${location.origin}${location.pathname}#/view?d=${code}`
}

const isText = (v: unknown): v is string => typeof v === 'string'
const text = (v: unknown) => (isText(v) ? v : '')

export async function decodeStudentPlan(code: string): Promise<StudentPlan | null> {
  try {
    const bytes = fromBase64Url(code.slice(1))
    const raw = code[0] === 'z' ? await transform(bytes, new DecompressionStream('deflate-raw')) : code[0] === 'j' ? bytes : null
    if (!raw) return null
    return studentPlanFromPayload(JSON.parse(new TextDecoder().decode(raw)))
  } catch {
    return null
  }
}

// 中身を確かめながら、生徒のページで表示する形にする（形が違えば null）
export function studentPlanFromPayload(raw: unknown): StudentPlan | null {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<StudentPayload>
  if (data.v !== 1 || !Array.isArray(data.i)) return null
  const official = officialMenus()
  const items = data.i.slice(0, 100).flatMap((x): StudentItem[] => {
    if (!x || !isText(x.m)) return []
    const base = official.get(x.m)
    const c = x.c && typeof x.c === 'object' ? x.c : null
    let menu: StudentMenu | null = c
      ? {
          title: text(c.title) || '（メニュー名なし）',
          category: text(c.category),
          purpose: text(c.purpose),
          setup: text(c.setup),
          instructions: text(c.instructions),
          coachingPoints: Array.isArray(c.coachingPoints) ? c.coachingPoints.filter(isText) : [],
        }
      : base
        ? toStudentMenu(base)
        : null
    if (menu) {
      const animation = normalizeAnimation(x.a)
      const videos = normalizeVideos(x.v)
      menu = { ...menu, ...(animation && { animation }), ...(videos && { videos }) }
    }
    return [{ menuId: x.m, duration: typeof x.d === 'number' ? x.d : 0, ...(isText(x.n) && x.n && { note: x.n }), menu }]
  })
  return { title: text(data.t), date: text(data.d), items }
}
