import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AIPlanDialog } from '../components/AIPlanDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPlan } from '../components/PrintPlan'
import type { AIPlanConditions, AIPlanProposal, PracticeMenu } from '../types/menu'
import { ALL, EMPTY_CONDITIONS, filterMenus } from '../utils/filters'
import { PLAN_TARGETS, type PlanActions } from '../utils/plan'
import type { SessionActions } from '../utils/session'

const STEP = 5

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${y}年${m}月${d}日（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`
}

export const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200'

// 入力中は自由に打てるようにし、確定（フォーカスを外す）時に範囲・刻みをそろえる
// 入力中の値は画面内だけで持ち、確定時（フォーカスが外れる・Enter・画面を離れる）に保存する
function useDraft(value: string, onCommit: (draft: string) => void) {
  const [draft, setDraft] = useState(value)
  const latest = useRef({ draft, value, onCommit })
  useLayoutEffect(() => {
    latest.current = { draft, value, onCommit }
  })
  const commit = () => {
    const { draft, value, onCommit } = latest.current
    if (draft !== value) onCommit(draft)
  }
  // ページ移動などで入力欄が消えるときも確定させる
  useEffect(() => () => commit(), [])
  return { draft, setDraft, commit }
}

function NumberInput({ value, min, max, step, onCommit }: { value: number; min: number; max: number; step: number; onCommit: (v: number) => void }) {
  const { draft, setDraft, commit } = useDraft(value > 0 ? String(value) : '', (raw) => {
    const n = Number(raw)
    // 空欄・数字以外は元の値に戻す（参加人数は空欄なら未設定）。範囲外は min〜max に収める
    const next =
      raw.trim() === '' || !Number.isFinite(n)
        ? raw.trim() === '' && min === 1
          ? 0
          : value
        : Math.min(max, Math.max(min, Math.round(n / step) * step))
    setDraft(next > 0 ? String(next) : '')
    if (next !== value) onCommit(next)
  })
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={fieldClass}
    />
  )
}

function TitleInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { draft, setDraft, commit } = useDraft(value, onCommit)
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      placeholder="今日の練習"
      className={fieldClass}
    />
  )
}

function NoteInput({
  value,
  label,
  placeholder,
  tone,
  onCommit,
}: {
  value: string
  label: string
  placeholder: string
  tone: string
  onCommit: (v: string) => void
}) {
  const { draft, setDraft, commit } = useDraft(value, onCommit)
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      rows={2}
      aria-label={label}
      placeholder={placeholder}
      className={`mt-3 block max-h-40 min-h-11 w-full resize-y rounded-lg border px-3 ${tone} py-2 text-base field-sizing-content focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 md:mt-2 md:w-[calc(100%-2.75rem)] md:ml-11`}
    />
  )
}

function ReflectionInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { draft, setDraft, commit } = useDraft(value, onCommit)
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      rows={3}
      aria-label="練習後の振り返り"
      placeholder="例：ディフェンスはよかった。トランジションが遅かったので、次回は切り替えを重点的に行う。"
      className={`${fieldClass} mt-2 max-h-60 resize-y field-sizing-content min-h-20`}
    />
  )
}

export function timeDiffLabel(planned: number, total: number) {
  const diff = planned - total
  return diff > 0 ? `あと${diff}分` : diff === 0 ? 'ぴったり' : `${-diff}分オーバー`
}

// 入力中の欄を確定させてから印刷する（印刷自体はデータを変えない）
export function printPage() {
  const el = document.activeElement
  if (el instanceof HTMLElement) flushSync(() => el.blur())
  window.print()
}

export function TimeSummary({ planned, total }: { planned: number; total: number }) {
  const diff = planned - total
  const label = timeDiffLabel(planned, total)
  const style = diff > 0 ? 'bg-sky-50 text-sky-800' : diff === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-stone-100 px-2 py-2">
        <div className="text-xs font-bold text-slate-500">予定</div>
        <div className="text-xl font-bold md:text-2xl">
          {planned}
          <span className="text-sm">分</span>
        </div>
      </div>
      <div className="rounded-lg bg-orange-50 px-2 py-2 text-orange-700">
        <div className="text-xs font-bold">計画（合計）</div>
        <div className="text-xl font-bold md:text-2xl">
          {total}
          <span className="text-sm">分</span>
        </div>
      </div>
      <div className={`grid place-items-center rounded-lg px-1 py-2 text-base font-bold whitespace-nowrap md:text-xl ${style}`} aria-live="polite">
        {label}
      </div>
    </div>
  )
}

const iconButton =
  'grid h-11 min-w-11 place-items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30'

function MenuPicker({ menus, onAdd, onClose }: { menus: PracticeMenu[]; onAdd: (m: PracticeMenu) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [addedCount, setAddedCount] = useState<Record<string, number>>({})
  const results = filterMenus(menus, query, ALL, EMPTY_CONDITIONS)

  return (
    <div className="fixed inset-0 z-40 bg-black/40 md:grid md:place-items-center md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="練習メニューを追加"
        className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-2xl md:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">練習メニューを追加</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>
        <div className="p-4 pb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 メニューを検索"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4 md:max-h-[55vh]">
          {results.length === 0 && <li className="py-8 text-center text-slate-500">条件に一致するメニューがありません。</li>}
          {results.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-bold">{m.title}</div>
                <div className="text-sm text-slate-500">
                  {m.category}・{m.duration}分
                  {addedCount[m.id] && <span className="ml-2 font-bold text-orange-700">追加済み ×{addedCount[m.id]}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onAdd(m)
                  setAddedCount((c) => ({ ...c, [m.id]: (c[m.id] ?? 0) + 1 }))
                }}
                className="shrink-0 rounded-lg bg-orange-600 px-4 py-2.5 font-bold text-white hover:bg-orange-700"
              >
                ＋ 追加
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
            完了
          </button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  menus: PracticeMenu[]
  session: SessionActions
  savedCount: number
  onSavePlan: () => void
  onApplyProposal: (proposal: AIPlanProposal, conditions: AIPlanConditions) => void
} & Omit<PlanActions, 'replacePlan'>

export function PlanPage({
  menus,
  plan,
  items,
  addItem,
  removeItem,
  moveItem,
  changeDuration,
  changeNote,
  changeNextNote,
  updateInfo,
  clearPlan,
  session,
  savedCount,
  onSavePlan,
  onApplyProposal,
}: Props) {
  const [picking, setPicking] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(t)
  }, [justSaved])

  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const rows = items.flatMap((item) => {
    const menu = menuMap.get(item.menuId)
    return menu ? [{ item, menu }] : []
  })
  const total = rows.reduce((sum, r) => sum + r.item.duration, 0)

  const addButton = (
    <button type="button" onClick={() => setPicking(true)} className="rounded-lg bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700">
      ＋ メニューを追加
    </button>
  )

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 print:hidden">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-orange-700">練習計画</p>
              <h1 className="break-words text-2xl font-bold">{plan.title || '今日の練習'}</h1>
              <p className="mt-1 text-slate-600">
                {[plan.date && `練習日：${formatDate(plan.date)}`, plan.target, plan.players > 0 && `${plan.players}人`]
                  .filter(Boolean)
                  .map((part, i, arr) => (
                    <span key={i} className="whitespace-nowrap">
                      {part}
                      {i < arr.length - 1 && '・'}
                    </span>
                  ))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingInfo((v) => !v)}
              aria-expanded={editingInfo}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {editingInfo ? '閉じる' : '✏️ 情報を編集'}
            </button>
          </div>

          {editingInfo && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 md:grid-cols-4">
              <label className="col-span-2 block space-y-1 md:col-span-4">
                <span className="text-sm font-bold text-slate-700">タイトル</span>
                <TitleInput value={plan.title} onCommit={(title) => updateInfo({ title })} />
              </label>
              <label className="col-span-2 block space-y-1 md:col-span-1">
                <span className="text-sm font-bold text-slate-700">練習日</span>
                <input type="date" value={plan.date} onChange={(e) => updateInfo({ date: e.target.value })} className={fieldClass} />
              </label>
              <label className="col-span-2 block space-y-1 md:col-span-1">
                <span className="text-sm font-bold text-slate-700">対象</span>
                <select value={plan.target} onChange={(e) => updateInfo({ target: e.target.value })} className={fieldClass}>
                  {(PLAN_TARGETS.includes(plan.target) ? PLAN_TARGETS : [...PLAN_TARGETS, plan.target]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-700">参加人数（人）</span>
                <NumberInput value={plan.players} min={1} max={999} step={1} onCommit={(players) => updateInfo({ players })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-700">予定練習時間（分）</span>
                <NumberInput
                  value={plan.plannedDuration}
                  min={5}
                  max={600}
                  step={5}
                  onCommit={(plannedDuration) => updateInfo({ plannedDuration })}
                />
              </label>
            </div>
          )}

          <TimeSummary planned={plan.plannedDuration} total={total} />

          {rows.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              {session.started && (
                <p className="font-bold text-emerald-800">
                  実施状況：{session.completedCount} / {items.length} メニュー完了
                </p>
              )}
              <div className="grid gap-2 sm:ml-auto sm:flex">
                {session.started && (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="order-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 sm:order-1"
                  >
                    実施状態をリセット
                  </button>
                )}
                <a
                  href="#/plan/run"
                  onClick={session.start}
                  className="order-1 rounded-lg bg-emerald-600 px-6 py-3 text-center font-bold text-white hover:bg-emerald-700 sm:order-2"
                >
                  ▶ {session.started ? '続きから実施' : '練習を開始'}
                </a>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="w-full rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 font-bold text-violet-800 hover:bg-violet-100 sm:w-auto"
          >
            🤖 Claudeで練習計画を作る
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <a href="#/saved" className="py-2 text-sm font-bold text-orange-700 hover:underline">
              📚 保存済み計画（{savedCount}件）
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={printPage}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                🖨️ 印刷
              </button>
              {justSaved && <span className="text-sm font-bold text-emerald-700">✓ 保存しました</span>}
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => {
                  // 入力中の欄を確定させてから保存する
                  const el = document.activeElement
                  if (el instanceof HTMLElement) flushSync(() => el.blur())
                  onSavePlan()
                  setJustSaved(true)
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                💾 この計画を保存
              </button>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <p className="font-bold">まだ練習メニューがありません。</p>
            <p className="mt-1 text-slate-500">メニューを追加して、今日の練習を組み立てましょう。</p>
            <div className="mt-6">{addButton}</div>
          </div>
        ) : (
          <>
            <ol className="space-y-3 md:space-y-0 md:divide-y md:divide-slate-200 md:overflow-hidden md:rounded-xl md:border md:border-slate-200 md:bg-white">
              {rows.map(({ item, menu }, i) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 md:rounded-none md:border-0 md:py-3">
                  <div className="md:flex md:items-center md:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-100 font-bold text-orange-700">{i + 1}</span>
                      <div className="min-w-0">
                        <a href={`#/menus/${menu.id}`} className="block truncate text-lg font-bold hover:text-orange-700 hover:underline">
                          {menu.title}
                        </a>
                        <div className="text-sm text-slate-500">
                          {menu.category}
                          {session.completedIds.has(item.id) && <span className="ml-2 font-bold text-emerald-700">✓ 実施済み</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 md:mt-0 md:gap-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="5分減らす"
                          disabled={item.duration <= STEP}
                          onClick={() => changeDuration(item.id, -STEP)}
                          className={iconButton}
                        >
                          −
                        </button>
                        <span className="w-14 text-center text-lg font-bold md:w-16">{item.duration}分</span>
                        <button type="button" aria-label="5分増やす" onClick={() => changeDuration(item.id, STEP)} className={iconButton}>
                          ＋
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="上へ" disabled={i === 0} onClick={() => moveItem(item.id, -1)} className={iconButton}>
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="下へ"
                          disabled={i === rows.length - 1}
                          onClick={() => moveItem(item.id, 1)}
                          className={iconButton}
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => removeItem(item.id)} className={`${iconButton} text-rose-600`}>
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                  <NoteInput
                    value={item.note ?? ''}
                    label={`${menu.title}の今回の指導メモ`}
                    placeholder="📝 今回の指導メモ（任意）例：パススピードを意識させる"
                    tone="border-slate-200 bg-stone-50"
                    onCommit={(note) => changeNote(item.id, note)}
                  />
                  <NoteInput
                    value={item.nextNote ?? ''}
                    label={`${menu.title}の次回の改善メモ`}
                    placeholder="➡ 次回の改善メモ（任意）例：4人組にしてテンポを上げる"
                    tone="border-sky-100 bg-sky-50/60"
                    onCommit={(nextNote) => changeNextNote(item.id, nextNote)}
                  />
                </li>
              ))}
            </ol>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold text-emerald-800">練習後の振り返り</h2>
              <ReflectionInput value={plan.reflection ?? ''} onCommit={(reflection) => updateInfo({ reflection })} />
            </section>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-rose-300 bg-white px-6 py-3 font-bold text-rose-600 hover:bg-rose-50"
              >
                練習計画を空にする
              </button>
              {addButton}
            </div>
          </>
        )}

        {picking && <MenuPicker menus={menus} onAdd={addItem} onClose={() => setPicking(false)} />}
        {aiOpen && (
          <AIPlanDialog
            menus={menus}
            initial={plan}
            onApply={(proposal, conditions) => {
              onApplyProposal(proposal, conditions)
              setAiOpen(false)
            }}
            onClose={() => setAiOpen(false)}
          />
        )}

        <ConfirmDialog
          open={confirmingReset}
          message="今回の実施状態をリセットしますか？"
          note="練習計画そのものは削除されません。"
          confirmLabel="リセット"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            session.reset()
            setConfirmingReset(false)
          }}
        />

        <ConfirmDialog
          open={confirming}
          message="練習計画をすべて削除しますか？"
          note="メニュー倉庫のメニューは削除されません。"
          confirmLabel="空にする"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            clearPlan()
            setConfirming(false)
          }}
        />
      </div>
      <PrintPlan
        plan={plan}
        rows={rows.map(({ item, menu }) => ({
          key: item.id,
          title: menu.title,
          category: menu.category,
          duration: item.duration,
          note: item.note,
          nextNote: item.nextNote,
        }))}
      />
    </>
  )
}
