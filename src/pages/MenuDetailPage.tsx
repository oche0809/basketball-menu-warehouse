import { useState, type ReactNode } from 'react'
import { AnimationGenerateDialog } from '../components/AnimationGenerateDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MenuAnimationDialog } from '../components/MenuAnimationDialog'
import { Badges, FavoriteButton } from '../components/MenuCard'
import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { getMenuAnimation } from '../utils/animation'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-2 font-bold text-orange-700">{title}</h2>
      <div className="leading-relaxed">{children}</div>
    </section>
  )
}

const Text = ({ value }: { value: string }) => <p className="whitespace-pre-wrap">{value}</p>

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((v, i) => <li key={i}>{v}</li>)}
  </ul>
)

const isWebUrl = (url: string) => /^https?:\/\//i.test(url.trim())

function SourceSection({ menu }: { menu: PracticeMenu }) {
  const { sourceType, sourceTitle, sourceUrl, sourceNote } = menu
  if (![sourceType, sourceTitle, sourceUrl, sourceNote].some((v) => v?.trim())) return null
  const linkLabel = sourceType === 'YouTube' || sourceType === 'Instagram' ? '🎥 元動画を見る' : '🔗 参考サイトを見る'
  return (
    <Section title="📚 出典・参考情報">
      <div className="space-y-1">
        {sourceType && <p className="text-sm text-slate-500">出典：{sourceType}</p>}
        {sourceTitle && <p className="font-bold break-words">{sourceTitle}</p>}
        {sourceNote && <p className="break-words whitespace-pre-wrap text-slate-700">{sourceNote}</p>}
        {sourceUrl &&
          (isWebUrl(sourceUrl) ? (
            <a
              href={sourceUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-orange-300 bg-white px-4 font-bold text-orange-700 hover:bg-orange-50"
            >
              {linkLabel} ↗
            </a>
          ) : (
            <p className="text-sm break-all text-slate-500">URL：{sourceUrl}</p>
          ))}
      </div>
    </Section>
  )
}

type Props = {
  menu: PracticeMenu
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
  onSaveAnimation: (id: string, animation: MenuAnimation) => void
}

export function MenuDetailPage({ menu, onToggleFavorite, onDelete, onSaveAnimation }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  // 動きの解説があるメニューだけ「🎬 動きを見る」を出す
  const animation = getMenuAnimation(menu)

  const info = [
    ['対象', menu.targetLevel],
    ['人数', menu.players],
    ['所要時間', `${menu.duration}分`],
    ['必要な道具', menu.equipment.join('、') || 'なし'],
  ]

  return (
    <div className="space-y-4">
      <a href="#/menus" className="inline-block py-2 font-medium text-orange-700 hover:underline">
        ← 一覧へ戻る
      </a>

      <header className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badges menu={menu} />
            <h1 className="text-2xl font-bold sm:text-3xl">{menu.title}</h1>
          </div>
          <FavoriteButton active={menu.favorite} onClick={() => onToggleFavorite(menu.id)} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {info.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-stone-50 p-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="font-bold">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {animation && (
            <button
              type="button"
              onClick={() => setShowAnimation(true)}
              className="w-full rounded-lg bg-orange-600 px-5 py-3 font-bold text-white hover:bg-orange-700 sm:w-auto"
            >
              🎬 動きを見る
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSavedMessage(false)
              setGenerating(true)
            }}
            className="w-full rounded-lg border border-orange-300 bg-white px-5 py-3 font-bold text-orange-700 hover:bg-orange-50 sm:w-auto"
          >
            {animation ? '✏️ 動きを修正する' : '🎬 動きを作る'}
          </button>
        </div>
        {savedMessage && (
          <p role="status" className="mt-2 font-bold text-emerald-700">
            ✓ 動きを保存しました
          </p>
        )}
      </header>
      {showAnimation && animation && <MenuAnimationDialog title={menu.title} animation={animation} onClose={() => setShowAnimation(false)} />}
      {generating && (
        <AnimationGenerateDialog
          menu={menu}
          current={animation ?? undefined}
          onClose={() => setGenerating(false)}
          onSave={(anim) => {
            onSaveAnimation(menu.id, anim)
            setGenerating(false)
            setSavedMessage(true)
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          {menu.purpose && <Section title="目的"><Text value={menu.purpose} /></Section>}
          {menu.setup && <Section title="セットアップ"><Text value={menu.setup} /></Section>}
          {menu.instructions && <Section title="実施方法"><Text value={menu.instructions} /></Section>}
        </div>
        <div className="space-y-4">
          {menu.coachingPoints.length > 0 && <Section title="指導ポイント"><List items={menu.coachingPoints} /></Section>}
          {menu.commonMistakes.length > 0 && <Section title="よくあるミス"><List items={menu.commonMistakes} /></Section>}
          {menu.progression && <Section title="発展（難しくする）"><Text value={menu.progression} /></Section>}
          {menu.regression && <Section title="簡単にする方法"><Text value={menu.regression} /></Section>}
        </div>
      </div>
      <SourceSection menu={menu} />
      {menu.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {menu.tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">#{t}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2 sm:flex sm:justify-end">
        <a href={`#/edit/${menu.id}`} className="rounded-lg bg-orange-600 px-6 py-3 text-center font-bold text-white hover:bg-orange-700">
          編集
        </a>
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-rose-300 bg-white px-6 py-3 font-bold text-rose-600 hover:bg-rose-50">
          削除
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        message="このメニューを削除しますか？"
        confirmLabel="削除"
        onCancel={() => setConfirming(false)}
        onConfirm={() => onDelete(menu.id)}
      />
    </div>
  )
}
