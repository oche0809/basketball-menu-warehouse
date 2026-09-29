type Props = {
  open: boolean
  message: string
  note?: string
  confirmLabel: string
  // 'primary' は削除ではない主要な操作（アプリ共通のオレンジ）。既定は危険操作の赤
  tone?: 'danger' | 'primary'
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ open, message, note = 'この操作は元に戻せません。', confirmLabel, tone = 'danger', onCancel, onConfirm }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="whitespace-pre-line text-lg font-bold">{message}</p>
        <p className="mt-1 text-sm text-slate-500">{note}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg py-3 font-bold text-white ${tone === 'primary' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
