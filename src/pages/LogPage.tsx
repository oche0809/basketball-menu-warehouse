import { useState, type ReactNode } from 'react'
import { AddLogDialog, EditLogDialog } from '../components/LogDialogs'
import type { PracticeLogEntry, PracticeMenu } from '../types/menu'
import { analyzeLog, daysBetween, type PracticeLogActions } from '../utils/practiceLog'
import { today } from '../utils/plan'
import { formatDate } from '../utils/format'

const PERIODS: { label: string; days: number | null }[] = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: 'すべて', days: null },
]

type Props = {
  entries: PracticeLogEntry[]
  menus: PracticeMenu[]
  onRemove: (id: string) => void
  onAdd: PracticeLogActions['addEntries']
  onUpdate: PracticeLogActions['updateEntry']
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 font-bold text-orange-700">{title}</h2>
      {children}
    </section>
  )
}

export function LogPage({ entries, menus, onRemove, onAdd, onUpdate }: Props) {
  const [days, setDays] = useState<number | null>(30)
  const [editing, setEditing] = useState<PracticeLogEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const base = today()
  const { inRange, totalMinutes, practiceDays, byCategory, missing, dominant, staleFavorites } = analyzeLog(entries, menus, days, base)
  const menuIds = new Set(menus.map((m) => m.id))
  const maxMinutes = Math.max(1, ...byCategory.map((c) => c.minutes))

  // 練習日ごとにまとめる（新しい日が上）
  const byDate = new Map<string, PracticeLogEntry[]>()
  for (const e of [...inRange].sort((a, b) => b.date.localeCompare(a.date) || a.recordedAt.localeCompare(b.recordedAt))) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📊 実施記録</h1>
          <p className="text-sm text-slate-500">練習実施画面で「✓ 実施済みにする」を押したメニューが記録されます。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-bold text-orange-700 hover:bg-orange-50">
          ＋ 記録を追加
        </button>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="集計する期間">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
              className={`rounded-md px-3 py-2 text-sm font-bold ${days === p.days ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600'}`}
            >
              {p.days === null ? p.label : `直近${p.label}`}
            </button>
          ))}
        </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          <p className="font-bold">まだ実施記録がありません。</p>
          <p className="mt-2 text-sm">練習計画を作って「▶ 練習を始める」から実施し、メニューごとに「✓ 実施済みにする」を押すと記録されます。</p>
          <p className="mt-1 text-sm">過去の練習は「＋ 記録を追加」や、保存済み計画の「📊 実施記録に追加」から入れられます。</p>
          <a href="#/plan" className="mt-4 inline-block font-bold text-orange-700 hover:underline">📝 練習計画へ</a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['練習日数', practiceDays, '日'],
              ['実施メニュー', inRange.length, '件'],
              ['合計時間', totalMinutes, '分'],
            ].map(([label, value, unit]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="text-xs text-slate-500 sm:text-sm">{label}</div>
                <div className="text-2xl font-bold sm:text-3xl">
                  {value}
                  <span className="ml-1 text-sm font-normal">{unit}</span>
                </div>
              </div>
            ))}
          </div>

          <Card title="⚖️ 偏りチェック">
            {inRange.length === 0 ? (
              <p className="text-sm text-slate-500">この期間の記録はありません。</p>
            ) : (
              <div className="space-y-4">
                {(missing.length > 0 || dominant) && (
                  <ul className="space-y-2">
                    {missing.length > 0 && (
                      <li className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        ⚠ この期間に <b>{missing.join('・')}</b> のメニューを行っていません。
                        <span className="mt-1 block">
                          {missing.slice(0, 3).map((c) => (
                            <a key={c} href={`#/menus?category=${encodeURIComponent(c)}`} className="mr-3 font-bold text-orange-700 hover:underline">
                              {c}のメニューを探す →
                            </a>
                          ))}
                        </span>
                      </li>
                    )}
                    {dominant && (
                      <li className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        ⚠ <b>{dominant.category}</b> が練習時間の{Math.round((dominant.minutes / totalMinutes) * 100)}%を占めています。
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-sm text-slate-500">カテゴリごとの練習時間（分）</p>
                <ul className="space-y-2">
                  {byCategory.map((c) => (
                    <li key={c.category} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
                      <span className="truncate font-bold">{c.category}</span>
                      <span className="h-4 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-orange-500" style={{ width: `${(c.minutes / maxMinutes) * 100}%` }} />
                      </span>
                      <span className="w-20 text-right text-slate-600">
                        {c.minutes}分・{c.count}回
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="♥ しばらくやっていないお気に入り">
            {menus.every((m) => !m.favorite) ? (
              <p className="text-sm text-slate-500">お気に入りに登録したメニューがあると、ここで「最近やっていないもの」を確認できます。</p>
            ) : staleFavorites.length === 0 ? (
              <p className="text-sm text-slate-500">お気に入りはすべて30日以内に実施しています。</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {staleFavorites.slice(0, 10).map(({ menu, last }) => (
                  <li key={menu.id} className="flex items-center justify-between gap-3 py-2">
                    <a href={`#/menus/${menu.id}`} className="min-w-0 truncate font-bold text-slate-800 hover:text-orange-700">
                      {menu.title}
                    </a>
                    <span className="shrink-0 text-sm text-slate-500">{last ? `${daysBetween(last, base)}日前` : '未実施'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="🗓 履歴">
            {byDate.size === 0 ? (
              <p className="text-sm text-slate-500">この期間の記録はありません。</p>
            ) : (
              <div className="space-y-4">
                {[...byDate].map(([date, list]) => (
                  <div key={date}>
                    <p className="font-bold">
                      {formatDate(date)}
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        {list.reduce((s, e) => s + e.duration, 0)}分
                        {list[0].planTitle && `・${list[0].planTitle}`}
                      </span>
                    </p>
                    <ul className="mt-1 divide-y divide-slate-100 border-l-2 border-orange-200 pl-3">
                      {list.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                          <div className="min-w-0">
                            {menuIds.has(e.menuId) ? (
                              <a href={`#/menus/${e.menuId}`} className="font-medium break-words hover:text-orange-700">{e.title}</a>
                            ) : (
                              <span className="font-medium break-words text-slate-500">{e.title}</span>
                            )}
                            <span className="ml-2 text-xs text-slate-500">
                              {e.category}・{e.duration}分
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditing(e)}
                            aria-label={`${e.title}の記録を編集`}
                            className="shrink-0 rounded px-2 py-1 text-sm text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                          >
                            編集
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {adding && <AddLogDialog menus={menus} onAdd={onAdd} onClose={() => setAdding(false)} />}
      {editing && (
        <EditLogDialog
          key={editing.id}
          entry={editing}
          onSave={(patch) => {
            onUpdate(editing.id, patch)
            setEditing(null)
          }}
          onDelete={() => {
            onRemove(editing.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
