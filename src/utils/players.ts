import { useLayoutEffect, useState } from 'react'
import type { Player, PlayerRecord, RecordTest } from '../types/menu'
import { loadJSON, newId, saveJSON } from './storage'

// 選手の名前などは、この端末のブラウザの中だけに保存する（外には送らない）
const PLAYERS_KEY = 'basketball-menu-warehouse-players'
const TESTS_KEY = 'basketball-menu-warehouse-record-tests'
const RECORDS_KEY = 'basketball-menu-warehouse-player-records'

export const DEFAULT_TESTS: RecordTest[] = [
  { id: 'ft10', name: 'フリースロー（10本中）', unit: '本', better: 'higher' },
  { id: '3p10', name: '3Pシュート（10本中）', unit: '本', better: 'higher' },
  { id: 'layup60', name: '左右レイアップ（1分間）', unit: '本', better: 'higher' },
  { id: 'shuttle', name: 'シャトルラン（4ライン）', unit: '秒', better: 'lower' },
  { id: 'run12', name: '12分間走', unit: 'm', better: 'higher' },
]

const isText = (v: unknown): v is string => typeof v === 'string'
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

export function normalizePlayers(v: unknown): Player[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((x) => {
    const o = obj(x)
    if (!o || !isText(o.id) || !isText(o.name) || !o.name.trim()) return []
    return [{ id: o.id, name: o.name.trim(), number: isText(o.number) ? o.number : '', grade: isText(o.grade) ? o.grade : '', active: o.active !== false }]
  })
}

export function normalizeTests(v: unknown): RecordTest[] | null {
  if (!Array.isArray(v)) return null
  return v.flatMap((x) => {
    const o = obj(x)
    if (!o || !isText(o.id) || !isText(o.name) || !o.name.trim()) return []
    return [{ id: o.id, name: o.name.trim(), unit: isText(o.unit) ? o.unit : '', better: o.better === 'lower' ? ('lower' as const) : ('higher' as const) }]
  })
}

export function normalizeRecords(v: unknown): PlayerRecord[] {
  if (!Array.isArray(v)) return []
  const map = new Map<string, PlayerRecord>()
  for (const x of v) {
    const o = obj(x)
    if (!o || !isText(o.playerId) || !isText(o.testId) || !isText(o.date) || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) continue
    if (typeof o.value !== 'number' || !Number.isFinite(o.value)) continue
    const id = recordId(o.playerId, o.testId, o.date)
    map.set(id, { id, playerId: o.playerId, testId: o.testId, date: o.date, value: o.value })
  }
  return [...map.values()]
}

export const recordId = (playerId: string, testId: string, date: string) => `${playerId}:${testId}:${date}`

export type PlayersData = { players: Player[]; tests: RecordTest[]; records: PlayerRecord[] }

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>(() => normalizePlayers(loadJSON(PLAYERS_KEY)))
  const [tests, setTests] = useState<RecordTest[]>(() => normalizeTests(loadJSON(TESTS_KEY)) ?? DEFAULT_TESTS)
  const [records, setRecords] = useState<PlayerRecord[]>(() => normalizeRecords(loadJSON(RECORDS_KEY)))

  useLayoutEffect(() => saveJSON(PLAYERS_KEY, players), [players])
  useLayoutEffect(() => saveJSON(TESTS_KEY, tests), [tests])
  useLayoutEffect(() => saveJSON(RECORDS_KEY, records), [records])

  const addPlayer = (p: Omit<Player, 'id' | 'active'>) => setPlayers((prev) => [...prev, { ...p, id: newId(), active: true }])
  const updatePlayer = (id: string, patch: Partial<Omit<Player, 'id'>>) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  // 選手を消すと、その選手の記録も消す
  const deletePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    setRecords((prev) => prev.filter((r) => r.playerId !== id))
  }

  const addTest = (t: Omit<RecordTest, 'id'>) => setTests((prev) => [...prev, { ...t, id: newId() }])
  const deleteTest = (id: string) => {
    setTests((prev) => prev.filter((t) => t.id !== id))
    setRecords((prev) => prev.filter((r) => r.testId !== id))
  }

  // ある日・ある項目の記録をまとめて保存する。値が null の選手は、その日の記録を消す
  const saveDay = (testId: string, date: string, values: Map<string, number | null>) =>
    setRecords((prev) => {
      const ids = new Set([...values.keys()].map((pid) => recordId(pid, testId, date)))
      const kept = prev.filter((r) => !ids.has(r.id))
      const added = [...values].flatMap(([playerId, value]) => (value === null ? [] : [{ id: recordId(playerId, testId, date), playerId, testId, date, value }]))
      return [...kept, ...added]
    })

  const deleteRecord = (id: string) => setRecords((prev) => prev.filter((r) => r.id !== id))

  const replacePlayersData = (data: Partial<PlayersData>) => {
    if (data.players) setPlayers(data.players)
    if (data.tests) setTests(data.tests)
    if (data.records) setRecords(data.records)
  }

  return { players, tests, records, addPlayer, updatePlayer, deletePlayer, addTest, deleteTest, saveDay, deleteRecord, replacePlayersData }
}

export type PlayersActions = ReturnType<typeof usePlayers>

// 一番良い記録（項目の「良い向き」で決める）
export const bestOf = (values: number[], better: RecordTest['better']) => (values.length === 0 ? null : better === 'higher' ? Math.max(...values) : Math.min(...values))

// 数を見やすく（整数ならそのまま、小数は1桁まで）
export const formatValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
