import { useState } from 'react'
import type { PracticeMenu, SavedPlan } from '../types/menu'
import { planTotal } from '../utils/savedPlans'
import { parseShareText } from '../utils/sharePlan'

type Props = {
  menus: PracticeMenu[]
  onImport: (saved: SavedPlan) => void
  onClose: () => void
}

// 生徒などから送られてきた共有用テキストを貼り付けて、保存済み計画に追加する。
// 今の練習計画は変えない（取り込んだ後、保存済み計画から「この計画を使う」で使える）
export function ImportSharedDialog({ menus, onImport, onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ saved: SavedPlan; missing: string[] } | null>(null)

  const analyze = () => {
    try {
      setResult(parseShareText(text, menus))
      setError('')
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : '読み取れませんでした。')
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 md:grid md:place-items-center md:p-4">
      <div role="dialog" aria-modal="true" aria-label="共有された計画を取り込む" className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl md:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">📥 共有された計画を取り込む</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {result ? (
            <div className="space-y-3">
              <p className="font-bold">この計画を「保存済み練習」に追加します</p>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="break-words text-lg font-bold">{result.saved.title}</p>
                <p className="text-sm text-slate-600">
                  {result.saved.target}・メニュー{result.saved.items.length}個・合計{planTotal(result.saved)}分
                </p>
                <ol className="mt-2 list-decimal space-y-0.5 pl-6 text-sm">
                  {result.saved.items.map((i) => (
                    <li key={i.id} className="break-words">
                      {i.title}（{i.duration}分）
                    </li>
                  ))}
                </ol>
              </div>
              {result.missing.length > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  ⚠ このアプリのメニュー倉庫にないため、次のメニューは取り込みません：{result.missing.join('、')}
                </p>
              )}
              <p className="text-sm text-slate-500">今の練習計画は変わりません。取り込んだ後、保存済み練習から「この計画を使う」で使えます。</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">生徒などから送られてきた「共有用テキスト」を、最後の取り込み用コード（BMW-PLAN: で始まる部分）までまとめて貼り付けてください。</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                aria-label="共有用テキスト"
                placeholder={'🏀 練習計画「…」\n…\nBMW-PLAN:…:END'}
                className={`block w-full resize-y rounded-lg border p-3 font-mono text-sm ${error ? 'border-rose-500' : 'border-slate-300'}`}
              />
              {error && (
                <p role="alert" className="text-sm font-bold break-words text-rose-600">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {result ? (
            <>
              <button type="button" onClick={() => setResult(null)} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
                ← 貼り直す
              </button>
              <button type="button" onClick={() => onImport(result.saved)} className="rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700">
                保存済みに追加
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
                キャンセル
              </button>
              <button type="button" onClick={analyze} disabled={!text.trim()} className="rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40">
                読み取る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
