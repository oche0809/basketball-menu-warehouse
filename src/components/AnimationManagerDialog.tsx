import { useRef, useState } from 'react'
import { CATEGORIES, DIFFICULTIES } from '../data/options'
import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { OFFICIAL_ANIMATION_ERRORS, getAnimationSource, getMenuAnimation, hasBrokenAnimation, normalizeAnimation } from '../utils/animation'
import { checkAnimationQuality } from '../utils/animationQuality'
import { OFFICIAL_FILE_NAME, downloadOfficialFile, officialAdoptError, officialFileCount, parseOfficialFile, useOfficialDraft, type OfficialFileResult } from '../utils/officialAnimations'
import { BulkAnimationPanel } from './BulkAnimationDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { FeatureChips, QualityBadge } from './AnimationQualityView'
import { MenuAnimationDialog } from './MenuAnimationDialog'

type Props = {
  menus: PracticeMenu[]
  // このブラウザだけに保存（既存の保存処理）。保存した件数を返す
  onSaveAnimations: (items: { id: string; animation: MenuAnimation }[]) => number
  onClose: () => void
}

type Tab = 'bulk' | 'list' | 'official'
const PAGE = 20
const ALL = 'すべて'
const STATUS_FILTERS = [ALL, '公式', 'このブラウザだけ', '採用待ち', '未設定', '⚠️ 要確認', '❌ エラー'] as const

// 1メニュー分の動きの状況（表示だけに使う。データは変更しない）
function statusOf(menu: PracticeMenu, draft: Record<string, MenuAnimation>) {
  const source = getAnimationSource(menu)
  const animation = getMenuAnimation(menu) ?? draft[menu.id] ?? null
  const label = source === 'personal' ? 'このブラウザだけ' : source === 'official' ? '公式' : source === 'builtin' ? '公式（アプリ内蔵）' : draft[menu.id] ? '採用待ち' : '未設定'
  const broken = !animation && (hasBrokenAnimation(menu) || !!OFFICIAL_ANIMATION_ERRORS[menu.id])
  const quality = animation ? checkAnimationQuality(animation, menu.category) : null
  return { source, animation, label, broken, quality }
}

