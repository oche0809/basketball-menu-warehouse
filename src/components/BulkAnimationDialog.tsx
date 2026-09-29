import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, DIFFICULTIES } from '../data/options'
import { fieldClass } from '../pages/PlanPage'
import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { hasAnimation, hasBrokenAnimation } from '../utils/animation'
import { BULK_BATCH_SIZE, buildBulkAnimationPrompt, parseBulkAnimationAnswer, type BulkParseResult } from '../utils/animationPrompt'
import { checkAnimationQuality } from '../utils/animationQuality'
import { officialAdoptError } from '../utils/officialAnimations'
import { ConfirmDialog } from './ConfirmDialog'
import { FeatureChips, QualityBadge } from './AnimationQualityView'
import { MenuAnimationDialog } from './MenuAnimationDialog'

type SaveItem = { id: string; animation: MenuAnimation }

type Props = {
  menus: PracticeMenu[]
  // 公式の採用待ちに入っているメニュー（抽出の対象から外す）
  draftIds: Set<string>
  // このブラウザだけに保存。保存した件数を返す（保存直前に、動きがすでにあるメニューは除外される）
  onSave: (items: SaveItem[]) => number
  // 公式アニメーションの採用待ちに入れる。入れた件数を返す
  onAdopt: (items: SaveItem[]) => number
}

const ALL = 'すべて'

