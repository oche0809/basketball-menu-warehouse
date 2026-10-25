import { useEffect, useState } from 'react'
import { MenuAnimationDialog } from '../components/MenuAnimationDialog'
import { VIDEO_NOTE, VideoList } from '../components/ReferenceVideos'
import { BUILTIN_ANIMATIONS } from '../data/menuAnimations'
import type { MenuAnimation } from '../types/menu'
import { OFFICIAL_ANIMATIONS } from '../utils/animation'
import { getReferenceVideos } from '../utils/referenceVideos'
import { decodeStudentPlan, type StudentItem, type StudentPlan } from '../utils/studentView'
import { formatDate } from '../utils/format'

function ItemCard({ item, index }: { item: StudentItem; index: number }) {
  const [showAnimation, setShowAnimation] = useState(false)
  const [showVideos, setShowVideos] = useState(false)
  const { menu } = item
  if (!menu) {
    return (
      <li className="rounded-xl border border-slate-200 bg-white p-4 text-slate-500">
        {index + 1}. このメニューは表示できません（アプリを最新にしてからもう一度開いてください）。
      </li>
    )
  }
  const animation: MenuAnimation | null = menu.animation ?? OFFICIAL_ANIMATIONS[item.menuId] ?? BUILTIN_ANIMATIONS[item.menuId] ?? null
  const videos = menu.videos ?? getReferenceVideos(item.menuId)
  return (
    <li className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-orange-700">
            {index + 1}. {menu.category}
          </p>
          <h2 className="text-xl font-bold break-words">{menu.title}</h2>
        </div>
        <p className="shrink-0 text-2xl font-bold text-orange-700">
          {item.duration}
          <span className="text-sm">分</span>
        </p>
      </div>
      {item.note && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-800">📝 先生から</p>
          <p className="mt-1 whitespace-pre-wrap">{item.note}</p>
        </div>
      )}
      {menu.purpose && <p className="leading-relaxed">🎯 {menu.purpose}</p>}
      {(animation || videos.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {animation && (
            <button type="button" onClick={() => setShowAnimation(true)} className="min-h-11 flex-1 rounded-lg border border-sky-300 bg-sky-50 px-4 font-bold text-sky-800 sm:flex-none">
              🎬 動きを見る
            </button>
          )}
          {videos.length > 0 && (
            <button
              type="button"
              aria-expanded={showVideos}
              onClick={() => setShowVideos((v) => !v)}
              className="min-h-11 flex-1 rounded-lg border border-red-300 bg-red-50 px-4 font-bold text-red-800 sm:flex-none"
            >
              📺 参考動画{showVideos ? 'を閉じる' : ''}
            </button>
          )}
        </div>
      )}
      {showVideos && (
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="mb-3 text-xs text-slate-500">{VIDEO_NOTE}</p>
          <VideoList videos={videos} />
        </div>
      )}
      <details className="rounded-lg bg-stone-50 p-3">
        <summary className="cursor-pointer font-bold">やり方・ポイントを見る</summary>
        <div className="mt-3 space-y-3 leading-relaxed">
          {menu.setup && (
            <div>
              <p className="text-sm font-bold text-slate-500">準備・並び方</p>
              <p className="whitespace-pre-wrap">{menu.setup}</p>
            </div>
          )}
          {menu.instructions && (
            <div>
              <p className="text-sm font-bold text-slate-500">やり方</p>
              <p className="whitespace-pre-wrap">{menu.instructions}</p>
            </div>
          )}
          {menu.coachingPoints.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-500">ポイント</p>
              <ul className="list-disc space-y-1 pl-5">
                {menu.coachingPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      </details>
      {showAnimation && animation && <MenuAnimationDialog title={menu.title} animation={animation} onClose={() => setShowAnimation(false)} />}
    </li>
  )
}

// 生徒用ページ（見るだけ）。アプリのメニューやナビは出さない
export function StudentViewPage({ code }: { code: string }) {
  const [plan, setPlan] = useState<StudentPlan | null | 'loading'>('loading')
  useEffect(() => {
    let alive = true
    decodeStudentPlan(code).then((p) => alive && setPlan(p))
    return () => {
      alive = false
    }
  }, [code])

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      <header className="bg-gradient-to-br from-orange-600 to-orange-500 px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-bold text-orange-100">🏀 今日の練習メニュー</p>
          {plan && plan !== 'loading' && (
            <>
              <h1 className="mt-1 text-2xl font-bold break-words">{plan.title || '今日の練習'}</h1>
              <p className="mt-1 text-orange-50">
                {[formatDate(plan.date), `${plan.items.length}メニュー`, `${plan.items.reduce((s, i) => s + i.duration, 0)}分`].filter(Boolean).join('・')}
              </p>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">
        {plan === 'loading' ? (
          <p className="py-16 text-center text-slate-500">読み込み中…</p>
        ) : !plan ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            リンクが正しくないか、途中で切れています。先生からもらったリンクをもう一度開いてください。
          </p>
        ) : (
          <ol className="space-y-4">
            {plan.items.map((item, i) => <ItemCard key={i} item={item} index={i} />)}
          </ol>
        )}
        <p className="mt-8 text-center text-xs text-slate-400">このページは見るだけです。</p>
      </main>
    </div>
  )
}
