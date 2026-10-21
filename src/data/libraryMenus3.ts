import type { PracticeMenu } from '../types/menu'
import { part1 } from './library3/part1'
import { part2 } from './library3/part2'

// 追加メニュー集・第3弾（50件）。IDは固定（lib-251〜lib-300）。第1弾・第2弾とは別に1回だけ取り込む
export const LIBRARY3_VERSION = 'menu-library-2026-10-50'

const library = [...part1, ...part2]

// 登録日時は第2弾の続きの固定の過去日時にする（先生が自分で追加したメニューより上に来ないように）
export function createLibraryMenus3(): PracticeMenu[] {
  const base = Date.UTC(2026, 8, 1)
  return library.map((s, i) => {
    const date = new Date(base + (250 + i) * 60000).toISOString()
    return { ...s, id: `lib-${String(251 + i).padStart(3, '0')}`, favorite: false, createdAt: date, updatedAt: date }
  })
}
