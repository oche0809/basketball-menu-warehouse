import type { ReactNode } from 'react'

const NAV = [
  { key: 'home', href: '#/', label: 'ホーム', icon: '🏠' },
  { key: 'menus', href: '#/menus', label: 'メニュー', icon: '📋' },
  { key: 'favorites', href: '#/favorites', label: 'お気に入り', icon: '♥' },
  { key: 'plan', href: '#/plan', label: '練習計画', icon: '📝' },
  { key: 'saved', href: '#/saved', label: '保存済み', icon: '📚' },
  { key: 'new', href: '#/new', label: '追加', icon: '＋' },
]

export function Layout({ current, actions, children }: { current: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 pb-24 text-slate-800 md:pb-10 print:bg-white print:p-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 lg:px-8">
          <a href="#/" className="flex min-w-0 items-center gap-2 text-base font-bold sm:text-lg">
            <span aria-hidden>🏀</span>
            <span className="truncate">バスケットボール メニュー倉庫</span>
          </a>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) =>
              n.key === 'new' ? (
                <a key={n.key} href={n.href} className="ml-2 rounded-lg bg-orange-600 px-4 py-2 font-bold text-white hover:bg-orange-700">
                  ＋ メニューを追加
                </a>
              ) : (
                <a
                  key={n.key}
                  href={n.href}
                  className={`rounded-lg px-3 py-2 font-medium ${current === n.key ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {n.label}
                </a>
              ),
            )}
          </nav>
          {actions}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.filter((n) => n.key !== 'saved').map((n) => (
          <a
            key={n.key}
            href={n.href}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${current === n.key || (n.key === 'plan' && current === 'saved') ? 'text-orange-600' : 'text-slate-500'}`}
          >
            <span className="text-2xl leading-none">{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
