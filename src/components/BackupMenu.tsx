import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { PracticeLogEntry, PracticeMenu, PracticePlan, SavedPlan } from '../types/menu'
import { exportMenus, parseBackup, type BackupData } from '../utils/backup'
import { useBackupStatus } from '../utils/dataSafety'
import type { PlayersData } from '../utils/players'
import { ConfirmDialog } from './ConfirmDialog'

type ExportData = { menus: PracticeMenu[]; plan: PracticePlan; savedPlans: SavedPlan[]; practiceLog: PracticeLogEntry[]; playersData: PlayersData }
type Props = ExportData & { onImport: (data: BackupData) => void }

const lastBackupText = (daysSince: number | null) =>
  daysSince === null ? 'まだバックアップしていません' : daysSince === 0 ? '最後のバックアップ：今日' : `最後のバックアップ：${daysSince}日前`

// ホーム・練習計画の上に出す、バックアップのお知らせ（最後のバックアップから BACKUP_REMIND_DAYS 日以上たったとき）
export function BackupReminder({ menus, plan, savedPlans, practiceLog, playersData }: ExportData) {
  const { daysSince, due, snoozed, snooze } = useBackupStatus()
  const [done, setDone] = useState(false)
  if (done) {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
        ✓ バックアップファイルを保存しました。Googleドライブやパソコンなど、別の場所にも置いておくと安心です。
      </p>
    )
  }
  if (!due || snoozed) return null
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="font-bold">💾 {daysSince === null ? 'データのバックアップをとっておきましょう' : `最後のバックアップから${daysSince}日たっています`}</p>
      <p className="mt-1 text-sm">
        メニュー・練習計画・実施記録は、この端末のブラウザの中だけに保存されています。端末の故障や機種変更、ブラウザの自動削除に備えて、ファイルに書き出しておきましょう。
        <span className="mt-1 block text-xs text-amber-800">iPhone は Safari の共有ボタンから「ホーム画面に追加」して使うと、データが消えにくくなります。</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            exportMenus(menus, plan, savedPlans, practiceLog, playersData)
            setDone(true)
          }}
          className="rounded-lg bg-amber-600 px-4 py-2.5 font-bold text-white hover:bg-amber-700"
        >
          📤 今すぐバックアップ
        </button>
        <button type="button" onClick={snooze} className="rounded-lg border border-amber-300 bg-white px-4 py-2.5 font-bold text-amber-800 hover:bg-amber-100">
          あとで（3日後に再表示）
        </button>
      </div>
    </section>
  )
}

export function BackupMenu({ menus, plan, savedPlans, practiceLog, playersData, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { daysSince, due, persisted } = useBackupStatus()

  // ページを移動したらメニューを閉じる
  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const loaded = parseBackup(await file.text())
    if (loaded) setPending(loaded)
    else setNotice({ text: 'このファイルはメニュー倉庫のデータとして読み込めません。', error: true })
  }

  const itemClass = 'w-full rounded-lg px-3 py-3 text-left font-medium hover:bg-orange-50'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="データのバックアップ"
        className="flex h-11 items-center gap-1 rounded-lg px-3 font-medium text-slate-600 hover:bg-slate-100"
      >
        <span className="relative text-lg">
          ⚙{due && <span className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />}
        </span>
        <span className="hidden lg:inline">データ</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                exportMenus(menus, plan, savedPlans, practiceLog, playersData)
                setOpen(false)
                setNotice({ text: `${menus.length}件のメニューを書き出しました。` })
              }}
            >
              📤 データを書き出す
            </button>
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false)
                fileRef.current?.click()
              }}
            >
              📥 データを読み込む
            </button>
            <p className="px-3 pb-1 pt-1 text-xs text-slate-500">JSONファイルでバックアップ・復元できます。</p>
            <p className={`px-3 text-xs font-bold ${due ? 'text-amber-700' : 'text-emerald-700'}`}>{lastBackupText(daysSince)}</p>
            {persisted !== null && (
              <p className="px-3 pb-2 text-xs text-slate-500">
                {persisted ? '✓ このブラウザはデータを自動で消さない設定です' : '⚠ ブラウザがデータを自動で消す場合があります。こまめにバックアップしてください'}
              </p>
            )}
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />

      <ConfirmDialog
        open={pending !== null}
        message={'現在保存されているメニューを、読み込んだデータで置き換えます。\nよろしいですか？'}
        note={`読み込むメニュー：${pending?.menus.length ?? 0}件（現在：${menus.length}件）${pending?.plan ? `／練習計画：${pending.plan.items.length}件` : ''}${pending?.savedPlans ? `／保存済み計画：${pending.savedPlans.length}件` : ''}${pending?.practiceLog ? `／実施記録：${pending.practiceLog.length}件` : ''}${pending?.playersData ? `／選手：${pending.playersData.players.length}人` : ''}`}
        confirmLabel="読み込む"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          onImport(pending)
          setNotice({ text: `${pending.menus.length}件のメニューを読み込みました。` })
          setPending(null)
        }}
      />

      {notice && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl px-4 py-3 text-center font-bold text-white shadow-lg md:bottom-8 ${
            notice.error ? 'bg-rose-600' : 'bg-slate-800'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  )
}