// 動きの管理：未設定メニューの一括作成、動きの状況と品質の一覧、公式アニメーションの書き出し・読み込み。
// 公式データはGitHubの src/data/officialAnimations.json。アプリからGitHubやAIサービスへは一切アクセスしない
export function AnimationManagerDialog({ menus, onSaveAnimations, onClose }: Props) {
  const { draft, adopt, remove } = useOfficialDraft()
  const [tab, setTab] = useState<Tab>('bulk')
  const [preview, setPreview] = useState<{ title: string; animation: MenuAnimation; label?: string } | null>(null)
  // 一覧の絞り込み
  const [status, setStatus] = useState<string>(ALL)
  const [category, setCategory] = useState(ALL)
  const [difficulty, setDifficulty] = useState(ALL)
  const [page, setPage] = useState(0)
  // 公式データの読み込み
  const fileRef = useRef<HTMLInputElement>(null)
  const [imported, setImported] = useState<OfficialFileResult | null>(null)
  const [notice, setNotice] = useState('')

  const rows = menus.map((m) => ({ menu: m, ...statusOf(m, draft) }))
  const draftIds = new Set(Object.keys(draft))
  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length
  const stats = {
    official: count((r) => r.source === 'official' || r.source === 'builtin'),
    personal: count((r) => r.source === 'personal'),
    unset: count((r) => r.source === null && !draftIds.has(r.menu.id)),
    draft: draftIds.size,
    ok: count((r) => r.quality?.level === 'ok'),
    warn: count((r) => r.quality?.level === 'warn'),
    error: count((r) => r.broken),
  }

  const filtered = rows.filter(
    (r) =>
      (category === ALL || r.menu.category === category) &&
      (difficulty === ALL || r.menu.difficulty === difficulty) &&
      (status === ALL ||
        (status === '公式' && (r.source === 'official' || r.source === 'builtin')) ||
        (status === 'このブラウザだけ' && r.source === 'personal') ||
        (status === '採用待ち' && r.source === null && draftIds.has(r.menu.id)) ||
        (status === '未設定' && r.source === null && !draftIds.has(r.menu.id)) ||
        (status === '⚠️ 要確認' && r.quality?.level === 'warn') ||
        (status === '❌ エラー' && r.broken)),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE))
  const current = Math.min(page, pageCount - 1)
  const shown = filtered.slice(current * PAGE, (current + 1) * PAGE)
  const setFilter = (fn: () => void) => {
    fn()
    setPage(0)
  }

  const readFile = (file: File | undefined) => {
    if (!file) return
    setNotice('')
    file.text().then((text) => setImported(parseOfficialFile(text)))
  }

  const draftRows = Object.entries(draft).map(([id, animation]) => ({ id, animation, menu: menus.find((m) => m.id === id) }))
  const officialErrors = Object.entries(OFFICIAL_ANIMATION_ERRORS)
  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-bold sm:text-base ${tab === t ? 'bg-orange-600 text-white' : 'bg-white text-slate-700 hover:bg-orange-50'}`}
    >
      {label}
    </button>
  )
  const select = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base'

  return (
    <div className="fixed inset-0 z-40 m-0 bg-black/40 md:grid md:place-items-center md:p-4">
      <div role="dialog" aria-modal="true" aria-label="アニメーション管理" className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[92vh] md:max-w-3xl md:rounded-2xl md:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">🎬 アニメーション管理</h2>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <section aria-label="アニメーション状況" className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ['全メニュー', menus.length, 'bg-stone-50'],
                ['公式アニメーション', stats.official, 'bg-emerald-50 text-emerald-900'],
                ['このブラウザだけ', stats.personal, 'bg-sky-50 text-sky-900'],
                ['未設定', stats.unset, 'bg-orange-50 text-orange-900'],
                ['採用待ち', stats.draft, 'bg-violet-50 text-violet-900'],
              ].map(([label, value, cls]) => (
                <div key={label} className={`rounded-lg p-2.5 ${cls}`}>
                  <p className="text-xs">{label}</p>
                  <p className="text-lg font-bold">{value}件</p>
                </div>
              ))}
            </div>
            <p aria-label="品質状況" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-bold">品質状況</span>
              <span>✅ 正常：{stats.ok}</span>
              <span>⚠️ 要確認：{stats.warn}</span>
              <span>❌ エラー：{stats.error}</span>
            </p>
          </section>

          <div role="tablist" className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {tabBtn('bulk', '一括作成')}
            {tabBtn('list', '一覧・品質')}
            {tabBtn('official', `公式データ${stats.draft ? `（${stats.draft}）` : ''}`)}
          </div>

          {tab === 'bulk' && <BulkAnimationPanel menus={menus} draftIds={draftIds} onSave={onSaveAnimations} onAdopt={adopt} />}

          {tab === 'list' && (
            <section aria-label="動きの一覧" className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span className="block">アニメーション</span>
                  <select value={status} onChange={(e) => setFilter(() => setStatus(e.target.value))} className={select}>
                    {STATUS_FILTERS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span className="block">カテゴリ</span>
                  <select value={category} onChange={(e) => setFilter(() => setCategory(e.target.value))} className={select}>
                    {[ALL, ...CATEGORIES].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span className="block">難易度</span>
                  <select value={difficulty} onChange={(e) => setFilter(() => setDifficulty(e.target.value))} className={select}>
                    {[ALL, ...DIFFICULTIES].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-600">{filtered.length}件</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-40">
                    ← 前
                  </button>
                  <span className="self-center text-sm">
                    {current + 1} / {pageCount}
                  </span>
                  <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-40">
                    次 →
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {shown.map(({ menu, animation, label, broken, quality, source }) => {
                  const promotable = source === 'personal' && !draftIds.has(menu.id) && !officialAdoptError(menu.id)
                  return (
                    <li key={menu.id} className="space-y-1 px-3 py-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm break-words">
                          <span className="font-mono text-xs text-slate-500">{menu.id}</span> <span className="font-bold">{menu.title}</span>
                          <span className="ml-1 text-xs text-slate-500">
                            （{menu.category}・{menu.difficulty}）
                          </span>
                        </p>
                        <div className="flex shrink-0 gap-2">
                          {promotable && (
                            <button
                              type="button"
                              onClick={() => {
                                const anim = menu.animation && normalizeAnimation(menu.animation)
                                if (anim && adopt([{ id: menu.id, animation: anim }])) setNotice(`${menu.id} を採用待ちに追加しました。`)
                              }}
                              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                            >
                              公式に採用
                            </button>
                          )}
                          {animation && (
                            <button
                              type="button"
                              onClick={() => setPreview({ title: `${menu.id} ${menu.title}`, animation })}
                              className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50"
                            >
                              🎬 見る
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">{label}</span>
                        {quality && <QualityBadge level={quality.level} />}
                        {broken && <QualityBadge level="error" />}
                        {quality && <FeatureChips features={quality.features} />}
                      </div>
                      {quality && quality.warnings.length > 0 && <p className="text-xs text-amber-800">⚠️ {quality.warnings.join(' ')}</p>}
                    </li>
                  )
                })}
                {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">条件に合うメニューがありません。</li>}
              </ul>
              {notice && (
                <p role="status" className="text-sm font-bold text-emerald-700">
                  ✓ {notice}
                </p>
              )}
            </section>
          )}

          {tab === 'official' && (
            <section aria-label="公式データ" className="space-y-4">
              <div className="rounded-lg bg-violet-50 p-3 text-sm leading-relaxed text-violet-900">
                <p className="font-bold">公式アニメーションをGitHubに反映する手順</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  <li>「公式アニメーションを書き出す」で {OFFICIAL_FILE_NAME} を保存します（今の公式データ＋採用待ち）。</li>
                  <li>プロジェクトの src/data/{OFFICIAL_FILE_NAME} を、そのファイルで置き換えます。</li>
                  <li>GitHubへ commit・push します（Claude Codeに「公式アニメーションを反映して」と頼んでもできます）。</li>
                  <li>1〜2分でGitHub Pagesが更新され、だれが開いても同じ動きが表示されます。反映された分は、この採用待ちから自動で外れます。</li>
                </ol>
              </div>

              <div className="space-y-2">
                <p className="font-bold">採用待ち（{draftRows.length}件・このブラウザに一時保存）</p>
                {draftRows.length === 0 ? (
                  <p className="text-sm text-slate-500">採用待ちはありません。「一括作成」タブで「公式アニメーションとして採用」すると、ここに入ります。</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {draftRows.map(({ id, animation, menu }) => {
                      const q = checkAnimationQuality(animation, menu?.category)
                      return (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm break-words">
                              <span className="font-mono text-xs text-slate-500">{id}</span> <span className="font-bold">{menu?.title ?? '（このブラウザにないメニュー）'}</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <QualityBadge level={q.level} />
                              <FeatureChips features={q.features} />
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => setPreview({ title: `${id} ${menu?.title ?? ''}`, animation, label: '🎬 採用待ち（まだ公開されていません）' })}
                              className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50"
                            >
                              🎬 見る
                            </button>
                            <button type="button" onClick={() => remove(id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                              取り消す
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    downloadOfficialFile(draft)
                    setNotice(`${OFFICIAL_FILE_NAME} を書き出しました。src/data/ のファイルを置き換えて、GitHubに反映してください。`)
                  }}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 sm:w-auto"
                >
                  ⬇ 公式アニメーションを書き出す（{officialFileCount(draft)}件）
                </button>
                {notice && (
                  <p role="status" className="text-sm font-bold text-emerald-700">
                    ✓ {notice}
                  </p>
                )}
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="font-bold">公式データを読み込む</p>
                <p className="text-sm text-slate-500">
                  書き出した {OFFICIAL_FILE_NAME} を読み込むと、まだ公開されていない動きを採用待ちに戻せます（別の端末で作業を続けるときなど）。メニューのバックアップとは別のものです。
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    readFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-lg border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 sm:w-auto">
                  ⬆ 公式データを読み込む
                </button>
              </div>

              {officialErrors.length > 0 && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="font-bold">❌ 公式データのうち{officialErrors.length}件はチェックに通らないため表示していません</p>
                  <ul className="mt-1 list-disc pl-5 break-words">
                    {officialErrors.map(([id, errs]) => (
                      <li key={id}>
                        {id}：{errs.slice(0, 2).join(' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {preview && <MenuAnimationDialog title={preview.title} animation={preview.animation} label={preview.label} onClose={() => setPreview(null)} />}

      <ConfirmDialog
        open={!!imported}
        message={imported?.fatal ? imported.fatal : `採用待ちに${imported?.items.length ?? 0}件を入れますか？`}
        note={
          imported && !imported.fatal
            ? `公開済み（同じ内容）：${imported.published.length}件／使えないもの：${imported.errors.length}件${
                imported.errors.length
                  ? `（${imported.errors
                      .slice(0, 3)
                      .map((e) => `${e.id}：${e.messages[0]}`)
                      .join('、')}${imported.errors.length > 3 ? ' ほか' : ''}）`
                  : ''
              }`
            : 'ファイルを確認してください。'
        }
        confirmLabel={imported?.fatal || !imported?.items.length ? '閉じる' : '採用待ちに入れる'}
        tone="primary"
        onCancel={() => setImported(null)}
        onConfirm={() => {
          if (imported && !imported.fatal && imported.items.length) {
            const n = adopt(imported.items)
            setNotice(`${n}件を採用待ちに入れました。`)
          }
          setImported(null)
        }}
      />
    </div>
  )
}
