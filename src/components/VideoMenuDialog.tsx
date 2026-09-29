import { useRef, useState } from 'react'
import { fieldClass } from '../pages/PlanPage'
import type { MenuInput, PracticeMenu } from '../types/menu'
import { buildVideoMenuPrompt, findSimilarMenus, parseVideoAnswer } from '../utils/videoMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { Badges } from './MenuCard'
import { MenuForm } from './MenuForm'

type Extracted = { summary: string; excluded: number; items: { input: MenuInput; checks: string[]; selected: boolean }[] }

type Props = {
  menus: PracticeMenu[]
  onAdd: (inputs: MenuInput[]) => void
  onClose: () => void
}

// MenuForm に渡すための一時的な形（保存はしない）
const asDraft = (input: MenuInput): PracticeMenu => ({ ...input, id: 'draft', favorite: false, createdAt: '', updatedAt: '' })

// 動画URL → Claudeへの依頼文 → 回答の貼り付けと確認 → 選んだメニューを倉庫に追加。
// アプリから動画やAIサービスへは一切アクセスしない。「追加する」を確定するまで倉庫は変更しない
export function VideoMenuDialog({ menus, onAdd, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [urlError, setUrlError] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [answer, setAnswer] = useState('')
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState<Extracted | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  const makePrompt = () => {
    if (!url.trim()) {
      setUrlError('動画URLを入力してください')
      return
    }
    setUrlError('')
    setPrompt(buildVideoMenuPrompt(url, note))
    setCopyStatus('idle')
  }

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

  const analyzeAnswer = () => {
    try {
      const parsed = parseVideoAnswer(answer, url)
      setResult({ summary: parsed.summary, excluded: parsed.excluded, items: parsed.items.map((c) => ({ ...c, selected: true })) })
      setParseError('')
    } catch (e) {
      setResult(null)
      setParseError(e instanceof Error ? e.message : 'Claudeの回答を読み取れませんでした。')
    }
  }

  const updateItem = (index: number, patch: Partial<Extracted['items'][number]>) =>
    setResult((r) => (r ? { ...r, items: r.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) } : r))

  const selected = result ? result.items.filter((it) => it.selected) : []

  return (
    <div className="fixed inset-0 z-40 m-0 bg-black/40 md:grid md:place-items-center md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="動画からメニューを追加"
        className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-2xl md:shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">🎥 動画からメニューを追加</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {result && editing !== null ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">この修正は、追加を確定するまで倉庫には保存されません。</p>
              <MenuForm
                heading="メニュー内容を修正"
                initial={asDraft(result.items[editing].input)}
                onSubmit={(input) => {
                  updateItem(editing, { input })
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : result ? (
            <div className="space-y-3">
              <p className="text-lg font-bold">🎥 動画から抽出したメニュー（{result.items.length}件）</p>
              {result.summary && <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 break-words whitespace-pre-wrap text-violet-900">{result.summary}</p>}
              {result.excluded > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  ⚠ {result.excluded}件は内容が正しくないため除外しました（メニュー名がないなど）。
                </p>
              )}
              <ul className="space-y-2">
                {result.items.map((it, i) => {
                  const similar = findSimilarMenus(it.input, menus)
                  return (
                    <li key={i} className={`rounded-xl border p-3 ${it.selected ? 'border-orange-300 bg-white' : 'border-slate-200 bg-stone-50'}`}>
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={it.selected}
                          onChange={(e) => updateItem(i, { selected: e.target.checked })}
                          aria-label={`「${it.input.title}」を追加する`}
                          className="mt-1 h-5 w-5 shrink-0 accent-orange-600"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Badges menu={asDraft(it.input)} />
                          <p className="font-bold break-words">{it.input.title}</p>
                          <p className="text-sm text-slate-600">
                            {[it.input.targetLevel, it.input.players && `人数：${it.input.players}`, `${it.input.duration}分`].filter(Boolean).join('・')}
                          </p>
                          <p className="text-sm text-slate-600">道具：{it.input.equipment.length > 0 ? it.input.equipment.join('、') : 'なし'}</p>
                          {it.input.purpose && <p className="text-sm break-words text-slate-700">目的：{it.input.purpose}</p>}
                          {it.input.sourceType && (
                            <p className="text-sm break-words text-slate-500">
                              📚 出典：{it.input.sourceType}
                              {it.input.sourceTitle && `（${it.input.sourceTitle}）`}
                            </p>
                          )}
                        </div>
                      </label>
                      {it.checks.length > 0 && <p className="mt-2 text-sm text-amber-800">⚠ 要確認：{it.checks.join('、')}</p>}
                      {similar.length > 0 && (
                        <p className="mt-1 text-sm break-words text-rose-700">⚠ 似たメニューが倉庫にあります：{similar.map((m) => `「${m.title}」`).join('、')}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(i)}
                        className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        ✏️ 内容を確認・修正
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-slate-500">「追加する」を確定するまで、メニュー倉庫は変更されません。</p>
            </div>
          ) : prompt ? (
            <div className="space-y-3">
              <p className="text-lg font-bold">Claudeへの依頼文</p>
              <ol className="list-decimal space-y-0.5 rounded-lg bg-violet-50 py-2 pr-3 pl-8 text-sm text-violet-900">
                <li>下の「📋 Claudeへの依頼文をコピー」を押します。</li>
                <li>Claude（アプリまたは claude.ai）に貼り付けて送信します。</li>
                <li>Claudeの回答をコピーして下の欄に貼り付け、「回答を解析する」を押します。</li>
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
                {copyStatus === 'failed' && <span className="text-rose-600">自動でコピーできませんでした。上の文章が全て選ばれた状態なので、そのままコピーしてください。</span>}
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
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-700">
                  動画URL<span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">必須</span>
                </span>
                <input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="YouTube / Instagramなどの動画URLを貼り付け"
                  aria-invalid={!!urlError}
                  className={`${fieldClass} ${urlError ? 'border-rose-500' : ''}`}
                />
                {urlError && <p className="text-sm font-bold text-rose-600">{urlError}</p>}
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-bold text-slate-700">
                  メモ・見てほしいポイント<span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">任意</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="例：この動画の中からドリブル練習だけ抽出してください"
                  className={`${fieldClass} resize-y`}
                />
              </label>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Claudeが動画の中身（映像・音声）を直接見られない場合があります。その場合は、動画で見た練習の内容（並び方・動き・字幕など）をメモに書き添えると、正確に整理してもらいやすくなります。
              </p>
              <p className="text-sm text-slate-500">このアプリから動画サイトやAIサービスへ自動でアクセスすることはありません。</p>
            </div>
          )}
        </div>

        {editing === null && (
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {result ? (
              <>
                <button type="button" onClick={() => setResult(null)} className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1">
                  ← 回答を修正する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={selected.length === 0}
                  className="order-1 col-span-2 rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40 md:order-2 md:col-span-1"
                >
                  ＋ 選択したメニューを追加（{selected.length}件）
                </button>
              </>
            ) : prompt ? (
              <>
                <button type="button" onClick={() => setPrompt(null)} className="order-2 col-span-2 rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 md:order-1 md:col-span-1">
                  ← URLを修正
                </button>
                <button type="button" onClick={copyPrompt} className="order-1 col-span-2 rounded-lg bg-violet-600 px-2 py-3 font-bold text-white hover:bg-violet-700 md:order-2 md:col-span-1">
                  📋 Claudeへの依頼文をコピー
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
                  キャンセル
                </button>
                <button type="button" onClick={makePrompt} className="rounded-lg bg-violet-600 py-3 font-bold text-white hover:bg-violet-700">
                  依頼文を作る
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        message={`選択した${selected.length}件のメニューを倉庫に追加しますか？`}
        note="追加したメニューは、通常のメニューと同じように編集・削除できます。"
        confirmLabel="追加する"
        tone="primary"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          onAdd(selected.map((it) => it.input))
        }}
      />
    </div>
  )
}
