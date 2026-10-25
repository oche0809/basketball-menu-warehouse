import data from '../data/referenceVideos.json'
import type { MenuVideo, PracticeMenu } from '../types/menu'

// 公式メニューの参考動画（src/data/referenceVideos.json。メニューの id ごと）。
// 動きが似ている外部の解説動画で、メニューの内容と完全に同じとは限らない
export type ReferenceVideo = MenuVideo

const VIDEOS = (data as { videos?: Record<string, ReferenceVideo[]> }).videos ?? {}

export const getReferenceVideos = (menuId: string): ReferenceVideo[] => VIDEOS[menuId] ?? []

export const MAX_VIDEOS = 10

export const isWebUrl = (url: string) => /^https?:\/\/\S+$/i.test(url.trim())

// 外から来た動画データ（保存データ・バックアップ・生徒用リンク）を確かめる。形が正しいものだけ残す
export function normalizeVideos(v: unknown): MenuVideo[] | null {
  if (!Array.isArray(v)) return null
  const list: MenuVideo[] = []
  for (const x of v.slice(0, MAX_VIDEOS)) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
    if (!o || typeof o.url !== 'string' || !isWebUrl(o.url)) continue
    const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : o.url.trim()
    const channel = typeof o.channel === 'string' && o.channel.trim() ? o.channel.trim() : undefined
    list.push({ title, url: o.url.trim(), ...(channel && { channel }) })
  }
  return list
}

// 表示に使う参考動画。先生が編集した動画（personal）があればそれを、なければ公式（official）
export function getMenuVideos(menu: PracticeMenu): { videos: MenuVideo[]; source: 'personal' | 'official' } {
  const personal = normalizeVideos(menu.videos)
  return personal ? { videos: personal, source: 'personal' } : { videos: getReferenceVideos(menu.id), source: 'official' }
}

export const hasVideos = (menu: PracticeMenu) => getMenuVideos(menu).videos.length > 0

// YouTube の URL から動画 ID を取り出す（埋め込み再生とサムネイル表示に使う）
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/(?:shorts|embed|live)\/)([\w-]{11})/)
  return m ? m[1] : null
}

// YouTube の動画タイトルとチャンネル名を取得する（YouTube の公開API。取得できなければ null）
export async function fetchYoutubeInfo(url: string): Promise<{ title: string; channel: string } | null> {
  const id = youtubeId(url)
  if (!id) return null
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
    if (!res.ok) return null
    const o = (await res.json()) as { title?: unknown; author_name?: unknown }
    return typeof o.title === 'string' ? { title: o.title, channel: typeof o.author_name === 'string' ? o.author_name : '' } : null
  } catch {
    return null
  }
}
