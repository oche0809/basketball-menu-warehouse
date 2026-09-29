import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPlan } from '../components/PrintPlan'
import type { PracticeMenu, SavedPlan } from '../types/menu'
import { ALL } from '../utils/filters'
import { PLAN_TARGETS } from '../utils/plan'
import { EMPTY_SAVED_FILTER, SAVED_COUNT_RANGES, SAVED_DURATION_RANGES, filterSavedPlans, planTotal, type SavedFilter } from '../utils/savedPlans'
import { TimeSummary, formatDate, printPage } from './PlanPage'

const formatSavedAt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} 保存`
}

const USE_CONFIRM = {
  message: '現在の練習計画を置き換えますか？',
  note: '今の練習計画（メニュー・メモ・振り返り）は置き換わります。残したい場合は、先に練習計画画面で「この計画を保存」してください。',
  confirmLabel: '置き換える',
}

const COPY_HINT = '保存済みの計画を現在の練習計画へコピーします（保存済みの計画は変わりません）'

function StarButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'お気に入りを解除' : 'お気に入りに追加'}
      className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl hover:bg-amber-50 ${active ? '' : 'text-slate-300'}`}
    >
      {active ? '⭐' : '☆'}
    </button>
  )
}

const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200'

type ListProps = {
  plans: SavedPlan[]
  menus: PracticeMenu[]
  hasCurrentPlan: boolean
  onUse: (plan: SavedPlan) => void
  onToggleFavorite: (id: string) => void
}

