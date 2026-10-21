import { useRef, useState } from 'react'

// 共有用テキストをコピーするボタン。自動でコピーできない環境では、文章を表示して手でコピーしてもらう
export function ShareButton({ getText, disabled }: { getText: () => string; disabled?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copied'>('idle')
  const [manualText, setManualText] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const copy = async () => {
    const text = getText()
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setManualText(text)
      setTimeout(() => ref.current?.select(), 0)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={copy}
        title="LINE・Classroom などに貼り付けて送れる文章をコピーします"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        {status === 'copied' ? '✓ コピーしました' : '📤 共有用にコピー'}
      </button>
      {manualText !== null && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={() => setManualText(null)}>
          <div role="dialog" aria-modal="true" aria-label="共有用テキスト" className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">共有用テキスト</p>
            <p className="text-sm text-slate-600">自動でコピーできませんでした。下の文章が全部選ばれた状態なので、そのままコピーして送ってください。</p>
            <textarea
              ref={ref}
              value={manualText}
              readOnly
              rows={10}
              onFocus={(e) => e.currentTarget.select()}
              className="block w-full resize-y rounded-lg border border-slate-300 bg-stone-50 p-3 font-mono text-sm"
            />
            <button type="button" onClick={() => setManualText(null)} className="w-full rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
