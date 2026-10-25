import qrcode from 'qrcode-generator'
import { useState } from 'react'
import type { PracticeMenu, PracticePlan } from '../types/menu'
import { formatDate } from '../utils/format'
import { encodeStudentPlan, studentViewUrl } from '../utils/studentView'

// QRコードを SVG の path にする（ライブラリの HTML 文字列は使わない）
function qrPath(text: string): { size: number; d: string } | null {
  try {
    const qr = qrcode(0, 'L')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    return { size: n, d }
  } catch {
    // データが多すぎて QRコードに入らない
    return null
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// 配布用の1枚（メニュー一覧と QRコード）を新しいタブに作って印刷する。スマホを持っていない生徒にも配れるように
function printHandout(plan: PracticePlan, menus: PracticeMenu[], url: string, notes: boolean) {
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  const qr = qrPath(url)
  const total = plan.items.reduce((s, i) => s + i.duration, 0)
  const rows = plan.items
    .map((item, i) => {
      const m = menuMap.get(item.menuId)
      if (!m) return ''
      const points = m.coachingPoints.slice(0, 3).map((p) => `<li>${escapeHtml(p)}</li>`).join('')
      const note = notes && item.note?.trim() ? `<p class="note">📝 ${escapeHtml(item.note.trim())}</p>` : ''
      return `<section><h2><span>${i + 1}</span>${escapeHtml(m.title)}<em>${item.duration}分</em></h2>${m.purpose ? `<p>🎯 ${escapeHtml(m.purpose)}</p>` : ''}${points ? `<ul>${points}</ul>` : ''}${note}</section>`
    })
    .join('')
  const qrSvg = qr
    ? `<svg viewBox="-2 -2 ${qr.size + 4} ${qr.size + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${qr.size + 4}" height="${qr.size + 4}" fill="#fff"/><path d="${qr.d}"/></svg>`
    : ''
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(plan.title || '今日の練習')}</title><style>
    @page { size: A4; margin: 14mm }
    body { font-family: system-ui, sans-serif; color: #1e293b; margin: 0; padding: 16px }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 3px solid #ea580c; padding-bottom: 10px }
    h1 { font-size: 22px; margin: 0 } .meta { color: #475569; margin: 4px 0 0 }
    .qr { text-align: center; font-size: 11px; color: #475569; flex-shrink: 0 } .qr svg { width: 110px; height: 110px; display: block; margin: 0 auto 4px }
    section { border-bottom: 1px solid #e2e8f0; padding: 8px 0; break-inside: avoid }
    h2 { font-size: 16px; margin: 0 0 4px; display: flex; gap: 8px; align-items: baseline }
    h2 span { background: #ea580c; color: #fff; border-radius: 999px; min-width: 22px; text-align: center; font-size: 13px }
    h2 em { margin-left: auto; font-style: normal; color: #c2410c }
    p { margin: 2px 0; font-size: 13px } ul { margin: 2px 0; padding-left: 20px; font-size: 13px } .note { background: #fef3c7; padding: 4px 6px; border-radius: 4px }
  </style></head><body><header><div><h1>🏀 ${escapeHtml(plan.title || '今日の練習')}</h1><p class="meta">${[formatDate(plan.date), `${plan.items.length}メニュー`, `${total}分`].filter(Boolean).join('・')}</p></div>${
    qrSvg ? `<div class="qr">${qrSvg}スマホで読み取ると<br>動き・動画が見られます</div>` : ''
  }</header>${rows}<script>window.onload = () => setTimeout(() => window.print(), 300)</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

type Props = { getPlan: () => PracticePlan; menus: PracticeMenu[]; disabled?: boolean }

// 生徒用ページ（見るだけ）のリンクと QRコードを作る
export function StudentLinkButton({ getPlan, menus, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [withNotes, setWithNotes] = useState(false)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const build = async (notes: boolean) => {
    setUrl('')
    setUrl(studentViewUrl(await encodeStudentPlan(getPlan(), menus, notes)))
  }

  const show = () => {
    setOpen(true)
    setCopied(false)
    void build(withNotes)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // コピーできない環境では、下のURL欄から手でコピーしてもらう
    }
  }

  const qr = url ? qrPath(url) : null

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={show}
        title="生徒がスマホで今日のメニュー・動き・動画を見られるページを作ります"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        👀 生徒用リンク・QR
      </button>
      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="生徒用リンク" className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-lg font-bold">👀 生徒用リンク</p>
              <p className="mt-1 text-sm text-slate-600">
                今日のメニューの説明・動き・参考動画を<b>見るだけ</b>のページです。生徒が見ても、先生の倉庫や計画は変わりません。
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={withNotes}
                onChange={(e) => {
                  setWithNotes(e.target.checked)
                  void build(e.target.checked)
                }}
                className="mt-1 h-4 w-4"
              />
              <span>
                各メニューの「今回のメモ」も載せる
                <span className="block text-xs text-slate-500">生徒に見せたくない内容がないか確かめてから入れてください。</span>
              </span>
            </label>
            <div className="grid place-items-center rounded-xl border border-slate-200 bg-white p-3">
              {!url ? (
                <p className="py-16 text-sm text-slate-500">作成中…</p>
              ) : qr ? (
                <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} className="h-64 w-64" role="img" aria-label="生徒用ページのQRコード" shapeRendering="crispEdges">
                  <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#fff" />
                  <path d={qr.d} fill="#000" />
                </svg>
              ) : (
                <p className="p-4 text-center text-sm text-amber-800">メニューが多すぎてQRコードに入りません。下のリンクをコピーして送ってください。</p>
              )}
            </div>
            {url && (
              <>
                <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="生徒用ページのURL" className="w-full rounded-lg border border-slate-300 bg-stone-50 px-3 py-2 font-mono text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={copy} className="rounded-lg bg-orange-600 py-3 font-bold text-white hover:bg-orange-700">
                    {copied ? '✓ コピーしました' : '🔗 リンクをコピー'}
                  </button>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="grid place-items-center rounded-lg border border-slate-300 py-3 font-bold text-slate-700 hover:bg-slate-50">
                    開いて確認 ↗
                  </a>
                </div>
              </>
            )}
            {url && (
              <button
                type="button"
                onClick={() => setBlocked(!printHandout(getPlan(), menus, url, withNotes))}
                className="w-full rounded-lg border border-slate-300 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                🖨️ 配布用に印刷（メニュー一覧＋QRコード）
              </button>
            )}
            {blocked && <p className="text-sm font-bold text-rose-600">新しいタブを開けませんでした。ブラウザのポップアップブロックを解除してください。</p>}
            <p className="text-xs text-slate-500">
              リンクの中に今日の計画が入っています（サーバーには保存しません）。計画を変えたら、もう一度リンクを作り直してください。
            </p>
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg border border-slate-300 py-3 font-bold hover:bg-slate-50">
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
