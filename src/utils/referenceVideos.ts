import data from '../data/referenceVideos.json'

// 公式メニューの参考動画（src/data/referenceVideos.json。メニューの id ごと）。
// 動きが似ている外部の解説動画で、メニューの内容と完全に同じとは限らない
export type ReferenceVideo = { title: string; channel: string; url: string }

const VIDEOS = (data as { videos?: Record<string, ReferenceVideo[]> }).videos ?? {}

export const getReferenceVideos = (menuId: string): ReferenceVideo[] => VIDEOS[menuId] ?? []

// YouTube の URL から動画 ID を取り出す（埋め込み再生とサムネイル表示に使う）
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/)
  return m ? m[1] : null
}
