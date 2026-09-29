import type { PracticeMenu } from '../types/menu'
import { part1 } from './library2/part1'
import { part2 } from './library2/part2'
import { part3 } from './library2/part3'
import { part4 } from './library2/part4'
import { part5 } from './library2/part5'

// 追加メニュー集・第2弾（150件）。IDは固定（lib-101〜lib-250）。第1弾（lib-001〜lib-100）とは別に1回だけ取り込む
export const LIBRARY2_VERSION = 'menu-library-2026-09-150'

const library = [...part1, ...part2, ...part3, ...part4, ...part5]

// 登録日時は第1弾の続きの固定の過去日時にする（先生が自分で追加したメニューより上に来ないように）
export function createLibraryMenus2(): PracticeMenu[] {
  const base = Date.UTC(2026, 8, 1)
  return library.map((s, i) => {
    const date = new Date(base + (100 + i) * 60000).toISOString()
    return { ...s, id: `lib-${String(101 + i).padStart(3, '0')}`, favorite: false, createdAt: date, updatedAt: date }
  })
}
