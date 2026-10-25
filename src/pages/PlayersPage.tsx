import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RecordChart } from '../components/RecordChart'
import type { Player, RecordTest } from '../types/menu'
import { fieldClass, formatDate } from '../utils/format'
import { today } from '../utils/plan'
import { bestOf, formatValue, recordId, type PlayersActions } from '../utils/players'

type Tab = 'record' | 'players' | 'tests'
const TABS: { key: Tab; label: string }[] = [
  { key: 'record', label: '📝 記録する' },
  { key: 'players', label: '👤 選手' },
  { key: 'tests', label: '📏 項目' },
]

const btn = 'min-h-11 rounded-lg px-4 font-bold'
const sortPlayers = (list: Player[]) =>
  [...list].sort((a, b) => a.grade.localeCompare(b.grade, 'ja') || (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name, 'ja'))

// 全角数字も読めるようにして数にする（空欄・数でないものは null）
function toNumber(raw: string): number | null {
  const s = raw.trim().replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// ---- 記録する：項目と日付を選んで、選手全員の値をまとめて入れる ----
function RecordTab({ data }: { data: PlayersActions }) {
  const { tests, records, saveDay } = data
  const players = sortPlayers(data.players.filter((p) => p.active))
  const [testId, setTestId] = useState(tests[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [saved, setSaved] = useState(false)
  // 入力中の値（項目・日付を変えたら空に戻し、その日にすでにある記録を表示する）
  const [draft, setDraft] = useState<{ key: string; values: Record<string, string> }>({ key: '', values: {} })
  const key = `${testId}:${date}`
  const values = draft.key === key ? draft.values : {}
  const test = tests.find((t) => t.id === testId)
  const current = (pid: string) => records.find((r) => r.id === recordId(pid, testId, date))
  const valueOf = (pid: string) => values[pid] ?? (current(pid) ? formatValue(current(pid)!.value) : '')
  const previous = (pid: string) =>
    records.filter((r) => r.playerId === pid && r.testId === testId && r.date < date).sort((a, b) => b.date.localeCompare(a.date))[0]

  if (players.length === 0)
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">まず「👤 選手」タブで選手を登録してください。</p>
  if (!test) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">「📏 項目」タブで測定項目を追加してください。</p>

  const changed = Object.keys(values).length > 0
  const save = () => {
    saveDay(testId, date, new Map(Object.entries(values).map(([pid, raw]) => [pid, toNumber(raw)])))
    setDraft({ key: '', values: {} })
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-bold text-slate-700">項目</span>
          <select
            value={testId}
            onChange={(e) => {
              setTestId(e.target.value)
              setSaved(false)
            }}
            className={fieldClass}
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.unit}・{t.better === 'higher' ? '多いほど良い' : '少ないほど良い'}）
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-bold text-slate-700">測定日</span>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => {
              if (!e.target.value) return
              setDate(e.target.value)
              setSaved(false)
            }}
            className={fieldClass}
          />
        </label>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {players.map((p) => {
          const prev = previous(p.id)
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {p.number && <span className="mr-1 text-slate-500">#{p.number}</span>}
                  {p.name}
                </p>
                <p className="text-xs text-slate-500">{prev ? `前回 ${formatValue(prev.value)}${test.unit}（${prev.date.slice(5).replace('-', '/')}）` : '前回の記録なし'}</p>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={valueOf(p.id)}
                onChange={(e) => {
                  setSaved(false)
                  setDraft({ key, values: { ...values, [p.id]: e.target.value } })
                }}
                aria-label={`${p.name}の${test.name}`}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-right text-base focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
              />
              <span className="w-6 text-sm text-slate-500">{test.unit}</span>
            </li>
          )
        })}
      </ul>
      <div className="sticky z-10 flex items-center gap-3 md:static" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={save} disabled={!changed} className={`${btn} flex-1 bg-orange-600 text-white shadow hover:bg-orange-700 disabled:opacity-40 md:flex-none`}>
          保存する
        </button>
        {saved && <p className="font-bold text-emerald-700">✓ 保存しました</p>}
      </div>
      <p className="text-xs text-slate-500">空欄にして保存すると、その日の記録を消します。</p>
    </div>
  )
}

