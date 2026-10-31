import type { PracticeMenu } from '../types/menu'
import { part1 } from './library5/part1'
import { part2 } from './library5/part2'
import { part3 } from './library5/part3'
import { part4 } from './library5/part4'

// 追加メニュー集・第5弾（60件）：生徒が家で1人でできる自主練習（ボールだけの個人練習30・体幹/筋トレ/体のケア30）。IDは固定（lib-331〜lib-390）。後から足すときは必ず末尾に足す（IDがずれないように）
export const LIBRARY5_VERSION = 'menu-library-2026-10-31-home-2'

const library = [...part1, ...part2, ...part3, ...part4]

// 登録日時は第4弾の続きの固定の過去日時にする（先生が自分で追加したメニューより上に来ないように）
export function createLibraryMenus5(): PracticeMenu[] {
  const base = Date.UTC(2026, 8, 1)
  return library.map((s, i) => {
    const date = new Date(base + (330 + i) * 60000).toISOString()
    return { ...s, id: `lib-${String(331 + i).padStart(3, '0')}`, favorite: false, createdAt: date, updatedAt: date }
  })
}
