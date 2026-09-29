import { useRef, useState } from 'react'
import { DIFFICULTIES } from '../data/options'
import { TimeSummary, fieldClass } from '../pages/PlanPage'
import { ConfirmDialog } from './ConfirmDialog'
import type { AIPlanConditions, AIPlanProposal, PracticeMenu } from '../types/menu'
import { buildClaudePrompt, parseClaudeAnswer, selectCandidates } from '../utils/aiPlan'
import { buildOptions } from '../utils/filters'
import { PLAN_TARGETS } from '../utils/plan'

const ANY_DIFFICULTY = '指定なし'

type Form = Omit<AIPlanConditions, 'players' | 'plannedDuration'> & { players: string; plannedDuration: string }
type Errors = Partial<Record<'targetLevel' | 'players' | 'plannedDuration', string>>

function validate(f: Form): { errors: Errors; conditions: AIPlanConditions | null } {
  const errors: Errors = {}
  const players = Number(f.players)
  const minutes = Number(f.plannedDuration)
  if (!PLAN_TARGETS.includes(f.targetLevel)) errors.targetLevel = '対象を選んでください。'
  if (f.players.trim() === '' || !Number.isInteger(players) || players < 1 || players > 999) errors.players = '人数は1〜999の整数で入力してください。'
  if (f.plannedDuration.trim() === '' || !Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
    errors.plannedDuration = '練習時間は5〜600分で入力してください。'
  } else if (minutes % 5 !== 0) {
    errors.plannedDuration = '練習時間は5分単位で入力してください（例：90分）。'
  }
  if (Object.keys(errors).length > 0) return { errors, conditions: null }
  return {
    errors,
    conditions: {
      ...f,
      theme: f.theme.trim(),
      focus: f.focus.trim(),
      request: f.request.trim(),
      players,
      plannedDuration: minutes,
    },
  }
}

const Label = ({ children, required }: { children: string; required?: boolean }) => (
  <span className="text-sm font-bold text-slate-700">
    {children}
    <span className={`ml-1.5 rounded px-1.5 py-0.5 text-xs ${required ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{required ? '必須' : '任意'}</span>
  </span>
)

const ErrorText = ({ text }: { text?: string }) => (text ? <p className="text-sm font-bold text-rose-600">{text}</p> : null)

// AIの提案の表示。メニュー名・カテゴリは AI の返答ではなく、menuId から今のメニュー倉庫を見て表示する
// Phase 7-3（Claudeの回答の取り込み）で使う
export function ProposalView({ proposal, warnings, conditions, menus }: { proposal: AIPlanProposal; warnings: string[]; conditions: AIPlanConditions; menus: PracticeMenu[] }) {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const total = proposal.items.reduce((sum, i) => sum + i.duration, 0)
  return (
    <div className="space-y-3">
      <p className="text-lg font-bold">🤖 Claudeが作成した練習計画</p>
      <p className="text-sm text-slate-600">
        {[conditions.targetLevel, `${conditions.players}人`, `${conditions.plannedDuration}分`, conditions.theme, conditions.focus].filter(Boolean).join('・')}
      </p>
      {proposal.summary && <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 break-words whitespace-pre-wrap text-violet-900">{proposal.summary}</p>}
      <TimeSummary planned={conditions.plannedDuration} total={total} />
      {warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
      <ol className="space-y-2">
        {proposal.items.map((item, i) => {
          const menu = menuMap.get(item.menuId)
          return (
            <li key={`${item.menuId}-${i}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 font-bold text-violet-800">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-bold">{menu?.title}</p>
                  <p className="text-sm text-slate-500">{menu?.category}</p>
                </div>
                <p className="shrink-0 font-bold">{item.duration}分</p>
              </div>
              {item.reason && <p className="mt-2 break-words whitespace-pre-wrap text-sm text-slate-700 md:ml-11">{item.reason}</p>}
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-slate-500">この提案はまだ現在の練習計画に反映されていません。「この計画を使う」を押すまで、現在の練習計画は変わりません。</p>
    </div>
  )
}

type Props = {
  menus: PracticeMenu[]
  initial: { target: string; players: number; plannedDuration: number }
  onApply: (proposal: AIPlanProposal, conditions: AIPlanConditions) => void
  onClose: () => void
}

