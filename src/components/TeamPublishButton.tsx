import { useState } from 'react'
import type { PracticeMenu, PracticePlan } from '../types/menu'
import { formatDate } from '../utils/format'
import { qrPath } from '../utils/qr'
import { loadRemoteBoard, loadToken, publishToBoard, removeFromBoard, saveRemoteBoard, saveToken, teamPageUrl, type Board } from '../utils/teamBoard'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'
const errorText = (e: unknown) => (e instanceof Error ? e.message : '通信できませんでした。インターネットにつながっているか確かめてください。')

// 初めて使うときだけ：GitHub のトークンを作って貼り付けてもらう
function TokenSetup({ onSaved }: { onSaved: (token: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="space-y-3 text-sm">
      <p className="font-bold">はじめに（この端末で1回だけ）</p>
      <p className="text-slate-600">チームページへの書き込みには、先生の GitHub の「トークン（合い言葉）」が必要です。生徒は何もいりません。</p>
      <ol className="list-decimal space-y-1 rounded-lg bg-stone-50 p-3 pl-8 text-slate-700">
        <li>下のボタンから GitHub の「New fine-grained personal access token」を開く</li>
        <li>
          Token name：<b>メニュー倉庫 チームページ</b>／Expiration：<b>1年</b>（期限が来たら作り直し）
        </li>
        <li>
          Repository access：<b>Only select repositories</b> → <b>basketball-menu-warehouse</b>
        </li>
        <li>
          Permissions → Repository permissions → <b>Contents</b> を <b>Read and write</b>
        </li>
        <li>
          一番下の <b>Generate token</b> → 出てきた <code>github_pat_</code> で始まる文字をコピーして、下に貼り付け
        </li>
      </ol>
      <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-slate-300 py-3 text-center font-bold text-slate-700 hover:bg-slate-50">
        GitHub でトークンを作る ↗
      </a>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value.trim())}
        placeholder="github_pat_…"
        aria-label="GitHub のトークン"
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
      />
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          saveToken(value)
          onSaved(value)
        }}
        className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40"
      >
        この端末に保存する
      </button>
      <p className="text-xs text-slate-500">トークンはこの端末のブラウザだけに保存します（バックアップのファイルには入りません）。生徒の端末では入力しないでください。</p>
    </div>
  )
}

type Props = { getPlan: () => PracticePlan; menus: PracticeMenu[]; disabled?: boolean }

// 固定 URL のチームページに、この計画を公開する（先生用）
export function TeamPublishButton({ getPlan, menus, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [plan, setPlan] = useState<PracticePlan | null>(null)
  const [remote, setRemote] = useState<{ board: Board; sha?: string } | null>(null)
  const [withNotes, setWithNotes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = async (t: string) => {
    setRemote(null)
    try {
      setRemote(await loadRemoteBoard(t))
    } catch (e) {
      setError(errorText(e))
    }
  }

  const show = () => {
    const t = loadToken()
    setOpen(true)
    setToken(t)
    setPlan(getPlan())
    setDone('')
    setError('')
    setRemoving(null)
    if (t) void refresh(t)
  }

  const save = async (next: Board, message: string, doneText: string) => {
    if (!remote) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      await saveRemoteBoard(token, next, remote.sha, message)
      setDone(doneText)
      await refresh(token)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  const publish = () => {
    if (!remote || !plan) return
    void save(publishToBoard(remote.board, plan, menus, withNotes), `公開：${plan.date} ${plan.title}`, '公開しました。')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(teamPageUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // コピーできない環境では、URL欄から手でコピーしてもらう
    }
  }

  const url = open ? teamPageUrl() : ''
  const qr = url ? qrPath(url) : null
  const sameDay = plan && remote?.board.plans.some((e) => e.date === plan.date)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={show}
        title="生徒がいつも同じURLで見られるチームページに、この計画を公開します"
        className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-bold whitespace-nowrap text-orange-800 hover:bg-orange-100 disabled:opacity-40"
      >
        📣 チームページに公開
      </button>
      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="チームページに公開" className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-lg font-bold">📣 チームページに公開</p>
              <p className="mt-1 text-sm text-slate-600">
                チームページは<b>URLがずっと同じ</b>の、生徒が見るだけのページです。公開するたびにリンクを送り直す必要はありません。
              </p>
            </div>

            {!token ? (
              <TokenSetup
                onSaved={(t) => {
                  setToken(t)
                  setError('')
                  void refresh(t)
                }}
              />
            ) : (
              <>
                {plan && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-xs font-bold text-orange-700">公開する計画</p>
                      <p className="font-bold break-words">
                        {formatDate(plan.date)}　{plan.title || '練習'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {plan.items.length}メニュー・{plan.items.reduce((s, i) => s + i.duration, 0)}分
                      </p>
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} className="mt-1 h-4 w-4" />
                      <span>
                        各メニューの「今回のメモ」も載せる
                        <span className="block text-xs text-slate-500">チームページはURLを知っていればだれでも見られます。生徒の名前など、見せたくない内容は入れないでください。</span>
                      </span>
                    </label>
                    {sameDay && <p className="text-sm text-amber-800">この日の計画はもう公開されています。公開すると新しい内容に置き換わります。</p>}
                    <button
                      type="button"
                      onClick={publish}
                      disabled={!remote || busy}
                      className="w-full rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-40"
                    >
                      {busy ? '公開中…' : sameDay ? '📣 置き換えて公開する' : '📣 公開する'}
                    </button>
                  </div>
                )}

                {done && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ {done}生徒のページに出るまで1〜2分かかります。</p>}
                {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}

                <div className="space-y-2">
                  <p className="text-sm font-bold">公開中の予定</p>
                  {!remote ? (
                    !error && <p className="text-sm text-slate-500">読み込み中…</p>
                  ) : remote.board.plans.length === 0 ? (
                    <p className="text-sm text-slate-500">まだありません。</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {[...remote.board.plans].reverse().map((e) => (
                        <li key={e.date} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 break-words">
                            <b>{formatDate(e.date)}</b> {e.plan.t || '練習'}
                          </span>
                          {removing === e.date ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void save(removeFromBoard(remote.board, e.date), `取り下げ：${e.date}`, '取り下げました。')}
                              className="shrink-0 rounded-md bg-rose-600 px-2 py-1 font-bold text-white disabled:opacity-40"
                            >
                              取り下げる
                            </button>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => setRemoving(e.date)} className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-slate-600 disabled:opacity-40">
                              取り下げ…
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 rounded-xl bg-stone-50 p-3">
                  <p className="text-sm font-bold">生徒に伝えるURL（ずっと同じ）</p>
                  {qr && (
                    <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} className="mx-auto h-44 w-44 bg-white" role="img" aria-label="チームページのQRコード" shapeRendering="crispEdges">
                      <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#fff" />
                      <path d={qr.d} fill="#000" />
                    </svg>
                  )}
                  <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="チームページのURL" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={copy} className="rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      {copied ? '✓ コピーしました' : '🔗 URLをコピー'}
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="grid place-items-center rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      開いて確認 ↗
                    </a>
                  </div>
                  <p className="text-xs text-slate-500">最初に一度だけ生徒に送り、ブックマーク（ホーム画面に追加）してもらってください。</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    saveToken('')
                    setToken('')
                    setRemote(null)
                    setError('')
                  }}
                  className="text-xs text-slate-500 underline"
                >
                  この端末のトークンを消す・入れ直す
                </button>
              </>
            )}

            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="w-full rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50 disabled:opacity-40">
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
