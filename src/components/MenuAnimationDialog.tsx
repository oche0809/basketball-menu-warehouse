import { useEffect, useState, type ReactNode } from 'react'
import type { AnimAction, AnimPoint, MenuAnimation } from '../types/menu'
import { RIM, buildFrames, type Frame } from '../utils/animation'

// コートは 150×140（ハーフコート 15m×14m を 1/10 にした単位）。データの 0〜100 をこの大きさに合わせる
const W = 150
const H = 140
const sx = (x: number) => (x / 100) * W
const sy = (y: number) => (y / 100) * H
const toXY = (p: AnimPoint) => ({ x: sx(p.x), y: sy(p.y) })
const PLAYER_R = 5
const STEP_MS = 1700

// ハーフコートの線（上がエンドライン・ゴール側）
function Court() {
  return (
    <g fill="none" stroke="#94a3b8" strokeWidth="0.6">
      <rect x="0.3" y="0.3" width={W - 0.6} height={H - 0.6} />
      <rect x="50.5" y="0.3" width="49" height="57.7" />
      <path d="M 57 58 A 18 18 0 0 0 93 58" />
      <path d="M 57 58 A 18 18 0 0 1 93 58" strokeDasharray="2 2" />
      <path d="M 9 0.3 L 9 29.9 A 67.5 67.5 0 0 0 141 29.9 L 141 0.3" />
      <path d="M 62.5 15.75 A 12.5 12.5 0 0 0 87.5 15.75" />
      <path d="M 57 139.7 A 18 18 0 0 1 93 139.7" />
      <line x1="66" y1="12" x2="84" y2="12" stroke="#475569" strokeWidth="1" />
      <line x1="75" y1="12" x2="75" y2="13.5" stroke="#ea580c" />
      <circle cx="75" cy="15.75" r="2.25" stroke="#ea580c" strokeWidth="0.8" />
    </g>
  )
}

// 2点の間を、両端の選手の円にかからないよう少し縮める
function shorten(a: { x: number; y: number }, b: { x: number; y: number }, startGap: number, endGap: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return {
    a: { x: a.x + (dx / len) * startGap, y: a.y + (dy / len) * startGap },
    b: { x: b.x - (dx / len) * endGap, y: b.y - (dy / len) * endGap },
    ux: dx / len,
    uy: dy / len,
    len,
  }
}

// ドリブルは波線で表す
function zigzag(a: { x: number; y: number }, b: { x: number; y: number }) {
  const s = shorten(a, b, PLAYER_R + 0.5, PLAYER_R + 2)
  const n = Math.max(2, Math.floor((s.len - PLAYER_R * 2) / 3))
  const pts = [`${s.a.x},${s.a.y}`]
  for (let i = 1; i < n; i++) {
    const t = i / n
    const off = i % 2 === 0 ? 1.4 : -1.4
    pts.push(`${s.a.x + (s.b.x - s.a.x) * t - s.uy * off},${s.a.y + (s.b.y - s.a.y) * t + s.ux * off}`)
  }
  pts.push(`${s.b.x},${s.b.y}`)
  return pts.join(' ')
}

// 現在のステップで「何がどこへ動いたか」を矢印・線で描く
function StepMarks({ actions, prev, next }: { actions: AnimAction[]; prev: Frame; next: Frame }) {
  const rim = toXY(RIM)
  return (
    <g>
      {actions.map((a, i) => {
        if (a.type === 'move' || a.type === 'cut') {
          const s = shorten(toXY(prev.pos[a.player]), toXY(a.to), PLAYER_R + 0.5, PLAYER_R + 1.5)
          return <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#334155" strokeWidth="1.1" markerEnd="url(#arrow-dark)" />
        }
        if (a.type === 'dribble') {
          return <polyline key={i} points={zigzag(toXY(prev.pos[a.player]), toXY(a.to))} fill="none" stroke="#334155" strokeWidth="1.1" markerEnd="url(#arrow-dark)" />
        }
        if (a.type === 'screen') {
          const s = shorten(toXY(prev.pos[a.player]), toXY(a.to), PLAYER_R + 0.5, PLAYER_R + 1)
          return (
            <g key={i} stroke="#334155" strokeWidth="1.1">
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} />
              <line x1={s.b.x - s.uy * 3} y1={s.b.y + s.ux * 3} x2={s.b.x + s.uy * 3} y2={s.b.y - s.ux * 3} strokeWidth="1.2" />
            </g>
          )
        }
        if (a.type === 'pass') {
          const s = shorten(toXY(prev.pos[a.from]), toXY(next.pos[a.to]), PLAYER_R + 0.5, PLAYER_R + 1.5)
          return <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#ea580c" strokeWidth="1.1" strokeDasharray="2.5 1.8" markerEnd="url(#arrow-ball)" />
        }
        if (a.type === 'shoot') {
          const p = toXY(next.pos[a.player])
          const cx = (p.x + rim.x) / 2
          const cy = Math.min(p.y, rim.y) - 14
          return (
            <path
              key={i}
              d={`M ${p.x} ${p.y} Q ${cx} ${cy} ${rim.x} ${rim.y - 1}`}
              fill="none"
              stroke="#ea580c"
              strokeWidth="1.1"
              strokeDasharray="0.8 1.6"
              strokeLinecap="round"
              markerEnd="url(#arrow-ball)"
            />
          )
        }
        if (a.type === 'rebound') {
          const s = shorten(rim, toXY(next.pos[a.player]), 2.5, PLAYER_R + 1.5)
          return <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#64748b" strokeWidth="0.7" strokeDasharray="0.8 1.6" strokeLinecap="round" markerEnd="url(#arrow-dark)" />
        }
        return null
      })}
    </g>
  )
}

