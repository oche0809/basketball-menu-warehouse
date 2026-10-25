import { useEffect, useRef, useState } from 'react'
import { loadJSON, saveJSON } from '../utils/storage'

// 練習中のメニューごとのタイマー。時刻（Date.now）で数えるので、画面を移動しても・スリープしてもずれない
const TIMER_KEY = 'basketball-menu-warehouse-run-timer'

// running のときは endsAt（終わる時刻）、止まっているときは remaining（残りミリ秒）で持つ
type TimerState = { itemId: string; running: boolean; endsAt: number; remaining: number }

function loadTimer(itemId: string, total: number): TimerState {
  const d = loadJSON(TIMER_KEY) as Partial<TimerState> | null
  if (d && d.itemId === itemId && typeof d.endsAt === 'number' && typeof d.remaining === 'number') return d as TimerState
  return { itemId, running: false, endsAt: 0, remaining: total }
}

const fmt = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// 合図の音（Web Audio。音声ファイルは使わない）。iPhone では一度ボタンを押してからでないと鳴らないので、スタート時に準備する
let audio: AudioContext | null = null
function prepareAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}
function beep(times: number, freq = 880) {
  if (!audio) return
  for (let i = 0; i < times; i++) {
    const t = audio.currentTime + i * 0.35
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }
}

type Props = { itemId: string; minutes: number; onNext?: () => void }

export function PracticeTimer({ itemId, minutes, onNext }: Props) {
  const total = minutes * 60000
  const [state, setState] = useState(() => loadTimer(itemId, total))
  const [now, setNow] = useState(() => Date.now())
  const warned = useRef(false)
  const finished = useRef(false)

  useEffect(() => saveJSON(TIMER_KEY, state), [state])

  const remaining = state.running ? state.endsAt - now : state.remaining
  const done = remaining <= 0

  // 動いている間は画面を更新し、残り1分と終了で音を鳴らす
  useEffect(() => {
    if (!state.running) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [state.running])

  useEffect(() => {
    if (!state.running) return
    if (remaining <= 60000 && remaining > 0 && total > 60000 && !warned.current) {
      warned.current = true
      beep(1, 660)
    }
    if (remaining <= 0 && !finished.current) {
      finished.current = true
      beep(3)
      navigator.vibrate?.([300, 150, 300, 150, 300])
    }
  }, [remaining, state.running, total])

  // 動いている間は画面が消えないようにする（対応しているブラウザだけ）
  useEffect(() => {
    if (!state.running || done || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = () =>
      navigator.wakeLock.request('screen').then(
        (l) => (alive ? (lock = l) : void l.release()),
        () => {},
      )
    void request()
    const onVisible = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [state.running, done])

  const start = () => {
    prepareAudio()
    const t = Date.now()
    setNow(t)
    finished.current = false
    if (state.remaining > 60000) warned.current = false
    setState((s) => ({ ...s, running: true, endsAt: t + Math.max(0, s.remaining) }))
  }
  const pause = () => {
    const t = Date.now()
    setNow(t)
    setState((s) => ({ ...s, running: false, remaining: Math.max(0, s.endsAt - t) }))
  }
  const reset = () => {
    warned.current = false
    finished.current = false
    setState({ itemId, running: false, endsAt: 0, remaining: total })
  }
  const addMinute = () => {
    finished.current = false
    // 1分足して残りが1分より多くなれば、残り1分の合図をもう一度鳴らす
    warned.current = remaining + 60000 <= 60000
    setState((s) => (s.running ? { ...s, endsAt: Math.max(s.endsAt, Date.now()) + 60000 } : { ...s, remaining: Math.max(0, s.remaining) + 60000 }))
  }

  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  const btn = 'h-12 rounded-xl border font-bold'

  return (
    <div className={`mt-4 rounded-xl border p-4 ${done ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-stone-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">⏱ タイマー</p>
        {done && <p className="font-bold text-rose-700 motion-safe:animate-pulse">時間です！</p>}
      </div>
      <p className={`text-center font-mono text-6xl font-bold tabular-nums ${done ? 'text-rose-600' : remaining <= 60000 ? 'text-amber-600' : 'text-slate-800'}`} aria-live="off">
        {done ? '0:00' : fmt(remaining)}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${done ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {done ? (
          <button type="button" onClick={reset} className={`${btn} border-slate-300 bg-white text-slate-700`}>
            ↺ 最初から
          </button>
        ) : state.running ? (
          <button type="button" onClick={pause} className={`${btn} border-amber-300 bg-amber-50 text-amber-800`}>
            ⏸ 一時停止
          </button>
        ) : (
          <button type="button" onClick={start} className={`${btn} border-orange-600 bg-orange-600 text-white`}>
            ▶ {state.remaining < total ? '再開' : 'スタート'}
          </button>
        )}
        <button type="button" onClick={addMinute} className={`${btn} border-slate-300 bg-white text-slate-700`}>
          ＋1分
        </button>
        {done && onNext ? (
          <button type="button" onClick={onNext} className={`${btn} border-emerald-600 bg-emerald-600 text-white`}>
            ✓ 次へ
          </button>
        ) : (
          <button type="button" onClick={reset} disabled={!state.running && state.remaining === total} className={`${btn} border-slate-300 bg-white text-slate-700 disabled:opacity-30`}>
            ↺ リセット
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">残り1分と終了時に音でお知らせします（消音モードでは鳴らないことがあります）。</p>
    </div>
  )
}
