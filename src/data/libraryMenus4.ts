import type { PracticeMenu } from '../types/menu'
import { part1 } from './library4/part1'
import { part2 } from './library4/part2'

// 追加メニュー集・第4弾（30件）：体育館が使えない日のメニュー。IDは固定（lib-301〜lib-330）。ほかのパックとは別に1回だけ取り込む
export const LIBRARY4_VERSION = 'menu-library-2026-10-30-outdoor'

const library = [...part1, ...part2]

// 登録日時は第3弾の続きの固定の過去日時にする（先生が自分で追加したメニューより上に来ないように）
export function createLibraryMenus4(): PracticeMenu[] {
  const base = Date.UTC(2026, 8, 1)
  return library.map((s, i) => {
    const date = new Date(base + (300 + i) * 60000).toISOString()
    return { ...s, id: `lib-${String(301 + i).padStart(3, '0')}`, favorite: false, createdAt: date, updatedAt: date }
  })
}