export function SavedPlansList({ plans, menus, hasCurrentPlan, onUse, onToggleFavorite }: ListProps) {
  const [filter, setFilter] = useState<SavedFilter>(EMPTY_SAVED_FILTER)
  const [using, setUsing] = useState<SavedPlan | null>(null)
  const results = filterSavedPlans(plans, menus, filter)
  const active = JSON.stringify(filter) !== JSON.stringify(EMPTY_SAVED_FILTER)
  const update = (patch: Partial<SavedFilter>) => setFilter((f) => ({ ...f, ...patch }))

  const selects: { key: 'target' | 'duration' | 'count'; label: string; values: string[] }[] = [
    { key: 'target', label: '対象', values: PLAN_TARGETS },
    { key: 'duration', label: '所要時間', values: SAVED_DURATION_RANGES.map((r) => r.label) },
    { key: 'count', label: 'メニュー数', values: SAVED_COUNT_RANGES.map((r) => r.label) },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">保存済み練習</h1>
        <a href="#/plan" className="py-2 font-medium text-orange-700 hover:underline">
          練習計画へ →
        </a>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
          <p className="font-bold text-slate-700">保存済みの練習計画はまだありません。</p>
          <p className="mt-1">練習計画画面の「💾 この計画を保存」で保存できます。</p>
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="search"
              value={filter.query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder="タイトル・対象・メニュー・メモを検索"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              <div className="col-span-2 space-y-1 md:col-span-3 lg:col-span-1">
                <span className="text-sm font-bold text-slate-700">表示</span>
                <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 text-sm font-bold">
                  {[false, true].map((fav) => (
                    <button
                      key={String(fav)}
                      type="button"
                      aria-pressed={filter.favoritesOnly === fav}
                      onClick={() => update({ favoritesOnly: fav })}
                      className={`h-11 whitespace-nowrap ${filter.favoritesOnly === fav ? 'bg-orange-600 text-white' : 'bg-white text-slate-700'}`}
                    >
                      {fav ? '⭐ お気に入り' : 'すべて'}
                    </button>
                  ))}
                </div>
              </div>
              {selects.map((s) => (
                <label key={s.key} className="block space-y-1">
                  <span className="text-sm font-bold text-slate-700">{s.label}</span>
                  <select
                    value={filter[s.key]}
                    onChange={(e) => update({ [s.key]: e.target.value })}
                    className={`${selectClass} ${filter[s.key] !== ALL ? 'border-orange-500 bg-orange-50' : ''}`}
                  >
                    <option>{ALL}</option>
                    {s.values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-600" aria-live="polite">
                {plans.length}件中 {results.length}件を表示
              </p>
              <button
                type="button"
                onClick={() => setFilter(EMPTY_SAVED_FILTER)}
                disabled={!active}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                条件をリセット
              </button>
            </div>
          </section>

          <p className="text-sm text-slate-500">「この計画を使う」で、{COPY_HINT}。</p>

          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              条件に一致する練習計画がありません。
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {results.map((p) => (
                <li
                  key={p.id}
                  className="relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 hover:shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-orange-700">{formatDate(p.date)}</p>
                      <h2 className="mt-0.5 break-words text-lg font-bold">
                        <a href={`#/saved/${p.id}`} className="after:absolute after:inset-0">
                          {p.title || '今日の練習'}
                        </a>
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {[p.target, p.players > 0 && `${p.players}人`, `${planTotal(p)}分`, `${p.items.length}メニュー`].filter(Boolean).join('・')}
                      </p>
                    </div>
                    <StarButton active={p.favorite} onClick={() => onToggleFavorite(p.id)} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-slate-400">{formatSavedAt(p.savedAt)}</p>
                    <button
                      type="button"
                      onClick={() => (hasCurrentPlan ? setUsing(p) : onUse(p))}
                      className="relative z-10 rounded-lg bg-orange-600 px-4 py-2.5 font-bold whitespace-nowrap text-white hover:bg-orange-700"
                    >
                      📋 この計画を使う
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={using !== null}
        {...USE_CONFIRM}
        onCancel={() => setUsing(null)}
        onConfirm={() => {
          const p = using
          setUsing(null)
          if (p) onUse(p)
        }}
      />
    </div>
  )
}

function Memo({ title, text, tone }: { title: string; text?: string; tone: string }) {
  if (!text) return null
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-xs font-bold">{title}</p>
      <p className="whitespace-pre-wrap text-slate-800">{text}</p>
    </div>
  )
}

type DetailProps = {
  plan: SavedPlan
  menus: PracticeMenu[]
  hasCurrentPlan: boolean
  onUse: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

export function SavedPlanDetail({ plan, menus, hasCurrentPlan, onUse, onDelete, onToggleFavorite }: DetailProps) {
  const [confirm, setConfirm] = useState<'use' | 'delete' | null>(null)
  const menuMap = new Map(menus.map((m) => [m.id, m]))

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <a href="#/saved" className="inline-block py-2 font-medium text-orange-700 hover:underline">
            ← 保存済み一覧へ
          </a>
          <button
            type="button"
            onClick={printPage}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold whitespace-nowrap text-slate-700 hover:bg-slate-50"
          >
            🖨️ 印刷
          </button>
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-orange-700">保存済み練習 ・ {formatSavedAt(plan.savedAt)}</p>
              <h1 className="break-words text-2xl font-bold">{plan.title || '今日の練習'}</h1>
              <p className="mt-1 text-slate-600">
                {[`練習日：${formatDate(plan.date)}`, plan.target, plan.players > 0 && `${plan.players}人`].filter(Boolean).join('・')}
              </p>
            </div>
            <StarButton active={plan.favorite} onClick={onToggleFavorite} />
          </div>
          <TimeSummary planned={plan.plannedDuration} total={planTotal(plan)} />
          <div className="grid grid-cols-[1fr_2fr] gap-2 whitespace-nowrap sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirm('delete')}
              className="order-2 rounded-lg border border-rose-300 bg-white px-5 py-3 font-bold text-rose-600 hover:bg-rose-50 sm:order-1"
            >
              削除
            </button>
            <button
              type="button"
              onClick={() => (hasCurrentPlan ? setConfirm('use') : onUse())}
              className="order-1 rounded-lg bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700 sm:order-2"
            >
              📋 この計画を使う
            </button>
          </div>
          <p className="text-sm text-slate-500 sm:text-right">{COPY_HINT}</p>
        </section>

        <ol className="space-y-3">
          {plan.items.map((item, i) => {
            const menu = menuMap.get(item.menuId)
            return (
              <li key={item.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-100 font-bold text-orange-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {menu ? (
                      <a href={`#/menus/${menu.id}`} className="block break-words text-lg font-bold hover:text-orange-700 hover:underline">
                        {menu.title}
                      </a>
                    ) : (
                      <>
                        {item.title && <p className="break-words text-lg font-bold text-slate-500">{item.title}</p>}
                        <p className="text-sm font-bold text-slate-400">このメニューは現在のメニュー倉庫にありません</p>
                      </>
                    )}
                    {(menu?.category ?? item.category) && <p className="text-sm text-slate-500">{menu?.category ?? item.category}</p>}
                  </div>
                  <p className="shrink-0 text-lg font-bold">{item.duration}分</p>
                </div>
                <div className="space-y-2 md:ml-11">
                  <Memo title="📝 今回のメモ" text={item.note} tone="border-amber-200 bg-amber-50 text-amber-800" />
                  <Memo title="➡ 次回の改善メモ" text={item.nextNote} tone="border-sky-200 bg-sky-50 text-sky-800" />
                </div>
              </li>
            )
          })}
        </ol>

        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <h2 className="font-bold text-emerald-800">練習後の振り返り</h2>
          <p className="mt-1 whitespace-pre-wrap">{plan.reflection || <span className="text-slate-400">（未記入）</span>}</p>
        </section>

        <ConfirmDialog
          open={confirm === 'use'}
          {...USE_CONFIRM}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            onUse()
          }}
        />
        <ConfirmDialog
          open={confirm === 'delete'}
          message="この保存済み練習計画を削除しますか？"
          confirmLabel="削除"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            onDelete()
          }}
        />
      </div>
      {/* 保存済み計画は、保存時のメニュー名・カテゴリを優先して印刷する */}
      <PrintPlan
        plan={plan}
        rows={plan.items.map((item) => {
          const menu = menuMap.get(item.menuId)
          return {
            key: item.id,
            title: item.title ?? menu?.title ?? '（メニュー倉庫にないメニュー）',
            category: item.category ?? menu?.category ?? '',
            duration: item.duration,
            note: item.note,
            nextNote: item.nextNote,
          }
        })}
      />
    </>
  )
}
