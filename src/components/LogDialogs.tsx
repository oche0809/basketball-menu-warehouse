import { useState, type ReactNode } from 'react'
import type { PracticeLogEntry, PracticeMenu, SavedPlan } from '../types/menu'
import { normalizeForSearch } from '../utils/filters'
import { fieldClass, formatDate } from '../utils/format'
import { today } from '../utils/plan'
import { newId } from '../utils/storage'

type NewEntry = Omit<PracticeLogEntry, 'id' | 'recordedAt'>

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const clampMinutes = (n: number) => Math.min(300, Math.max(1, Math.round(n) || 1))

function Dialog({ label, onClose, children, footer }: { label: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="border-b border-slate-200 px-5 py-3 font-bold">{label}</p>
        <div className="space-y-4 overflow-y-auto p-5">{children}</div>
        <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row-reverse">{footer}</div>
      </div>
    </div>
  )
}

const primary = 'min-h-11 rounded-lg bg-orange-600 px-4 font-bold text-white hover:bg-orange-700 disabled:opacity-40 sm:flex-1'
const secondary = 'min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50'

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-slate-700">練習日</span>
      <input type="date" value={value} max={today()} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  )
}

// 実施記録ページ：メニューを選んで手で記録を追加する
export function AddLogDialog({ menus, onAdd, onClose }: { menus: PracticeMenu[]; onAdd: (entries: NewEntry[]) => void; onClose: () => void }) {
  const [date, setDate] = useState(today())
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<PracticeMenu | null>(null)
  const [minutes, setMinutes] = useState('')
  const q = normalizeForSearch(query.trim())
  const shown = (q ? menus.filter((m) => normalizeForSearch(m.title).includes(q)) : menus.filter((m) => m.favorite)).slice(0, 30)

  return (
    <Dialog
      label="📊 実施記録を追加"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            disabled={!menu || !isDate(date)}
            className={primary}
            onClick={() => {
              if (!menu) return
              onAdd([{ date, itemId: `manual-${newId()}`, menuId: menu.id, title: menu.title, category: menu.category, duration: clampMinutes(Number(minutes) || menu.duration), planTitle: '' }])
              onClose()
            }}
          >
            記録する
          </button>
          <button type="button" onClick={onClose} className={secondary}>キャンセル</button>
        </>
      }
    >
      <DateField value={date} onChange={setDate} />
      <div className="space-y-1">
        <span className="text-sm font-bold text-slate-700">メニュー</span>
        {menu ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2">
            <span className="font-bold break-words">{menu.title}</span>
            <button type="button" onClick={() => setMenu(null)} className="shrink-0 text-sm font-bold text-orange-700">変更</button>
          </div>
        ) : (
          <>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="メニュー名で検索" aria-label="メニュー名で検索" className={fieldClass} />
            <p className="text-xs text-slate-500">{q ? '検索結果' : 'お気に入り（検索するとすべてから選べます）'}</p>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {shown.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(m)
                      setMinutes(String(m.duration))
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-orange-50"
                  >
                    <span className="min-w-0 truncate">{m.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{m.category}</span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">{q ? '一致するメニューがありません。' : 'お気に入りはありません。検索してください。'}</li>}
            </ul>
          </>
        )}
      </div>
      {menu && (
        <label className="block space-y-1">
          <span className="text-sm font-bold text-slate-700">時間（分）</span>
          <input type="number" inputMode="numeric" min={1} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={fieldClass} />
        </label>
      )}
    </Dialog>
  )
}

// 実施記録ページ：記録の日付・時間を直す・削除する
export function EditLogDialog({ entry, onSave, onDelete, onClose }: { entry: PracticeLogEntry; onSave: (patch: { date: string; duration: number }) => void; onDelete: () => void; onClose: () => void }) {
  const [date, setDate] = useState(entry.date)
  const [minutes, setMinutes] = useState(String(entry.duration))
  const [confirming, setConfirming] = useState(false)
  return (
    <Dialog
      label="📊 実施記録を編集"
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <button type="button" onClick={onDelete} className="min-h-11 rounded-lg bg-rose-600 px-4 font-bold text-white hover:bg-rose-700 sm:flex-1">削除する</button>
            <button type="button" onClick={() => setConfirming(false)} className={secondary}>やめる</button>
          </>
        ) : (
          <>
            <button type="button" disabled={!isDate(date)} onClick={() => onSave({ date, duration: clampMinutes(Number(minutes)) })} className={primary}>保存する</button>
            <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-lg border border-rose-300 bg-white px-4 font-bold text-rose-600 hover:bg-rose-50">この記録を削除</button>
            <button type="button" onClick={onClose} className={secondary}>キャンセル</button>
          </>
        )
      }
    >
      <p className="font-bold break-words">{entry.title}</p>
      {confirming ? (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{formatDate(entry.date)}のこの記録を削除しますか？元に戻せません。</p>
      ) : (
        <>
          <DateField value={date} onChange={setDate} />
          <label className="block space-y-1">
            <span className="text-sm font-bold text-slate-700">時間（分）</span>
            <input type="number" inputMode="numeric" min={1} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={fieldClass} />
          </label>
        </>
      )}
    </Dialog>
  )
}

// 保存済み計画：「この日にやった」とまとめて記録する
export function RecordSavedPlanDialog({ plan, menus, onAdd, onClose }: { plan: SavedPlan; menus: PracticeMenu[]; onAdd: (entries: NewEntry[]) => void; onClose: () => void }) {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const [date, setDate] = useState(isDate(plan.date) && plan.date <= today() ? plan.date : today())
  const [checked, setChecked] = useState(() => new Set(plan.items.map((i) => i.id)))
  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Dialog
      label="📊 この計画を実施記録に追加"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            disabled={checked.size === 0 || !isDate(date)}
            className={primary}
            onClick={() => {
              onAdd(
                plan.items
                  .filter((i) => checked.has(i.id))
                  .map((i) => {
                    const m = menuMap.get(i.menuId)
                    // 同じ計画を同じ日に2回記録しても重ならないよう、計画の id を含める
                    return { date, itemId: `saved-${plan.id}-${i.id}`, menuId: i.menuId, title: m?.title ?? i.title ?? '（削除されたメニュー）', category: m?.category ?? i.category ?? 'その他', duration: i.duration, planTitle: plan.title }
                  }),
              )
              onClose()
            }}
          >
            {checked.size}件を記録する
          </button>
          <button type="button" onClick={onClose} className={secondary}>キャンセル</button>
        </>
      }
    >
      <DateField value={date} onChange={setDate} />
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-700">実施したメニュー</p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {plan.items.map((i) => (
            <li key={i.id}>
              <label className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" checked={checked.has(i.id)} onChange={() => toggle(i.id)} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate">{menuMap.get(i.menuId)?.title ?? i.title ?? '（削除されたメニュー）'}</span>
                <span className="shrink-0 text-sm text-slate-500">{i.duration}分</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
