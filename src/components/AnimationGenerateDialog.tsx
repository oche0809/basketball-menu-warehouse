import { useMemo, useRef, useState } from 'react'
import { fieldClass } from '../pages/PlanPage'
import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { buildAnimationPrompt, buildAnimationRevisionPrompt, parseAnimationAnswer } from '../utils/animationPrompt'
import { ConfirmDialog } from './ConfirmDialog'
import { MenuAnimationDialog } from './MenuAnimationDialog'

type Props = {
  menu: PracticeMenu
  // 今の動き。渡すと「修正」モード（修正内容の入力 → 修正用の依頼文）になる
  current?: MenuAnimation
  onSave: (animation: MenuAnimation) => void
  onClose: () => void
}

// メニュー →（修正のときは修正内容の入力 →）Claudeへの依頼文 → 回答の貼り付けと確認 → プレビュー → 保存。
// アプリからAIサービスへは一切アクセスしない。「保存する」を確定するまでメニュー（今の動き）は変更しない
export function AnimationGenerateDialog({ menu, current, onSave, onClose }: Props) {
  const revising = !!current
  const [request, setRequest] = useState('')
  // 「依頼文を作る」で確定した修正内容（null＝まだ入力中。新規作成では使わない）
  const [submitted, setSubmitted] = useState<string | null>(revising ? null : '')
  const requested = submitted !== null
  const prompt = useMemo(() => (current ? (submitted !== null ? buildAnimationRevisionPrompt(menu, current, submitted) : '') : buildAnimationPrompt(menu)), [menu, current, submitted])
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [answer, setAnswer] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<MenuAnimation | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('copied')
    } catch {
      promptRef.current?.focus()
      promptRef.current?.select()
      setCopyStatus('failed')
    }
  }

  const analyzeAnswer = () => {
    try {
      const result = parseAnimationAnswer(answer)
      setErrors(result.errors)
      if (result.animation) {
        setPreview(result.animation)
        setPreviewKey((k) => k + 1)
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Claudeの回答を読み取れませんでした。'])
    }
  }

  const makePrompt = () => {
    if (!request.trim()) return
    setSubmitted(request)
    setCopyStatus('idle')
  }
  const backToRequest = () => {
    setSubmitted(null)
    setAnswer('')
    setErrors([])
    setCopyStatus('idle')
  }
  const heading = revising ? '✏️ 動きを修正する' : '🎬 動きを作る'

  const info = [
    ['カテゴリ', menu.category],
    ['人数', menu.players || '—'],
    ['時間', `${menu.duration}分`],
  ]

  return (
    <div className="fixed inset-0 z-40 m-0 bg-black/40 md:grid md:place-items-center md:p-4">
      <div role="dialog" aria-modal="true" aria-label={heading} className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-2xl md:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-orange-700">{heading}</p>
            <h2 className="truncate text-lg font-bold">{menu.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <dl className="grid grid-cols-3 gap-2">
            {info.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg bg-stone-50 p-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm font-bold break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {!requested ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                現在の動き（選手{current?.players.length}人・STEP {current?.steps.length}個）をもとに修正します。今の動きは「🎬 動きを見る」で確認できます。
              </p>
              <div className="text-sm text-slate-600">
                <p>修正したい内容を、ふだんの言葉で入力してください。例：</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>パスをもう少し分かりやすくしてください</li>
                  <li>2人目の選手が動く方向を逆にしてください</li>
                  <li>ドリブルしてからシュートする流れにしてください</li>
                  <li>選手同士が重なっているので離してください</li>
                  <li>中学生にも分かりやすい動きにしてください</li>
                </ul>
              </div>
              <label className="block space-y-1">
                <span className="font-bold">
                  修正内容<span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">必須</span>
                </span>
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="例：最初のパスをなくして、ドリブルから始まるようにしてください。"
                  className={`${fieldClass} resize-y`}
                />
              </label>
              <p className="text-sm text-slate-500">「保存する」を押すまで、今の動きはそのまま残ります。</p>
            </div>
          ) : (
            <>
              <ol className="list-decimal space-y-0.5 rounded-lg bg-violet-50 py-2 pr-3 pl-8 text-sm text-violet-900">
                <li>「📋 Claudeへの依頼文をコピー」を押します。</li>
                <li>Claude（アプリまたは claude.ai）に貼り付けて送信します。</li>
                <li>Claudeの回答を下の欄に貼り付け、「回答を解析する」を押します。</li>
                <li>プレビューで動きを確認し、よければ「✓ この動きを保存」を押します。</li>
              </ol>
              <textarea
                ref={promptRef}
                value={prompt}
                readOnly
                rows={6}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Claudeへの依頼文"
                className="block w-full resize-y rounded-lg border border-slate-300 bg-stone-50 p-3 font-mono text-sm leading-relaxed"
              />
              <p aria-live="polite" className="min-h-5 text-sm font-bold">
                {copyStatus === 'copied' && <span className="text-emerald-700">✓ コピーしました</span>}
                {copyStatus === 'failed' && <span className="text-rose-600">自動でコピーできませんでした。上の文章が全て選ばれた状態なので、そのままコピーしてください。</span>}
              </p>
              <label className="block space-y-1 border-t border-slate-200 pt-3">
                <span className="font-bold">Claudeの回答を貼り付けてください</span>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={6}
                  placeholder='Claudeの回答（{ "animation": … } で始まるJSON）をここに貼り付け'
                  className={`${fieldClass} resize-y font-mono text-sm ${errors.length ? 'border-rose-500' : ''}`}
                />
              </label>
              {errors.length > 0 && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="font-bold">この回答は使えません（{errors.length}件の問題）。Claudeに問題点を伝えて作り直してもらってください。</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 break-words">
                    {errors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {errors.length > 20 && <li>ほか {errors.length - 20} 件</li>}
                  </ul>
                </div>
              )}
              <button type="button" onClick={analyzeAnswer} disabled={!answer.trim()} className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40">
                回答を解析する
              </button>
              <p className="text-sm text-slate-500">
                {revising ? '今の動きは、修正後の動きを保存するまでそのまま残ります。' : '「この動きを保存」を押すまで、メニューは変更されません。'}
                このアプリからAIサービスへ自動でアクセスすることはありません。
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={revising && requested ? backToRequest : onClose}
            className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1"
          >
            {revising && requested ? '← 修正内容を変える' : 'キャンセル'}
          </button>
          {requested ? (
            <button type="button" onClick={copyPrompt} className="order-1 col-span-2 rounded-lg bg-violet-600 px-2 py-3 font-bold text-white hover:bg-violet-700 md:order-2 md:col-span-1">
              📋 Claudeへの依頼文をコピー
            </button>
          ) : (
            <button
              type="button"
              onClick={makePrompt}
              disabled={!request.trim()}
              className="order-1 col-span-2 rounded-lg bg-violet-600 px-2 py-3 font-bold text-white hover:bg-violet-700 disabled:opacity-40 md:order-2 md:col-span-1"
            >
              依頼文を作る
            </button>
          )}
        </div>
      </div>

      {preview && (
        <MenuAnimationDialog
          key={previewKey}
          title={menu.title}
          animation={preview}
          label={revising ? '✏️ 修正後のプレビュー（未保存）' : '🎬 プレビュー（まだ保存されていません）'}
          onClose={() => setPreview(null)}
          footer={
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPreview(null)} className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1">
                  ← 回答を修正する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="order-1 col-span-2 rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 md:order-2 md:col-span-1"
                >
                  ✓ この動きを保存
                </button>
              </div>
              <ConfirmDialog
                open={confirming}
                message={revising ? 'この修正後のアニメーションを保存しますか？' : 'この動きをメニューに保存しますか？'}
                note={revising ? '現在のアニメーションは修正後の内容に置き換わります。' : '保存した動きは「🎬 動きを見る」で確認できます。バックアップにも含まれます。'}
                confirmLabel="保存する"
                tone="primary"
                onCancel={() => setConfirming(false)}
                onConfirm={() => {
                  setConfirming(false)
                  onSave(preview)
                }}
              />
            </>
          }
        />
      )}
    </div>
  )
}