const TEAM_STYLE = {
  offense: { fill: '#ea580c', stroke: '#ffffff', text: '#ffffff' },
  defense: { fill: '#ffffff', stroke: '#1e293b', text: '#1e293b' },
  neutral: { fill: '#64748b', stroke: '#ffffff', text: '#ffffff' },
}

// label・footer はプレビューとして使うとき用（Phase 11：Claudeが作った動きの確認）
type Props = {
  title: string
  animation: MenuAnimation
  onClose: () => void
  label?: string
  footer?: ReactNode
}

// 動きの解説：ハーフコート上で選手とボールをステップごとに動かす。自動再生と1ステップずつの操作ができる
export function MenuAnimationDialog({ title, animation, onClose, label = '🎬 動きを見る', footer }: Props) {
  const frames = buildFrames(animation)
  const last = animation.steps.length
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  // 再生中は一定間隔で次のステップへ。最後まで行ったら止まる
  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStep((s) => Math.min(last, s + 1)), step === 0 ? 400 : STEP_MS)
    return () => clearTimeout(t)
  }, [playing, step, last])

  const togglePlay = () => {
    if (!playing && step >= last) setStep(0)
    setPlaying((p) => !p)
  }
  const go = (delta: number) => {
    setPlaying(false)
    setStep((s) => Math.min(last, Math.max(0, s + delta)))
  }
  const restart = () => {
    setPlaying(false)
    setStep(0)
  }

  // PC ではキーボード（← → スペース）でも操作できる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      // ボタンや入力欄にいるときのスペースは、そちらの操作を優先する
      else if (e.key === ' ' && !(e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select'))) {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const frame = frames[step]
  const ballPos = frame.holder
    ? {
        x: sx(frame.pos[frame.holder].x) + 4.3,
        y: sy(frame.pos[frame.holder].y) - 4.3,
      }
    : { x: sx(frame.ballAt.x), y: sy(frame.ballAt.y) }
  const btn = 'h-12 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30'

  return (
    <div className="fixed inset-0 z-40 m-0 bg-black/40 md:grid md:place-items-center md:p-4">
      <div role="dialog" aria-modal="true" aria-label={label} className="flex h-full w-full flex-col bg-white md:h-auto md:max-h-[94vh] md:max-w-2xl md:rounded-2xl md:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-orange-700">{label}</p>
            <h2 className="truncate text-lg font-bold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="mx-auto w-full max-w-md rounded-lg bg-amber-50 p-1.5">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="ハーフコート上の選手とボールの位置">
              <defs>
                <marker id="arrow-dark" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                  <path d="M0,0 L6,3 L0,6 z" fill="#334155" />
                </marker>
                <marker id="arrow-ball" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                  <path d="M0,0 L6,3 L0,6 z" fill="#ea580c" />
                </marker>
              </defs>
              <Court />
              {step > 0 && <StepMarks key={step} actions={animation.steps[step - 1].actions} prev={frames[step - 1]} next={frame} />}
              {animation.players.map((p) => {
                const pos = toXY(frame.pos[p.id])
                const c = TEAM_STYLE[p.team]
                return (
                  <g key={p.id} className="transition-transform duration-700 ease-in-out motion-reduce:transition-none" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
                    <circle r={PLAYER_R} fill={c.fill} stroke={c.stroke} strokeWidth={p.team === 'defense' ? 0.9 : 0.6} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="5.4" fontWeight="bold" fill={c.text}>
                      {p.label}
                    </text>
                  </g>
                )
              })}
              <g
                className="transition-transform duration-700 ease-in-out motion-reduce:transition-none"
                style={{
                  transform: `translate(${ballPos.x}px, ${ballPos.y}px)`,
                }}
              >
                <circle r="2.5" fill="#f59e0b" stroke="#92400e" strokeWidth="0.6" />
              </g>
            </svg>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-orange-700">{step === 0 ? 'はじめの配置' : `STEP ${step} / ${last}`}</p>
            <button type="button" onClick={restart} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              ↺ 最初から
            </button>
          </div>
          <p aria-live="polite" className="min-h-16 rounded-lg border border-slate-200 bg-stone-50 p-3 leading-relaxed break-words">
            {step === 0 ? '選手がこの位置からスタートします。「▶ 再生」または「進む →」で動きを確認できます。' : animation.steps[step - 1].text}
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-bold text-orange-600">●</span> 攻撃{'　'}
            <span className="font-bold">○</span> 守備{'　'}
            <span className="font-bold text-slate-500">●</span> コーチなど ／ 実線＝移動・カット　波線＝ドリブル{'　'}
            <span className="text-orange-600">破線＝パス　点線＝シュート</span>
            {'　'}T字＝スクリーン
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => go(-1)} disabled={step === 0} className={btn} aria-label="1ステップ戻る">
              ← 戻る
            </button>
            <button type="button" onClick={togglePlay} className="h-12 rounded-lg bg-orange-600 font-bold text-white hover:bg-orange-700">
              {playing ? '⏸ 一時停止' : '▶ 再生'}
            </button>
            <button type="button" onClick={() => go(1)} disabled={step === last} className={btn} aria-label="1ステップ進む">
              進む →
            </button>
          </div>
          {footer}
        </div>
      </div>
    </div>
  )
}
