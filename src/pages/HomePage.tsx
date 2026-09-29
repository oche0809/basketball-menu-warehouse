import { CATEGORIES } from '../data/options'
import type { PracticeMenu } from '../types/menu'

export function HomePage({ menus }: { menus: PracticeMenu[] }) {
  const favoriteCount = menus.filter((m) => m.favorite).length
  const recent = [...menus].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-orange-600 to-orange-500 px-6 py-8 text-white shadow">
        <h1 className="text-2xl font-bold sm:text-3xl">バスケットボール メニュー倉庫</h1>
        <p className="mt-2 text-orange-50">練習メニューを、探す・ためる。</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href="#/menus" className="rounded-lg bg-white px-6 py-3 text-center font-bold text-orange-700 hover:bg-orange-50">
            🔍 メニューを探す
          </a>
          <a href="#/new" className="rounded-lg border-2 border-white/80 px-6 py-3 text-center font-bold hover:bg-white/10">
            ＋ メニューを追加
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <a href="#/menus" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300">
          <div className="text-sm text-slate-500">登録メニュー</div>
          <div className="text-3xl font-bold">{menus.length}<span className="ml-1 text-base font-normal">件</span></div>
        </a>
        <a href="#/favorites" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300">
          <div className="text-sm text-slate-500">お気に入り</div>
          <div className="text-3xl font-bold text-rose-500">{favoriteCount}<span className="ml-1 text-base font-normal text-slate-800">件</span></div>
        </a>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">最近追加したメニュー</h2>
          {recent.length === 0 ? (
            <p className="text-slate-500">まだメニューがありません。</p>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {recent.map((m) => (
                <li key={m.id}>
                  <a href={`#/menus/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-orange-50">
                    <span className="min-w-0 truncate font-medium">{m.title}</span>
                    <span className="shrink-0 text-sm text-slate-500">{m.category}・{m.duration}分</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
  
        <section>
          <h2 className="mb-3 text-lg font-bold">カテゴリから探す</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <a
                key={c}
                href={`#/menus?category=${encodeURIComponent(c)}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 font-medium hover:border-orange-300 hover:bg-orange-50"
              >
                {c}
                <span className="text-sm text-slate-400">{menus.filter((m) => m.category === c).length}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
