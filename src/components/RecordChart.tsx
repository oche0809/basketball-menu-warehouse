import { useLayoutEffect, useRef, useState } from 'react'
import { formatValue } from '../utils/players'

// 1人・1項目の記録の推移（1本の折れ線）。系列が1つなので凡例は出さず、見出しが項目名を表す。
// 色はアプリのオレンジ（#ea580c・白地とのコントラスト確認済み）。数値は文字色で書き、線の色は使わない
type Point = { date: string; value: number }
type Props = { points: Point[]; unit: string; label: string }

// 幅は画面に合わせて実際のピクセルで描く（スマホでも文字が小さくならないように）
const H = 200
const PAD = { left: 44, right: 16, top: 16, bottom: 28 }
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

// 目盛りをきりのいい数にする
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const d = Math.max(1, Math.abs(min) * 0.1)
    min -= d
    max += d
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { lo, hi, ticks }
}

export function RecordChart({ points, unit, label }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setW(Math.max(260, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  if (points.length === 0) return null
  const values = points.map((p) => p.value)
  const { lo, hi, ticks } = niceTicks(Math.min(...values), Math.max(...values))
  const t0 = Date.parse(points[0].date)
  const t1 = Date.parse(points[points.length - 1].date)
  const x = (date: string) => (t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((Date.parse(date) - t0) / (t1 - t0)) * (W - PAD.left - PAD.right))
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join('')
  const last = points.length - 1

  // ポインタに一番近い日付の点を選ぶ（線を狙わなくても読める）
  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i
    })
    setActive(best)
  }

  const a = active !== null ? points[active] : null
  // 最新の値のラベル。上の端に近いときは点の下に書く（はみ出さないように）
  const lastY = y(points[last].value)
  const labelY = lastY < PAD.top + 18 ? lastY + 20 : lastY - 10
  return (
    <div ref={box} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        role="img"
        aria-label={`${label}の推移（${points.length}回）`}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onFocus={() => setActive(last)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? last) - 1))
          if (e.key === 'ArrowRight') setActive((i) => Math.min(last, (i ?? last) + 1))
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={12} fill="#64748b">
              {formatValue(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} fontSize={12} fill="#64748b">
          {md(points[0].date)}
        </text>
        {last > 0 && (
          <text x={W - PAD.right} y={H - 6} fontSize={12} fill="#64748b" textAnchor="end">
            {md(points[last].date)}
          </text>
        )}
        {a && <line x1={x(a.date)} x2={x(a.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="#94a3b8" strokeWidth={1} />}
        <path d={path} fill="none" stroke="#ea580c" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={i === active ? 6 : 4} fill="#ea580c" stroke="#fff" strokeWidth={2} />
        ))}
        {/* 最新の値だけ直接書く（全部の点には書かない） */}
        <text x={x(points[last].date)} y={labelY} textAnchor={last > 0 ? 'end' : 'middle'} fontSize={13} fontWeight={700} fill="#1e293b">
          {formatValue(points[last].value)}
          {unit}
        </text>
      </svg>
      {a && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-md"
          style={{ left: `${(x(a.date) / W) * 100}%`, transform: `translateX(${x(a.date) > W / 2 ? '-105%' : '5%'})` }}
        >
          <p className="font-bold text-slate-900">
            {formatValue(a.value)}
            {unit}
          </p>
          <p className="text-xs text-slate-500">{a.date.replaceAll('-', '/')}</p>
        </div>
      )}
    </div>
  )
}
