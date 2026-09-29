import { formatDate, timeDiffLabel } from '../pages/PlanPage'

export type PrintRow = { key: string; title: string; category: string; duration: number; note?: string; nextNote?: string }

type Props = {
  plan: { title: string; date: string; target: string; players: number; plannedDuration: number; reflection?: string }
  rows: PrintRow[]
}

// 印刷専用のレイアウト（画面では表示しない）。白黒でも読めるよう、色ではなく枠線と太字で区切る
export function PrintPlan({ plan, rows }: Props) {
  const total = rows.reduce((sum, r) => sum + r.duration, 0)
  const info = [plan.target, plan.players > 0 && `${plan.players}人`].filter(Boolean).join('・')

  return (
    <article className="hidden text-[11pt] leading-relaxed text-black print:block">
      <p className="border-b-2 border-black pb-1 text-[10pt] font-bold tracking-widest">練習計画</p>
      <h1 className="mt-3 text-[18pt] leading-tight font-bold">{plan.title || '今日の練習'}</h1>
      <p className="mt-1">
        {formatDate(plan.date)}
        {info && `　${info}`}
      </p>

      <table className="mt-3 w-full border-collapse text-center">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1">
              予定 <span className="font-bold">{plan.plannedDuration}分</span>
            </td>
            <td className="border border-black px-2 py-1">
              計画合計 <span className="font-bold">{total}分</span>
            </td>
            <td className="border border-black px-2 py-1 font-bold">{timeDiffLabel(plan.plannedDuration, total)}</td>
          </tr>
        </tbody>
      </table>

      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="print-keep border border-black px-3 py-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-black pb-1">
              <p className="font-bold">
                {i + 1}．{r.title}
              </p>
              <p className="shrink-0 font-bold">{r.duration}分</p>
            </div>
            <p className="mt-1 text-[10pt]">カテゴリ：{r.category || '—'}</p>
            {r.note && (
              <p className="mt-1 whitespace-pre-wrap">
                <span className="font-bold">今回のメモ：</span>
                {r.note}
              </p>
            )}
            {r.nextNote && (
              <p className="mt-1 whitespace-pre-wrap">
                <span className="font-bold">次回の改善メモ：</span>
                {r.nextNote}
              </p>
            )}
          </li>
        ))}
      </ol>

      {plan.reflection && (
        <section className="print-keep mt-5">
          <h2 className="border-b-2 border-black pb-1 font-bold">練習後の振り返り</h2>
          <p className="mt-2 whitespace-pre-wrap">{plan.reflection}</p>
        </section>
      )}
    </article>
  )
}
