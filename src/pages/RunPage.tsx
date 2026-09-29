import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { PracticeMenu, PracticePlan } from '../types/menu'
import type { SessionActions } from '../utils/session'
import { TimeSummary, formatDate } from './PlanPage'

const navButton =
  'h-14 rounded-xl border border-slate-300 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30'

type Props = { plan: PracticePlan; menus: PracticeMenu[]; session: SessionActions }

export function RunPage({ plan, menus, session }: Props) {
  const [confirming, setConfirming] = useState(false)
  const { items } = plan
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const total = items.reduce((sum, i) => sum + i.duration, 0)
  const { currentIndex, completedIds, completedCount, allDone } = session
  const current = items[currentIndex]
  const menu = current && menuMap.get(current.menuId)
  const isDone = current ? completedIds.has(current.id) : false
  const finished = allDone && currentIndex === -1

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-500">練習計画にメニューがありません。</p>
        <a href="#/plan" className="mt-4 inline-block font-bold text-orange-700 hover:underline">
          ← 練習計画に戻る
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <a href="#/plan" className="py-2 font-medium text-orange-700 hover:underline">
          ← 練習計画に戻る
        </a>
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
          実施状態をリセット
        </button>
      </div>

      <header>
        <p className="text-xs font-bold text-emerald-700">練習実施</p>
        <h1 className="break-words text-xl font-bold">{plan.title || '今日の練習'}</h1>
        <p className="text-sm text-slate-600">{[formatDate(plan.date), plan.target, plan.players > 0 && `${plan.players}人`].filter(Boolean).join('・')}</p>
      </header>

      <TimeSummary planned={plan.plannedDuration} total={total} />

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-3xl font-bold">
            {finished ? items.length : currentIndex + 1}
            <span className="text-lg text-slate-500"> / {items.length}</span>
          </p>
          <p className="font-bold text-emerald-700">
            実施済み {completedCount} / {items.length}
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-emerald-500" style={{ width: `${(completedCount / items.length) * 100}%` }} />
        </div>
        <ol className="flex flex-wrap gap-1.5 pt-1">
          {items.map((item, i) => {
            const done = completedIds.has(item.id)
            const isCurrent = i === currentIndex
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => session.goTo(i)}
                  aria-label={`${i + 1}番目${done ? '（実施済み）' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`h-9 min-w-9 rounded-full px-2 text-sm font-bold ${
                    isCurrent
                      ? 'bg-orange-600 text-white'
                      : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'border border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {done && !isCurrent ? '✓' : i + 1}
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      {finished ? (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
          <p className="text-2xl font-bold text-emerald-800">🏁 練習完了</p>
          <p className="mt-2 text-emerald-800">全{items.length}メニューを実施しました。</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={session.prev} className={navButton}>
              最後のメニューを見る
            </button>
            <a href="#/plan" className={`${navButton} grid place-items-center`}>
              練習計画に戻る
            </a>
          </div>
        </section>
      ) : (
        current && (
          <>
            <article className={`rounded-xl border-2 p-5 ${isDone ? 'border-emerald-200 bg-emerald-50/60' : 'border-orange-300 bg-white shadow-sm'}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-800">{menu?.category ?? 'その他'}</span>
                {isDone && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-white">✓ 実施済み</span>}
              </div>
              <div className="mt-2 flex items-start justify-between gap-3">
                <h2 className={`min-w-0 break-words text-2xl font-bold md:text-3xl ${isDone ? 'text-slate-500' : ''}`}>{menu?.title ?? '（削除されたメニュー）'}</h2>
                <p className="shrink-0 text-3xl font-bold text-orange-700">
                  {current.duration}
                  <span className="text-base">分</span>
                </p>
              </div>
              {menu && menu.coachingPoints.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-slate-500">指導ポイント</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                    {menu.coachingPoints.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {current.note && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h3 className="text-sm font-bold text-amber-800">📝 今回のメモ</h3>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{current.note}</p>
                </div>
              )}
              {menu && (
                <a href={`#/menus/${menu.id}`} className="mt-4 inline-block text-sm font-bold text-orange-700 hover:underline">
                  メニューの詳細を見る →
                </a>
              )}
            </article>

            <div
              className="sticky z-10 -mx-4 space-y-2 border-t border-slate-200 bg-stone-50/95 px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0"
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
            >
              {isDone ? (
                <button type="button" onClick={session.uncomplete} className="h-14 w-full rounded-xl border border-emerald-300 bg-white text-lg font-bold text-emerald-700">
                  実施済みを取り消す
                </button>
              ) : (
                <button type="button" onClick={session.complete} className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-bold text-white hover:bg-emerald-700">
                  ✓ 実施済みにする
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={session.prev} disabled={currentIndex === 0} className={navButton}>
                  ← 前へ
                </button>
                <button type="button" onClick={session.next} disabled={currentIndex === items.length - 1 && !allDone} className={navButton}>
                  次へ →
                </button>
              </div>
            </div>
          </>
        )
      )}

      <ConfirmDialog
        open={confirming}
        message="今回の実施状態をリセットしますか？"
        note="練習計画そのものは削除されません。"
        confirmLabel="リセット"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          session.reset()
          setConfirming(false)
        }}
      />
    </div>
  )
}
