import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '../utils/format'
import { today } from '../utils/plan'
import { fetchPublicBoard, splitBoard, type Board, type BoardPlan } from '../utils/teamBoard'
import { ItemCard } from './StudentViewPage'

const summary = (p: BoardPlan) => [`${p.items.length}メニュー`, `${p.items.reduce((s, i) => s + i.duration, 0)}分`].join('・')

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function PlanItems({ plan }: { plan: BoardPlan }) {
  return (
    <ol className="space-y-4">
      {plan.items.map((item, i) => <ItemCard key={i} item={item} index={i} />)}
    </ol>
  )
}

// 次の練習以外は、たたんで日付と名前だけ見せる
function FoldedPlan({ plan }: { plan: BoardPlan }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
        <span className="font-bold text-orange-700">{formatDate(plan.date)}</span>
        <span className="min-w-0 font-bold break-words">{plan.title || '練習'}</span>
        <span className="ml-auto text-sm text-slate-500">{summary(plan)}</span>
      </summary>
      <div className="border-t border-slate-100 bg-stone-50 p-3 sm:p-4">
        <PlanItems plan={plan} />
      </div>
    </details>
  )
}

// チームページ（見るだけ・URL は固定）。先生が公開した練習の予定を、生徒がそれぞれの端末で見る
export function TeamBoardPage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setBoard(await fetchPublicBoard())
      setError('')
    } catch {
      setError('予定を読み込めませんでした。電波のよいところで「最新にする」を押してください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // アプリに戻ってきたとき（ホーム画面から開き直したときなど）に最新にする
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setLoading(true)
      void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const day = today()
  const { upcoming, past } = board ? splitBoard(board, day) : { upcoming: [], past: [] }
  const [next, ...later] = upcoming

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800">
      <header className="bg-gradient-to-br from-orange-600 to-orange-500 px-4 py-6 text-white">
        <div className="mx-auto flex max-w-2xl items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-orange-100">🏀 チームの練習予定</p>
            {next ? (
              <>
                <h1 className="mt-1 text-2xl font-bold break-words">
                  {next.date === day ? '今日の練習' : '次の練習'}：{next.title || '練習'}
                </h1>
                <p className="mt-1 text-orange-50">{[formatDate(next.date), summary(next)].join('・')}</p>
              </>
            ) : (
              <h1 className="mt-1 text-2xl font-bold">練習の予定</h1>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            disabled={loading}
            className="min-h-11 shrink-0 rounded-lg bg-white/20 px-3 text-sm font-bold text-white hover:bg-white/30 disabled:opacity-60"
          >
            {loading ? '読み込み中…' : '🔄 最新にする'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</p>}
        {!board ? (
          !error && <p className="py-16 text-center text-slate-500">読み込み中…</p>
        ) : (
          <>
            {next ? (
              <PlanItems plan={next} />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                これからの練習の予定は、まだ公開されていません。
              </p>
            )}
            {later.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-bold text-slate-600">📅 このあとの予定</h2>
                {later.map((p) => <FoldedPlan key={p.date} plan={p} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-bold text-slate-600">✅ 終わった練習</h2>
                {past.slice(0, 10).map((p) => <FoldedPlan key={p.date} plan={p} />)}
              </section>
            )}
          </>
        )}
        <div className="space-y-1 text-center text-xs text-slate-400">
          {board?.updatedAt && <p>先生が最後に更新：{formatTime(board.updatedAt)}</p>}
          <p>このページは見るだけです。ブックマーク（ホーム画面に追加）しておくと、いつでも最新の予定が見られます。</p>
        </div>
      </main>
    </div>
  )
}