// 動きがないメニューを20件ずつClaudeに依頼し、回答をまとめて確認して、公式として採用（またはこのブラウザに保存）する。
// アプリからAIサービスへは一切アクセスしない。ボタンを押して確定するまでメニューは変更しない。すでに動きがあるメニューは対象にしない
export function BulkAnimationPanel({ menus, draftIds, onSave, onAdopt }: Props) {
  const [category, setCategory] = useState(ALL)
  const [difficulty, setDifficulty] = useState(ALL)
  // 抽出した時点の対象メニュー（この順番で20件ずつ区切る）
  const [sessionIds, setSessionIds] = useState<string[] | null>(null)
  const [batchIndex, setBatchIndex] = useState(0)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<BulkParseResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ title: string; animation: MenuAnimation } | null>(null)
  const [confirming, setConfirming] = useState<'adopt' | 'save' | null>(null)
  const [savedMessage, setSavedMessage] = useState('')

  // 一括作成の対象になれるか：動きがなく、壊れた動きのデータもなく、採用待ちにも入っていない
  const open = (m: PracticeMenu) => !hasAnimation(m) && !hasBrokenAnimation(m) && !draftIds.has(m.id)
  const eligible = menus.filter((m) => open(m) && (category === ALL || m.category === category) && (difficulty === ALL || m.difficulty === difficulty))

  const byId = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus])
  const batchIds = sessionIds ? sessionIds.slice(batchIndex * BULK_BATCH_SIZE, (batchIndex + 1) * BULK_BATCH_SIZE) : []
  // 今回の20件のうち、まだ動きがないもの（保存済み・採用待ち・削除済みは除く）
  const batch = batchIds.map((id) => byId.get(id)).filter((m): m is PracticeMenu => !!m && open(m))
  const prompt = batch.length ? buildBulkAnimationPrompt(batch) : ''
  const batchCount = sessionIds ? Math.ceil(sessionIds.length / BULK_BATCH_SIZE) : 0

  const resetWork = () => {
    setAnswer('')
    setResult(null)
    setSelected(new Set())
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
    const parsed = parseBulkAnimationAnswer(answer, batch, menus)
    setResult(parsed)
    setSelected(new Set(parsed.ok.map(({ menu }) => menu.id)))
  }

  const chosen = result ? result.ok.filter(({ menu }) => selected.has(menu.id)) : []
  const adoptable = chosen.filter(({ menu }) => !officialAdoptError(menu.id))
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const finish = (message: string) => {
    setSavedMessage(message)
    setAnswer('')
    setResult(null)
    setSelected(new Set())
    setCopyStatus('idle')
  }
  const adopt = () => {
    const n = onAdopt(adoptable.map(({ menu, animation }) => ({ id: menu.id, animation })))
    finish(`${n}件を公式アニメーションの採用待ちに追加しました。「公式データ」タブから書き出してGitHubに反映すると、全員に公開されます。`)
  }
  const save = () => {
    const n = onSave(chosen.map(({ menu, animation }) => ({ id: menu.id, animation })))
    finish(`${n}件のアニメーションをこのブラウザに保存しました（公式ではありません）。`)
  }

  const start = batchIndex * BULK_BATCH_SIZE + 1
  const end = Math.min((batchIndex + 1) * BULK_BATCH_SIZE, sessionIds?.length ?? 0)
  const btn = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40'
  const select = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base'

  return (
    <div className="space-y-4">
      {savedMessage && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 font-bold text-emerald-800">
          ✓ {savedMessage}
        </p>
      )}

      {!sessionIds ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            動きがまだないメニューを{BULK_BATCH_SIZE}
            件ずつ取り出し、Claudeへの依頼文を作ります。Claudeが返したJSONを貼り付けてチェックし、プレビューと品質を確認してから、公式として採用します。すでに動きがあるメニューは変更しません。
          </p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <label className="space-y-1 text-sm font-bold text-slate-700">
              <span className="block">カテゴリ</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${select} w-full`}>
                {[ALL, ...CATEGORIES].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-bold text-slate-700">
              <span className="block">難易度</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${select} w-full`}>
                {[ALL, ...DIFFICULTIES].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={extract}
            disabled={eligible.length === 0}
            className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40 sm:w-auto sm:px-6"
          >
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
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => moveBatch(batchIndex - 1)} disabled={batchIndex === 0} className={btn}>
                  ← 前の{BULK_BATCH_SIZE}件
                </button>
                <button type="button" onClick={() => moveBatch(batchIndex + 1)} disabled={batchIndex >= batchCount - 1} className={btn}>
                  次の{BULK_BATCH_SIZE}件 →
                </button>
                <button type="button" onClick={() => setSessionIds(null)} className={btn}>
                  条件を変える
                </button>
              </div>
            </div>
            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-3 py-2.5 font-bold">
                対象メニュー（{batch.length}件{batchIds.length > batch.length ? `／処理済み${batchIds.length - batch.length}件` : ''}）
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-200">
                {batchIds.map((id) => {
                  const m = byId.get(id)
                  return (
                    <li key={id} className="px-3 py-2 text-sm">
                      <p className="break-words">
                        <span className="font-mono text-xs text-slate-500">{id}</span> <span className="font-bold">{m?.title ?? '（削除されたメニュー）'}</span>
                        {m && draftIds.has(id) && <span className="ml-1 text-violet-700">🎬 採用待ち</span>}
                        {m && hasAnimation(m) && <span className="ml-1 text-emerald-700">✓ 保存済み</span>}
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
                    placeholder='Claudeの回答（{ "items": [ … ] } で始まるJSON）をここに貼り付け'
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
                          <p className="font-bold">❌ エラー（保存できません。直す場合はClaudeに問題点を伝えて作り直してもらってください）</p>
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
                          <p className="font-bold">プレビューと品質の確認（採用するものを選んでください）</p>
                          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {result.ok.map(({ menu, animation }) => {
                              const q = checkAnimationQuality(animation, menu.category)
                              const adoptError = officialAdoptError(menu.id)
                              return (
                                <li key={menu.id} className="space-y-1.5 px-3 py-2.5">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                                      <input type="checkbox" checked={selected.has(menu.id)} onChange={() => toggle(menu.id)} className="mt-0.5 size-5 shrink-0 accent-orange-600" />
                                      <span className="min-w-0 break-words">
                                        <span className="font-mono text-xs text-slate-500">{menu.id}</span> <span className="font-bold">{menu.title}</span>
                                        <span className="ml-1 text-xs text-slate-500">（{menu.category}）</span>
                                      </span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setPreview({ title: `${menu.id} ${menu.title}`, animation })}
                                      className="shrink-0 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50"
                                    >
                                      🎬 見る
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 pl-7">
                                    <QualityBadge level={q.level} />
                                    <FeatureChips features={q.features} />
                                    <span className="text-xs text-slate-500">
                                      選手{q.counts.players}人・STEP {q.counts.steps}・動き{q.counts.actions}
                                    </span>
                                  </div>
                                  {q.warnings.length > 0 && <p className="pl-7 text-xs text-amber-800">⚠️ {q.warnings.join(' ')}</p>}
                                  {adoptError && <p className="pl-7 text-xs text-slate-500">※ 公式にはできません：{adoptError}</p>}
                                </li>
                              )
                            })}
                          </ul>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setConfirming('adopt')}
                              disabled={adoptable.length === 0}
                              className="rounded-lg bg-emerald-600 px-3 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                            >
                              🎬 公式アニメーションとして採用（{adoptable.length}件）
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming('save')}
                              disabled={chosen.length === 0}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              選択したアニメーションをこのブラウザに保存（{chosen.length}件）
                            </button>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-500">
                            「公式として採用」は採用待ちに入るだけで、すぐには公開されません。「公式データ」タブで書き出し、GitHubに反映すると全員に表示されます。「このブラウザに保存」は自分の端末だけで使う動きです。
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}
          <p className="text-sm text-slate-500">ボタンを押して確定するまで、メニューは変更されません。このアプリからAIサービスやGitHubへ自動でアクセスすることはありません。</p>
        </>
      )}

      {preview && <MenuAnimationDialog title={preview.title} animation={preview.animation} label="🎬 プレビュー（まだ保存されていません）" onClose={() => setPreview(null)} />}

      <ConfirmDialog
        open={confirming !== null}
        message={confirming === 'adopt' ? `${adoptable.length}件を公式アニメーションとして採用しますか？` : `${chosen.length}件の動きをこのブラウザに保存しますか？`}
        note={
          confirming === 'adopt'
            ? '採用待ちに入ります。「公式データ」タブで書き出してGitHubに反映するまで、ほかの人には表示されません。'
            : 'このブラウザだけに保存されます（公式ではありません）。すでに動きがあるメニューは変更しません。'
        }
        confirmLabel={confirming === 'adopt' ? '採用する' : '保存する'}
        tone="primary"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const mode = confirming
          setConfirming(null)
          if (mode === 'adopt') adopt()
          else save()
        }}
      />
    </div>
  )
}
