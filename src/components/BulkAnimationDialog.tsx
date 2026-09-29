import { useMemo, useRef, useState } from 'react'
import { fieldClass } from '../pages/PlanPage'
import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { hasAnimation, hasBrokenAnimation } from '../utils/animation'
import { BULK_BATCH_SIZE, buildBulkAnimationPrompt, parseBulkAnimationAnswer, type BulkParseResult } from '../utils/animationPrompt'
import { ConfirmDialog } from './ConfirmDialog'
import { MenuAnimationDialog } from './MenuAnimationDialog'

type Props = {
  menus: PracticeMenu[]
  // 保存した件数を返す（保存直前に、動きがすでにあるメニューは除外される）
  onSave: (items: { id: string; animation: MenuAnimation }[]) => number
  onClose: () => void
}

// 動きがないメニューを20件ずつClaudeに依頼し、回答をまとめて確認・保存する。
// アプリからAIサービスへは一切アクセスしない。「保存する」を確定するまでメニューは変更しない。すでに動きがあるメニューは対象にしない
export function BulkAnimationDialog({ menus, onSave, onClose }: Props) {
  // 抽出した時点の対象メニュー（この順番で20件ずつ区切る）
  const [sessionIds, setSessionIds] = useState<string[] | null>(null)
  const [batchIndex, setBatchIndex] = useState(0)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<BulkParseResult | null>(null)
  const [preview, setPreview] = useState<{ title: string; animation: MenuAnimation } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const withAnimation = menus.filter(hasAnimation).length
  const broken = menus.filter((m) => !hasAnimation(m) && hasBrokenAnimation(m)).length
  const unset = menus.length - withAnimation
  // 一括作成の対象：動きがなく、壊れた動きのデータも持っていないメニュー
  const eligible = menus.filter((m) => !hasAnimation(m) && !hasBrokenAnimation(m))

  const byId = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus])
  const batchIds = sessionIds ? sessionIds.slice(batchIndex * BULK_BATCH_SIZE, (batchIndex + 1) * BULK_BATCH_SIZE) : []
  // 今回の20件のうち、まだ動きがないもの（保存済み・削除済みは除く）
  const batch = batchIds.map((id) => byId.get(id)).filter((m): m is PracticeMenu => !!m && !hasAnimation(m) && !hasBrokenAnimation(m))
  const prompt = batch.length ? buildBulkAnimationPrompt(batch) : ''
  const batchCount = sessionIds ? Math.ceil(sessionIds.length / BULK_BATCH_SIZE) : 0

  const resetWork = () => {
    setAnswer('')
    setResult(null)
    setCopyStatus('idle')
    setSavedMessage('')
  }
  const extract = () => {
    setSessionIds(eligible.map((m) => m.id))
    setBatchIndex(0)
    resetWork()
  }
  const moveBatch = (index: number) => {
    setBatchIndex(index)
    resetWork()
  }

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

  const check = () => {
    setSavedMessage('')
    setResult(parseBulkAnimationAnswer(answer, batch, menus))
  }

  const save = () => {
    if (!result) return
    const saved = onSave(result.ok.map(({ menu, animation }) => ({ id: menu.id, animation })))
    const left = unset - saved
    setSavedMessage(`${saved}件のアニメーションを保存しました。未設定：${left}件`)
    setAnswer('')
    setResult(null)
    setCopyStatus('idle')
  }

  const start = batchIndex * BULK_BATCH_SIZE + 1
  const end = Math.min((batchIndex + 1) * BULK_BATCH_SIZE, sessionIds?.length ?? 0)
  const btn = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-40 m-0 bg-black/40 md:grid md:place-items-center md:p-4">
      <div role="dialog" aria-modal="true" aria-label="アニメーション一括作成" className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[92vh] md:max-w-3xl md:rounded-2xl md:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">🎬 アニメーション一括作成</h2>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <section aria-label="アニメーション状況" className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-stone-50 p-3">
              <p className="text-xs text-slate-500">設定済み</p>
              <p className="text-xl font-bold">{withAnimation}件</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-xs text-orange-800">未設定</p>
              <p className="text-xl font-bold text-orange-800">{unset}件</p>
            </div>
          </section>
          {broken > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              未設定のうち{broken}件は、読み込めない動きのデータを持っているため一括作成の対象外です（データは変更しません）。
            </p>
          )}

          {savedMessage && (
            <p role="status" className="rounded-lg bg-emerald-50 p-3 font-bold text-emerald-800">
              ✓ {savedMessage}
            </p>
          )}

          {!sessionIds ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-600">
                動きがまだないメニューを{BULK_BATCH_SIZE}件ずつ取り出し、Claudeへの依頼文を作ります。Claudeが返したJSONを貼り付けてチェックし、プレビューで確認してから保存します。すでに動きがあるメニューは変更しません。
              </p>
              <button type="button" onClick={extract} disabled={eligible.length === 0} className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40 sm:w-auto sm:px-6">
                未設定メニューを抽出する（{eligible.length}件）
              </button>
            </div>
          ) : (
            <>
              <section aria-label="現在の処理" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    現在：{start}〜{end}件目 <span className="font-normal text-slate-500">／ 抽出した{sessionIds.length}件</span>
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => moveBatch(batchIndex - 1)} disabled={batchIndex === 0} className={btn}>
                      ← 前の{BULK_BATCH_SIZE}件
                    </button>
                    <button type="button" onClick={() => moveBatch(batchIndex + 1)} disabled={batchIndex >= batchCount - 1} className={btn}>
                      次の{BULK_BATCH_SIZE}件 →
                    </button>
                  </div>
                </div>
                <details className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer px-3 py-2.5 font-bold">
                    対象メニュー（{batch.length}件{batchIds.length > batch.length ? `／保存済み${batchIds.length - batch.length}件` : ''}）
                  </summary>
                  <ul className="divide-y divide-slate-100 border-t border-slate-200">
                    {batchIds.map((id) => {
                      const m = byId.get(id)
                      const done = !m || hasAnimation(m)
                      return (
                        <li key={id} className="px-3 py-2 text-sm">
                          <p className="break-words">
                            <span className="font-mono text-xs text-slate-500">{id}</span> <span className="font-bold">{m?.title ?? '（削除されたメニュー）'}</span>
                            {done && m && <span className="ml-1 text-emerald-700">✓ 保存済み</span>}
                          </p>
                          {m && (
                            <p className="text-xs text-slate-500">
                              {m.category}・{m.difficulty}・{m.targetLevel}・{m.players}・{m.duration}分
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              </section>

              {batch.length === 0 ? (
                <div className="space-y-2 rounded-lg bg-stone-50 p-3">
                  <p className="font-bold">この{BULK_BATCH_SIZE}件は処理が終わりました。</p>
                  {batchIndex < batchCount - 1 ? (
                    <button type="button" onClick={() => moveBatch(batchIndex + 1)} className="rounded-lg bg-orange-600 px-5 py-2.5 font-bold text-white hover:bg-orange-700">
                      次の{BULK_BATCH_SIZE}件へ →
                    </button>
                  ) : (
                    <button type="button" onClick={extract} className="rounded-lg bg-orange-600 px-5 py-2.5 font-bold text-white hover:bg-orange-700">
                      未設定メニューを抽出し直す
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <section aria-label="Claudeに渡すプロンプト" className="space-y-2">
                    <p className="font-bold">Claudeに渡すプロンプト</p>
                    <ol className="list-decimal space-y-0.5 rounded-lg bg-violet-50 py-2 pr-3 pl-8 text-sm text-violet-900">
                      <li>「📋 Claude用プロンプトをコピー」を押します。</li>
                      <li>Claude（アプリまたは claude.ai）に貼り付けて送信します。</li>
                      <li>Claudeが返したJSONを下の欄に貼り付け、「JSONをチェック」を押します。</li>
                    </ol>
                    <textarea
                      ref={promptRef}
                      value={prompt}
                      readOnly
                      rows={6}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Claude用プロンプト"
                      className="block w-full resize-y rounded-lg border border-slate-300 bg-stone-50 p-3 font-mono text-sm leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={copyPrompt} className="w-full rounded-lg bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 sm:w-auto">
                        📋 Claude用プロンプトをコピー
                      </button>
                      <p aria-live="polite" className="text-sm font-bold">
                        {copyStatus === 'copied' && <span className="text-emerald-700">✓ コピーしました</span>}
                        {copyStatus === 'failed' && <span className="text-rose-600">自動でコピーできませんでした。上の文章が全て選ばれた状態なので、そのままコピーしてください。</span>}
                      </p>
                    </div>
                  </section>

                  <section aria-label="ClaudeからのJSON" className="space-y-2 border-t border-slate-200 pt-4">
                    <label className="block space-y-1">
                      <span className="font-bold">Claudeから返ってきたJSONを貼り付けてください</span>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        rows={6}
                        placeholder="Claudeの回答（{ &quot;items&quot;: [ … ] } で始まるJSON）をここに貼り付け"
                        className={`${fieldClass} resize-y font-mono text-sm ${result?.fatal ? 'border-rose-500' : ''}`}
                      />
                    </label>
                    <button type="button" onClick={check} disabled={!answer.trim()} className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40">
                      JSONをチェック
                    </button>
                  </section>

                  {result && (
                    <section aria-label="チェック結果" className="space-y-3">
                      {result.fatal ? (
                        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                          {result.fatal}
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-emerald-50 p-2">
                              <p className="text-xs text-emerald-800">成功</p>
                              <p className="text-lg font-bold text-emerald-800">{result.ok.length}件</p>
                            </div>
                            <div className="rounded-lg bg-rose-50 p-2">
                              <p className="text-xs text-rose-700">エラー</p>
                              <p className="text-lg font-bold text-rose-700">{result.errors.length}件</p>
                            </div>
                            <div className="rounded-lg bg-stone-50 p-2">
                              <p className="text-xs text-slate-500">回答なし</p>
                              <p className="text-lg font-bold text-slate-600">{result.missing.length}件</p>
                            </div>
                          </div>

                          {result.errors.length > 0 && (
                            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                              <p className="font-bold">エラー（保存しません。直す場合はClaudeに問題点を伝えて作り直してもらってください）</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 break-words">
                                {result.errors.map((e, i) => (
                                  <li key={i}>
                                    <span className="font-bold">
                                      {e.menuId}
                                      {e.title ? ` ${e.title}` : ''}
                                    </span>
                                    ：{e.messages.slice(0, 3).join(' ')}
                                    {e.messages.length > 3 && ` ほか${e.messages.length - 3}件`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.missing.length > 0 && (
                            <p className="text-sm text-slate-500">回答なし（Claudeが作らなかったメニュー）：{result.missing.map((m) => m.id).join('、')}。次に抽出したときも未設定として残ります。</p>
                          )}

                          {result.ok.length > 0 && (
                            <div className="space-y-2">
                              <p className="font-bold">保存前のプレビュー</p>
                              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                {result.ok.map(({ menu, animation }) => (
                                  <li key={menu.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                    <p className="min-w-0 text-sm break-words">
                                      <span className="font-mono text-xs text-slate-500">{menu.id}</span> <span className="font-bold">{menu.title}</span>
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setPreview({ title: `${menu.id} ${menu.title}`, animation })}
                                      className="shrink-0 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50"
                                    >
                                      🎬 アニメーションを見る
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <button type="button" onClick={() => setConfirming(true)} className="w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">
                                ✓ {result.ok.length}件を保存
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
              <p className="text-sm text-slate-500">「保存する」を押すまで、メニューは変更されません。このアプリからAIサービスへ自動でアクセスすることはありません。</p>
            </>
          )}
        </div>
      </div>

      {preview && (
        <MenuAnimationDialog title={preview.title} animation={preview.animation} label="🎬 プレビュー（まだ保存されていません）" onClose={() => setPreview(null)} />
      )}

      <ConfirmDialog
        open={confirming}
        message={`${result?.ok.length ?? 0}件のメニューに動きを保存しますか？`}
        note="保存するのは、チェックに通ったメニューだけです。すでに動きがあるメニューは変更しません。"
        confirmLabel="保存する"
        tone="primary"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          save()
        }}
      />
    </div>
  )
}
