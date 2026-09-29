import { useEffect, useLayoutEffect, useState } from 'react'
import type { PracticePlanItem } from '../types/menu'
import { loadJSON, saveJSON } from './storage'

const SESSION_KEY = 'basketball-menu-warehouse-practice-session'

// 実施状態（その日だけの一時的な状態）。現在位置は並び替え・削除に強いよう項目IDで持つ
type PracticeSession = {
  completedItemIds: string[]
  currentItemId: string | null
}

const EMPTY_SESSION: PracticeSession = { completedItemIds: [], currentItemId: null }

function loadSession(): PracticeSession {
  const d = loadJSON(SESSION_KEY) as Record<string, unknown> | null
  if (!d || typeof d !== 'object') return EMPTY_SESSION
  return {
    completedItemIds: Array.isArray(d.completedItemIds) ? d.completedItemIds.filter((v): v is string => typeof v === 'string') : [],
    currentItemId: typeof d.currentItemId === 'string' ? d.currentItemId : null,
  }
}

export function usePracticeSession(items: PracticePlanItem[]) {
  const [session, setSession] = useState<PracticeSession>(loadSession)

  useLayoutEffect(() => saveJSON(SESSION_KEY, session), [session])

  // 計画から消えた項目の実施状態は残さない
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id))
    setSession((s) => {
      const completedItemIds = s.completedItemIds.filter((id) => ids.has(id))
      const currentItemId = s.currentItemId && ids.has(s.currentItemId) ? s.currentItemId : null
      return completedItemIds.length === s.completedItemIds.length && currentItemId === s.currentItemId ? s : { completedItemIds, currentItemId }
    })
  }, [items])

  const completedIds = new Set(session.completedItemIds)
  const completedCount = items.filter((i) => completedIds.has(i.id)).length
  const firstOpen = items.findIndex((i) => !completedIds.has(i.id))
  const allDone = items.length > 0 && firstOpen === -1
  const found = items.findIndex((i) => i.id === session.currentItemId)
  // 現在位置が未設定なら最初の未実施メニュー。すべて実施済みなら -1（練習完了）
  const currentIndex = found >= 0 ? found : allDone ? -1 : Math.max(0, firstOpen)

  const goTo = (index: number) => {
    const item = items[index]
    if (item) setSession((s) => ({ ...s, currentItemId: item.id }))
  }

  const start = () => {
    if (session.currentItemId === null && currentIndex >= 0) goTo(currentIndex)
  }

  const complete = () => {
    const item = items[currentIndex]
    if (!item) return
    const done = new Set(completedIds).add(item.id)
    const nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : items.findIndex((i) => !done.has(i.id))
    setSession({ completedItemIds: [...done], currentItemId: nextIndex >= 0 ? items[nextIndex].id : null })
  }

  const uncomplete = () => {
    const item = items[currentIndex]
    if (item) setSession((s) => ({ ...s, completedItemIds: s.completedItemIds.filter((id) => id !== item.id) }))
  }

  const next = () => {
    if (currentIndex < items.length - 1) goTo(currentIndex + 1)
    else if (allDone) setSession((s) => ({ ...s, currentItemId: null }))
  }

  const prev = () => goTo(currentIndex === -1 ? items.length - 1 : currentIndex - 1)

  const reset = () => setSession(EMPTY_SESSION)

  return {
    completedIds,
    completedCount,
    currentIndex,
    allDone,
    started: session.completedItemIds.length > 0 || session.currentItemId !== null,
    start,
    complete,
    uncomplete,
    goTo,
    next,
    prev,
    reset,
  }
}

export type SessionActions = ReturnType<typeof usePracticeSession>
