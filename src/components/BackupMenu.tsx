import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { PracticeMenu, PracticePlan, SavedPlan } from '../types/menu'
import { exportMenus, parseBackup, type BackupData } from '../utils/backup'
import { ConfirmDialog } from './ConfirmDialog'

type Props = { menus: PracticeMenu[]; plan: PracticePlan; savedPlans: SavedPlan[]; onImport: (data: BackupData) => void }

export function BackupMenu({ menus, plan, savedPlans, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
        <span className="text-lg">⚙</span>
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
                exportMenus(menus, plan, savedPlans)
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
            <p className="px-3 pb-2 pt-1 text-xs text-slate-500">JSONファイルでバックアップ・復元できます。</p>
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />

      <ConfirmDialog
        open={pending !== null}
        message={'現在保存されているメニューを、読み込んだデータで置き換えます。\nよろしいですか？'}
        note={`読み込むメニュー：${pending?.menus.length ?? 0}件（現在：${menus.length}件）${pending?.plan ? `／練習計画：${pending.plan.items.length}件` : ''}${pending?.savedPlans ? `／保存済み計画：${pending.savedPlans.length}件` : ''}`}
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
