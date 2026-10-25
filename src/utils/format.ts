import { flushSync } from 'react-dom'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 日付（YYYY-MM-DD）を「2026年10月25日（日）」の形にする
export function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${y}年${m}月${d}日（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`
}

export const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200'

export function timeDiffLabel(planned: number, total: number) {
  const diff = planned - total
  return diff > 0 ? `あと${diff}分` : diff === 0 ? 'ぴったり' : `${-diff}分オーバー`
}

// 入力中の欄を確定させてから印刷する（印刷自体はデータを変えない）
export function printPage() {
  const el = document.activeElement
  if (el instanceof HTMLElement) flushSync(() => el.blur())
  window.print()
}