function PlayerEditDialog({ player, onSave, onDelete, onClose }: { player: Player; onSave: (p: Partial<Player>) => void; onDelete: () => void; onClose: () => void }) {
  const [f, setF] = useState(player)
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="選手を編集" className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold">選手を編集</p>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="名前" className={fieldClass} />
        <div className="grid grid-cols-2 gap-2">
          <input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="背番号" aria-label="背番号" className={fieldClass} />
          <input value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="学年" aria-label="学年" className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} className="h-5 w-5" />
          非表示にする（卒業・引退など。記録は残ります）
        </label>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={!f.name.trim()}
            onClick={() => onSave({ name: f.name.trim(), number: f.number.trim(), grade: f.grade.trim(), active: f.active })}
            className={`${btn} bg-orange-600 text-white disabled:opacity-40 sm:flex-1`}
          >
            保存する
          </button>
          <button type="button" onClick={onDelete} className={`${btn} border border-rose-300 text-rose-600`}>
            削除
          </button>
          <button type="button" onClick={onClose} className={`${btn} border border-slate-300 text-slate-700`}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- 選手 ----
function PlayersTab({ data }: { data: PlayersActions }) {
  const [form, setForm] = useState({ name: '', number: '', grade: '' })
  const [editing, setEditing] = useState<Player | null>(null)
  const [deleting, setDeleting] = useState<Player | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const list = sortPlayers(data.players.filter((p) => showHidden || p.active))
  const hidden = data.players.filter((p) => !p.active).length

  return (
    <div className="space-y-4">
      <form
        className="grid grid-cols-[1fr_5rem] gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_6rem_8rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.name.trim()) return
          data.addPlayer({ name: form.name.trim(), number: form.number.trim(), grade: form.grade.trim() })
          setForm({ name: '', number: '', grade: '' })
        }}
      >
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="名前" aria-label="名前" className={fieldClass} />
        <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="背番号" aria-label="背番号" inputMode="numeric" className={fieldClass} />
        <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="学年（例：2年）" aria-label="学年" className={`${fieldClass} col-span-2 sm:col-span-1`} />
        <button type="submit" disabled={!form.name.trim()} className={`${btn} col-span-2 bg-orange-600 text-white disabled:opacity-40 sm:col-span-1`}>
          ＋ 追加
        </button>
      </form>
      {list.length === 0 ? (
        <p className="text-center text-sm text-slate-500">選手はまだいません。</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-4 py-2">
              <a href={`#/players/${p.id}`} className={`min-w-0 flex-1 truncate font-bold hover:text-orange-700 ${p.active ? '' : 'text-slate-400'}`}>
                {p.number && <span className="mr-1 text-slate-500">#{p.number}</span>}
                {p.name}
                {p.grade && <span className="ml-2 text-sm font-normal text-slate-500">{p.grade}</span>}
                {!p.active && <span className="ml-2 text-xs">（非表示）</span>}
              </a>
              <button type="button" onClick={() => setEditing(p)} className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
                編集
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setShowHidden((v) => !v)} className="text-sm font-bold text-orange-700 hover:underline">
          {showHidden ? '非表示の選手を隠す' : `非表示の選手も見る（${hidden}人）`}
        </button>
      )}
      {editing && (
        <PlayerEditDialog
          key={editing.id}
          player={editing}
          onSave={(patch) => {
            data.updatePlayer(editing.id, patch)
            setEditing(null)
          }}
          onDelete={() => {
            setDeleting(editing)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        message={`${deleting?.name ?? ''}さんを削除しますか？`}
        note="この選手の記録もすべて消えます。卒業・引退の場合は「非表示にする」がおすすめです。"
        confirmLabel="削除"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) data.deletePlayer(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}

// ---- 項目 ----
function TestsTab({ data }: { data: PlayersActions }) {
  const [form, setForm] = useState<Omit<RecordTest, 'id'>>({ name: '', unit: '', better: 'higher' })
  const [deleting, setDeleting] = useState<RecordTest | null>(null)
  const count = (id: string) => data.records.filter((r) => r.testId === id).length
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data.tests.map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{t.name}</p>
              <p className="text-xs text-slate-500">
                単位：{t.unit || 'なし'}・{t.better === 'higher' ? '多いほど良い' : '少ないほど良い'}・記録 {count(t.id)}件
              </p>
            </div>
            <button type="button" onClick={() => setDeleting(t)} className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              削除
            </button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_6rem_10rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.name.trim()) return
          data.addTest({ ...form, name: form.name.trim(), unit: form.unit.trim() })
          setForm({ name: '', unit: '', better: 'higher' })
        }}
      >
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="項目名（例：ミドル5か所・決めた本数）" aria-label="項目名" className={fieldClass} />
        <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="単位" aria-label="単位" className={fieldClass} />
        <select value={form.better} onChange={(e) => setForm({ ...form, better: e.target.value as RecordTest['better'] })} aria-label="良い向き" className={fieldClass}>
          <option value="higher">多いほど良い</option>
          <option value="lower">少ないほど良い</option>
        </select>
        <button type="submit" disabled={!form.name.trim()} className={`${btn} bg-orange-600 text-white disabled:opacity-40`}>
          ＋ 追加
        </button>
      </form>
      <ConfirmDialog
        open={deleting !== null}
        message={`項目「${deleting?.name ?? ''}」を削除しますか？`}
        note={`この項目の記録（${deleting ? count(deleting.id) : 0}件）もすべて消えます。`}
        confirmLabel="削除"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) data.deleteTest(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}

