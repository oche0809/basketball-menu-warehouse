import { useState, type ReactNode } from 'react'
import type { MenuVideo } from '../types/menu'
import { MAX_VIDEOS, fetchYoutubeInfo, isWebUrl, youtubeId } from '../utils/referenceVideos'

const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-bold'

// 参考動画1本。最初はサムネイルだけを出し、押したときだけ YouTube を読み込む（通信量を抑える）
export function VideoItem({ video }: { video: MenuVideo }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(video.url)
  return (
    <li className="space-y-2">
      {id &&
        (playing ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={video.title}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-slate-200"
            aria-label={`「${video.title}」をここで再生`}
          >
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30">
              <span className="rounded-full bg-red-600 px-5 py-2 text-lg font-bold text-white shadow">▶ 再生</span>
            </span>
          </button>
        ))}
      <p className="font-bold break-words">{video.title}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{video.channel}</p>
        <a href={video.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass} border-orange-300 bg-white text-orange-700 hover:bg-orange-50`}>
          {id ? 'YouTubeで開く' : 'サイトを開く'} ↗
        </a>
      </div>
    </li>
  )
}

export const VIDEO_NOTE = '似た練習やコツを解説している動画です。メニューの内容と完全に同じとは限りません。'

export function VideoList({ videos }: { videos: MenuVideo[] }) {
  return (
    <ul className="space-y-5">
      {videos.map((v) => <VideoItem key={v.url} video={v} />)}
    </ul>
  )
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <p className="min-w-0 truncate font-bold">{label}</p>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-2 font-bold whitespace-nowrap text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

// 練習中などに参考動画だけを見る
export function VideosDialog({ title, videos, onClose }: { title: string; videos: MenuVideo[]; onClose: () => void }) {
  return (
    <Modal label={`📺 参考動画：${title}`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">{VIDEO_NOTE}</p>
      <VideoList videos={videos} />
    </Modal>
  )
}

type EditorProps = {
  initial: MenuVideo[]
  // 先生が編集した動画を使っているか（「公式に戻す」を出すかどうか）
  personal: boolean
  hasOfficial: boolean
  onSave: (videos: MenuVideo[] | undefined) => void
  onClose: () => void
}

// 参考動画の追加・削除・差し替え。保存すると、このメニューでは公式の参考動画の代わりにこの一覧を使う
export function VideoEditorDialog({ initial, personal, hasOfficial, onSave, onClose }: EditorProps) {
  const [list, setList] = useState<MenuVideo[]>(initial)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    const u = url.trim()
    setError('')
    if (!isWebUrl(u)) return setError('「https://」から始まるURLを入れてください。')
    if (list.some((v) => v.url === u)) return setError('この動画はすでに入っています。')
    if (list.length >= MAX_VIDEOS) return setError(`動画は${MAX_VIDEOS}本までです。`)
    let video: MenuVideo = { url: u, title: title.trim() || u }
    if (youtubeId(u) && !title.trim()) {
      setBusy(true)
      const info = await fetchYoutubeInfo(u)
      setBusy(false)
      if (!info) return setError('YouTubeの動画が見つかりませんでした（非公開・削除済みの可能性）。URLを確かめるか、タイトルを入れて追加してください。')
      video = { url: u, title: info.title, ...(info.channel && { channel: info.channel }) }
    }
    setList((l) => [...l, video])
    setUrl('')
    setTitle('')
  }

  const move = (i: number, d: number) =>
    setList((l) => {
      const next = [...l]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      return next
    })

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200'

  return (
    <Modal label="📺 参考動画を編集" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          保存すると、このメニューではここに並べた動画が表示されます（このブラウザだけ・バックアップにも入ります）。
        </p>

        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">動画はありません。</p>
        ) : (
          <ol className="space-y-2">
            {list.map((v, i) => (
              <li key={v.url} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                {youtubeId(v.url) ? (
                  <img src={`https://i.ytimg.com/vi/${youtubeId(v.url)}/mqdefault.jpg`} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                ) : (
                  <span className="grid h-12 w-20 shrink-0 place-items-center rounded bg-slate-100 text-xl">🔗</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-bold break-words">{v.title}</p>
                  {v.channel && <p className="truncate text-xs text-slate-500">{v.channel}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ" className="h-9 w-9 rounded border border-slate-300 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="下へ" className="h-9 w-9 rounded border border-slate-300 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => setList((l) => l.filter((_, k) => k !== i))} aria-label={`「${v.title}」を外す`} className="h-9 rounded border border-rose-300 px-2 text-sm font-bold text-rose-600">
                    外す
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
          <p className="font-bold">＋ 動画を追加</p>
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="動画のURL（YouTube など）" aria-label="動画のURL" className={inputClass} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（YouTubeなら空欄で自動取得）" aria-label="タイトル" className={inputClass} />
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
          <button type="button" onClick={add} disabled={busy || !url.trim()} className={`${buttonClass} w-full border-orange-300 bg-white text-orange-700 hover:bg-orange-50 disabled:opacity-40`}>
            {busy ? '動画を確認中…' : '一覧に追加'}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => onSave(list)} className={`${buttonClass} border-orange-600 bg-orange-600 text-white hover:bg-orange-700 sm:flex-1`}>
            保存する
          </button>
          {personal && (
            <button type="button" onClick={() => onSave(undefined)} className={`${buttonClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
              {hasOfficial ? '公式の動画に戻す' : '編集をやめて元に戻す'}
            </button>
          )}
          <button type="button" onClick={onClose} className={`${buttonClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            キャンセル
          </button>
        </div>
      </div>
    </Modal>
  )
}
