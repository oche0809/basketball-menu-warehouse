import type { PracticeMenu } from '../types/menu'

const DIFFICULTY_STYLE: Record<string, string> = {
  初級: 'bg-emerald-50 text-emerald-700',
  中級: 'bg-amber-50 text-amber-700',
  上級: 'bg-rose-50 text-rose-700',
}

export function Badges({ menu }: { menu: PracticeMenu }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs font-bold">
      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-800">{menu.category}</span>
      {menu.difficulty && (
        <span className={`rounded-full px-2.5 py-1 ${DIFFICULTY_STYLE[menu.difficulty] ?? 'bg-slate-100 text-slate-700'}`}>
          {menu.difficulty}
        </span>
      )}
    </div>
  )
}

export function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={active ? 'お気に入りを解除' : 'お気に入りに追加'}
      aria-pressed={active}
      onClick={onClick}
      className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl hover:bg-rose-50 ${active ? 'text-rose-500' : 'text-slate-300'}`}
    >
      {active ? '♥' : '♡'}
    </button>
  )
}

export function MenuCard({ menu, onToggleFavorite }: { menu: PracticeMenu; onToggleFavorite: (id: string) => void }) {
  return (
    <article className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Badges menu={menu} />
          <h3 className="text-lg font-bold leading-snug">
            <a href={`#/menus/${menu.id}`} className="after:absolute after:inset-0">
              {menu.title}
            </a>
          </h3>
        </div>
        <FavoriteButton active={menu.favorite} onClick={() => onToggleFavorite(menu.id)} />
      </div>
      {menu.purpose && <p className="line-clamp-1 text-sm text-slate-600 md:line-clamp-2">{menu.purpose}</p>}
      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        {menu.targetLevel && <div className="hidden md:block">対象：<span className="text-slate-700">{menu.targetLevel}</span></div>}
        {menu.players && <div>人数：<span className="text-slate-700">{menu.players}</span></div>}
        <div>⏱ <span className="text-slate-700">{menu.duration}分</span></div>
      </dl>
    </article>
  )
}