export function PlayersPage({ data, tab }: { data: PlayersActions; tab: string | null }) {
  // タブの指定がないときは、開いた時点で選手がいなければ「選手」から（登録の途中でタブが切り替わらないよう最初に決める）
  const [fallback] = useState<Tab>(data.players.length === 0 ? 'players' : 'record')
  const current: Tab = tab === 'players' || tab === 'tests' || tab === 'record' ? tab : fallback
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">🏃 選手の記録</h1>
        <p className="text-sm text-slate-500">シュート本数やタイムを記録して、選手ごとの伸びを確認できます。名前や記録はこの端末の中だけに保存されます。</p>
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`#/players?tab=${t.key}`}
            role="tab"
            aria-selected={current === t.key}
            className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-bold ${current === t.key ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600'}`}
          >
            {t.label}
          </a>
        ))}
      </div>
      {current === 'record' && <RecordTab data={data} />}
      {current === 'players' && <PlayersTab data={data} />}
      {current === 'tests' && <TestsTab data={data} />}
    </div>
  )
}

// ---- 選手ごとの伸び ----
export function PlayerDetailPage({ data, player }: { data: PlayersActions; player: Player }) {
  const [tableFor, setTableFor] = useState<string | null>(null)
  const mine = data.records.filter((r) => r.playerId === player.id)
  const tests = data.tests.filter((t) => mine.some((r) => r.testId === t.id))
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <a href="#/players?tab=players" className="inline-block py-2 font-medium text-orange-700 hover:underline">
        ← 選手一覧へ
      </a>
      <h1 className="text-2xl font-bold">
        {player.number && <span className="mr-2 text-slate-500">#{player.number}</span>}
        {player.name}
        {player.grade && <span className="ml-2 text-base font-normal text-slate-500">{player.grade}</span>}
      </h1>
      {tests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          まだ記録がありません。
          <a href="#/players?tab=record" className="font-bold text-orange-700 hover:underline">
            「📝 記録する」
          </a>
          から入れてください。
        </p>
      ) : (
        tests.map((t) => {
          const points = mine
            .filter((r) => r.testId === t.id)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => ({ date: r.date, value: r.value, id: r.id }))
          const first = points[0].value
          const latest = points[points.length - 1].value
          const best = bestOf(points.map((p) => p.value), t.better)!
          const diff = latest - first
          const improved = t.better === 'higher' ? diff > 0 : diff < 0
          const change = points.length < 2 || diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${formatValue(diff)}${t.unit}（${improved ? '▲伸びた' : '▼下がった'}）`
          return (
            <section key={t.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-bold text-orange-700">
                {t.name}
                <span className="ml-2 text-xs font-normal text-slate-500">（{t.better === 'higher' ? '多いほど良い' : '少ないほど良い'}）</span>
              </h2>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['最新', `${formatValue(latest)}${t.unit}`],
                  ['ベスト', `${formatValue(best)}${t.unit}`],
                  ['最初と比べて', change],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-stone-50 p-2">
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="font-bold break-words text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <RecordChart points={points} unit={t.unit} label={t.name} />
              <button type="button" onClick={() => setTableFor(tableFor === t.id ? null : t.id)} aria-expanded={tableFor === t.id} className="text-sm font-bold text-orange-700 hover:underline">
                {tableFor === t.id ? '表を閉じる' : `表で見る（${points.length}回）`}
              </button>
              {tableFor === t.id && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-1 font-medium">測定日</th>
                      <th className="py-1 text-right font-medium">記録</th>
                      <th>
                        <span className="sr-only">操作</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-1.5">{formatDate(p.date)}</td>
                        <td className="py-1.5 text-right font-bold">
                          {formatValue(p.value)}
                          {t.unit}
                          {p.value === best && <span className="ml-1 text-xs font-normal text-slate-500">ベスト</span>}
                        </td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => data.deleteRecord(p.id)} aria-label={`${formatDate(p.date)}の記録を削除`} className="rounded px-2 text-xs text-slate-400 hover:text-rose-600">
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
