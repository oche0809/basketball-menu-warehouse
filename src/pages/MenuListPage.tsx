import { useState } from 'react'
import { MenuCard } from '../components/MenuCard'
import { BulkAnimationDialog } from '../components/BulkAnimationDialog'
import { VideoMenuDialog } from '../components/VideoMenuDialog'
import { CATEGORIES } from '../data/options'
import type { MenuAnimation, MenuInput, PracticeMenu } from '../types/menu'
import { ALL, DURATION_RANGES, EMPTY_CONDITIONS, PLAYER_RANGES, buildOptions, filterMenus, normalizeForSearch, type Conditions } from '../utils/filters'

const POPULAR_TAG_COUNT = 12

// タグが多くても使えるよう、よく使われるタグだけを表示し、それ以外は検索して選ぶ。
// 複数選べて、選んだタグをすべて持つメニューだけに絞り込む（AND）
function TagPicker({ menus, value, onChange }: { menus: PracticeMenu[]; value: string[]; onChange: (tags: string[]) => void }) {
  const [query, setQuery] = useState('')
  const counts = new Map<string, number>()
  for (const m of menus) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  const q = normalizeForSearch(query.trim())
  const shown = q
    ? [...counts.keys()].filter((t) => normalizeForSearch(t).includes(q)).sort((a, b) => a.localeCompare(b, 'ja'))
    : [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b, 'ja')).slice(0, POPULAR_TAG_COUNT)
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])

  return (
    <div className="space-y-2">
      <span className="text-sm font-bold text-slate-700">タグ</span>
      {value.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500">選択中（すべてを含むメニューを表示）</p>
          <div className="flex flex-wrap gap-2">
            {value.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                aria-label={`タグ「${t}」の選択を解除`}
                className="min-h-9 max-w-full rounded-full border border-orange-600 bg-orange-600 px-3 text-sm font-bold break-all text-white"
              >
                #{t} ×
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`タグを検索（全${counts.size}個）例：判断、半面`}
        aria-label="タグを検索"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      <p className="text-xs font-bold text-slate-500">{q ? '検索結果' : 'よく使われるタグ'}</p>
      <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
        {shown.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={value.includes(t)}
            onClick={() => toggle(t)}
            className={`min-h-9 max-w-full rounded-full border px-3 text-sm break-all ${value.includes(t) ? 'border-orange-600 bg-orange-50 font-bold text-orange-800' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-300'}`}
          >
            {value.includes(t) ? '✓ ' : ''}#{t} <span className="text-xs text-slate-400">{counts.get(t)}</span>
          </button>
        ))}
        {q && shown.length === 0 && <p className="text-sm text-slate-500">一致するタグがありません。</p>}
      </div>
      {!q && <p className="text-xs text-slate-500">検索するとすべてのタグから選べます。</p>}
    </div>
  )
}

type Props = {
  menus: PracticeMenu[]
  onToggleFavorite: (id: string) => void
  favoritesOnly?: boolean
  initialCategory?: string
  onAddMenus?: (inputs: MenuInput[]) => void
  // 動きがないメニューへの一括保存（保存した件数を返す）
  onSaveAnimations?: (items: { id: string; animation: MenuAnimation }[]) => number
}

export function MenuListPage({ menus, onToggleFavorite, favoritesOnly, initialCategory, onAddMenus, onSaveAnimations }: Props) {
  const [videoOpen, setVideoOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(initialCategory && CATEGORIES.includes(initialCategory) ? initialCategory : ALL)
  const [conditions, setConditions] = useState<Conditions>(EMPTY_CONDITIONS)
  // PCでは最初から条件を開いておく
  const [showConditions, setShowConditions] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  const base = favoritesOnly ? menus.filter((m) => m.favorite) : menus
  const results = filterMenus(base, query, category, conditions)
  const options = buildOptions(base)

  const activeCount = Object.entries(conditions).filter(([k, v]) => (k === 'tags' ? v.length > 0 : v !== ALL)).length
  const anyFilter = activeCount > 0 || query.trim() !== '' || category !== ALL

  const conditionFields: { key: Exclude<keyof Conditions, 'tags'>; label: string; values: string[] }[] = [
    { key: 'players', label: '人数', values: PLAYER_RANGES.map((r) => r.label) },
    { key: 'duration', label: '所要時間', values: DURATION_RANGES.map((r) => r.label) },
    { key: 'difficulty', label: '難易度', values: options.difficulty },
    { key: 'targetLevel', label: '対象レベル', values: options.targetLevel },
    { key: 'equipment', label: '必要な道具', values: options.equipment },
  ]

  const clearAll = () => {
    setQuery('')
    setCategory(ALL)
    setConditions(EMPTY_CONDITIONS)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{favoritesOnly ? '♥ お気に入り' : 'メニュー一覧'}</h1>
        <div className="flex flex-wrap gap-2">
          {onSaveAnimations && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="rounded-lg border border-orange-300 bg-white px-4 py-2.5 font-bold text-orange-700 hover:bg-orange-50"
            >
              🎬 アニメーション一括作成
            </button>
          )}
          {onAddMenus && (
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 font-bold text-violet-800 hover:bg-violet-100"
            >
              🎥 動画からメニューを追加
            </button>
          )}
        </div>
      </div>
      {bulkOpen && onSaveAnimations && <BulkAnimationDialog menus={menus} onSave={onSaveAnimations} onClose={() => setBulkOpen(false)} />}
      {videoOpen && onAddMenus && (
        <VideoMenuDialog
          menus={menus}
          onAdd={(inputs) => {
            onAddMenus(inputs)
            setVideoOpen(false)
          }}
          onClose={() => setVideoOpen(false)}
        />
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 メニュー名・目的・タグなどで検索"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm lg:px-5 lg:py-4 lg:text-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {[ALL, ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
              category === c ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowConditions((v) => !v)}
          aria-expanded={showConditions}
          className="flex w-full items-center justify-between px-4 py-3 font-bold"
        >
          <span>
            条件で絞り込む
            {activeCount > 0 && <span className="ml-2 rounded-full bg-orange-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
          </span>
          <span className="text-slate-400">{showConditions ? '▲' : '▼'}</span>
        </button>
        {showConditions && (
          <div className="space-y-4 border-t border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {conditionFields.map((f) => (
                <label key={f.key} className="block space-y-1">
                  <span className="text-sm font-bold text-slate-700">{f.label}</span>
                  <select
                    value={conditions[f.key]}
                    onChange={(e) => setConditions((c) => ({ ...c, [f.key]: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 ${
                      conditions[f.key] !== ALL ? 'border-orange-500 bg-orange-50' : 'border-slate-300 bg-white'
                    }`}
                  >
                    <option>{ALL}</option>
                    {f.values.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <TagPicker menus={base} value={conditions.tags} onChange={(tags) => setConditions((c) => ({ ...c, tags }))} />
            <button
              type="button"
              onClick={() => setConditions(EMPTY_CONDITIONS)}
              disabled={activeCount === 0}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:w-auto"
            >
              条件をリセット
            </button>
          </div>
        )}
      </section>

      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-600">{results.length > 0 && `${results.length}件のメニュー`}</p>
        {anyFilter && (
          <button type="button" onClick={clearAll} className="text-sm font-bold text-orange-700 hover:underline">
            すべての絞り込みを解除
          </button>
        )}
      </div>

      {favoritesOnly && base.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          お気に入りはまだありません。メニューの ♡ を押すと登録できます。
        </p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          条件に一致するメニューがありません。
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {results.map((m) => (
            <MenuCard key={m.id} menu={m} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      )}
    </div>
  )
}