// Claudeに依頼する条件の入力 → 確認 → 依頼文の作成とコピー → 回答の貼り付けと確認 → 取り込み。
// AIサービスには一切通信しない。「この計画を使う」を確定するまで現在の練習計画は変更しない
export function AIPlanDialog({ menus, initial, onApply, onClose }: Props) {
  const [form, setForm] = useState<Form>({
    targetLevel: PLAN_TARGETS.includes(initial.target) ? initial.target : PLAN_TARGETS[0],
    players: initial.players > 0 ? String(initial.players) : '',
    plannedDuration: String(initial.plannedDuration),
    theme: '',
    focus: '',
    equipment: [],
    difficulty: ANY_DIFFICULTY,
    request: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [confirmed, setConfirmed] = useState<AIPlanConditions | null>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  // 貼り付けた回答は、条件を直したり解析をやり直したりしても消さない
  const [answer, setAnswer] = useState('')
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState<{ proposal: AIPlanProposal; warnings: string[] } | null>(null)
  const [confirmingUse, setConfirmingUse] = useState(false)

  // 回答を読み取って提案として表示する（ここでは現在の練習計画を変更しない）
  const analyzeAnswer = () => {
    try {
      setResult(parseClaudeAnswer(answer, menus))
      setParseError('')
    } catch (e) {
      setResult(null)
      setParseError(e instanceof Error ? e.message : 'Claudeの回答を読み取れませんでした。')
    }
  }

  const close = () => onClose()

  // 条件と、メニュー倉庫から選んだ候補で依頼文を作る（通信はしない）
  const makePrompt = () => {
    if (!confirmed) return
    setPrompt(buildClaudePrompt(confirmed, selectCandidates(menus, confirmed)))
    setCopyStatus('idle')
  }

  // ブラウザ標準の機能でコピー。使えない環境では文章を全選択して手動コピーしてもらう
  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('copied')
    } catch {
      promptRef.current?.focus()
      promptRef.current?.select()
      setCopyStatus('failed')
    }
  }

  const backToEdit = () => {
    setPrompt(null)
    setConfirmed(null)
  }
  const equipmentOptions = buildOptions(menus).equipment

  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const toggleEquipment = (e: string) =>
    update({ equipment: form.equipment.includes(e) ? form.equipment.filter((x) => x !== e) : [...form.equipment, e] })

  const goConfirm = () => {
    const result = validate(form)
    setErrors(result.errors)
    setConfirmed(result.conditions)
  }

  const summary: [string, string][] = confirmed
    ? [
        ['対象', confirmed.targetLevel],
        ['人数', `${confirmed.players}人`],
        ['練習時間', `${confirmed.plannedDuration}分`],
        ['テーマ', confirmed.theme || '指定なし'],
        ['伸ばしたいこと', confirmed.focus || '指定なし'],
        ['道具', confirmed.equipment.length > 0 ? confirmed.equipment.join('、') : '指定なし'],
        ['難易度', confirmed.difficulty],
        ['その他', confirmed.request || 'なし'],
      ]
    : []

  return (
    <div className="fixed inset-0 z-40 bg-black/40 md:grid md:place-items-center md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Claudeで練習計画を作る"
        className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-2xl md:shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">🤖 Claudeで練習計画を作る</h2>
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {result && confirmed ? (
            <ProposalView proposal={result.proposal} warnings={result.warnings} conditions={confirmed} menus={menus} />
          ) : prompt ? (
            <div className="space-y-3">
              <p className="text-lg font-bold">Claudeへの依頼文</p>
              <ol className="list-decimal space-y-0.5 rounded-lg bg-violet-50 py-2 pr-3 pl-8 text-sm text-violet-900">
                <li>下の「📋 Claudeへの依頼文をコピー」を押します。</li>
                <li>Claude（アプリまたは claude.ai）を開いて貼り付け、送信します。</li>
                <li>Claudeの回答をコピーして、下の欄に貼り付け、「回答を解析する」を押します。</li>
              </ol>
              <textarea
                ref={promptRef}
                value={prompt}
                readOnly
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Claudeへの依頼文"
                className="block w-full resize-y rounded-lg border border-slate-300 bg-stone-50 p-3 font-mono text-sm leading-relaxed"
              />
              <p aria-live="polite" className="min-h-5 text-sm font-bold">
                {copyStatus === 'copied' && <span className="text-emerald-700">✓ コピーしました</span>}
                {copyStatus === 'failed' && (
                  <span className="text-rose-600">自動でコピーできませんでした。上の文章が全て選ばれた状態なので、そのままコピーしてください。</span>
                )}
              </p>
              <label className="block space-y-1 border-t border-slate-200 pt-3">
                <span className="font-bold">Claudeの回答を貼り付けてください</span>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={6}
                  placeholder="Claudeの回答（{ &quot;summary&quot;: … } で始まるJSON）をここに貼り付け"
                  className={`${fieldClass} resize-y font-mono text-sm ${parseError ? 'border-rose-500' : ''}`}
                />
              </label>
              {parseError && (
                <p role="alert" className="text-sm font-bold break-words text-rose-600">
                  {parseError}
                </p>
              )}
              <button
                type="button"
                onClick={analyzeAnswer}
                disabled={!answer.trim()}
                className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40"
              >
                回答を解析する
              </button>
              <p className="text-sm text-slate-500">この画面からAIサービスへ自動で送信されることはありません。「この計画を使う」を押すまで、現在の練習計画は変更されません。</p>
            </div>
          ) : confirmed ? (
            <div className="space-y-3">
              <p className="font-bold">Claudeに依頼する条件</p>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {summary.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2 px-3 py-2.5">
                    <dt className="text-sm font-bold text-slate-500">{label}</dt>
                    <dd className="min-w-0 break-words whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-slate-500">この条件と、メニュー倉庫から選んだ候補メニューをまとめて、Claudeに貼り付ける依頼文を作ります。現在の練習計画は変更されません。</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <label className="col-span-2 block space-y-1 md:col-span-1">
                  <Label required>対象</Label>
                  <select value={form.targetLevel} onChange={(e) => update({ targetLevel: e.target.value })} aria-invalid={!!errors.targetLevel} className={fieldClass}>
                    {PLAN_TARGETS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <ErrorText text={errors.targetLevel} />
                </label>
                <label className="block space-y-1">
                  <Label required>人数（人）</Label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={999}
                    value={form.players}
                    onChange={(e) => update({ players: e.target.value })}
                    aria-invalid={!!errors.players}
                    className={`${fieldClass} ${errors.players ? 'border-rose-500' : ''}`}
                  />
                </label>
                <label className="block space-y-1">
                  <Label required>練習時間（分）</Label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={600}
                    step={5}
                    value={form.plannedDuration}
                    onChange={(e) => update({ plannedDuration: e.target.value })}
                    aria-invalid={!!errors.plannedDuration}
                    className={`${fieldClass} ${errors.plannedDuration ? 'border-rose-500' : ''}`}
                  />
                </label>
                <div className="col-span-2 md:col-span-3">
                  <ErrorText text={errors.players} />
                  <ErrorText text={errors.plannedDuration} />
                </div>
              </div>

              <label className="block space-y-1">
                <Label>練習テーマ</Label>
                <input value={form.theme} onChange={(e) => update({ theme: e.target.value })} placeholder="例：大会前、ディフェンス強化" className={fieldClass} />
              </label>
              <label className="block space-y-1">
                <Label>特に伸ばしたいこと</Label>
                <input value={form.focus} onChange={(e) => update({ focus: e.target.value })} placeholder="例：1on1の守り" className={fieldClass} />
              </label>

              <fieldset className="space-y-1">
                <legend>
                  <Label>使用できる道具（複数選択可）</Label>
                </legend>
                <div className="flex flex-wrap gap-2 pt-1">
                  {equipmentOptions.map((e) => {
                    const on = form.equipment.includes(e)
                    return (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleEquipment(e)}
                        className={`min-h-11 rounded-full border px-4 text-sm font-medium ${on ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        {on ? '✓ ' : ''}
                        {e}
                      </button>
                    )
                  })}
                  {equipmentOptions.length === 0 && <p className="text-sm text-slate-500">メニュー倉庫に道具の登録がありません。</p>}
                </div>
              </fieldset>

              <label className="block space-y-1">
                <Label>難易度</Label>
                <select value={form.difficulty} onChange={(e) => update({ difficulty: e.target.value })} className={fieldClass}>
                  {[ANY_DIFFICULTY, ...DIFFICULTIES].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <Label>その他の要望</Label>
                <textarea
                  value={form.request}
                  onChange={(e) => update({ request: e.target.value })}
                  rows={3}
                  placeholder="例：最後はゲーム形式にしたい。待ち時間を少なくしたい。"
                  className={`${fieldClass} resize-y`}
                />
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {result && confirmed ? (
            <>
              <button type="button" onClick={() => setResult(null)} className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1">
                ← 回答を修正する
              </button>
              <button type="button" onClick={() => setConfirmingUse(true)} className="order-1 col-span-2 rounded-lg bg-violet-600 py-3 font-bold text-white hover:bg-violet-700 md:order-2 md:col-span-1">
                この計画を使う
              </button>
            </>
          ) : prompt ? (
            <>
              <button type="button" onClick={backToEdit} className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1">
                ← 条件を修正
              </button>
              <button type="button" onClick={copyPrompt} className="order-1 col-span-2 rounded-lg bg-violet-600 px-2 py-3 font-bold text-white hover:bg-violet-700 md:order-2 md:col-span-1">
                📋 Claudeへの依頼文をコピー
              </button>
            </>
          ) : confirmed ? (
            <>
              <button type="button" onClick={() => setConfirmed(null)} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
                ← 条件を修正
              </button>
              <button type="button" onClick={makePrompt} className="rounded-lg bg-violet-600 py-3 font-bold text-white hover:bg-violet-700">
                依頼文を作る
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={close} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
                キャンセル
              </button>
              <button type="button" onClick={goConfirm} className="rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700">
                確認へ進む
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingUse}
        message="このAI提案を現在の練習計画として使用しますか？"
        note="現在の練習計画のメニュー・メモ・振り返りは置き換えられます（タイトルと練習日はそのまま）。残したい場合は、先に「この計画を保存」してください。"
        confirmLabel="この計画を使う"
        tone="primary"
        onCancel={() => setConfirmingUse(false)}
        onConfirm={() => {
          setConfirmingUse(false)
          if (result && confirmed) onApply(result.proposal, confirmed)
        }}
      />
    </div>
  )
}
