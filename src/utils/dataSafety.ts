import { useEffect, useState } from 'react'
import { loadJSON, saveJSON } from './storage'
import { today } from './plan'
import { daysBetween } from './practiceLog'

// データはこのブラウザの中だけに保存している。消えてしまうのを防ぐための仕組み
const LAST_BACKUP_KEY = 'basketball-menu-warehouse-last-backup'
const SNOOZE_KEY = 'basketball-menu-warehouse-backup-snooze'
export const BACKUP_REMIND_DAYS = 14

// ブラウザに「このサイトのデータは自動で消さないで」と頼む（対応していない・断られた場合は何もしない）
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // 何もしない
  }
}

export function markBackedUp() {
  saveJSON(LAST_BACKUP_KEY, today())
  window.dispatchEvent(new Event('bmw-backup'))
}

const readDate = (key: string) => {
  const v = loadJSON(key)
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

// 最後のバックアップ日と、知らせるべきかどうか
export function useBackupStatus() {
  const [lastBackup, setLastBackup] = useState(() => readDate(LAST_BACKUP_KEY))
  const [snoozedUntil, setSnoozedUntil] = useState(() => readDate(SNOOZE_KEY))
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    const update = () => setLastBackup(readDate(LAST_BACKUP_KEY))
    window.addEventListener('bmw-backup', update)
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
    return () => window.removeEventListener('bmw-backup', update)
  }, [])

  const base = today()
  const daysSince = lastBackup ? daysBetween(lastBackup, base) : null
  const due = daysSince === null || daysSince >= BACKUP_REMIND_DAYS
  const snoozed = snoozedUntil !== null && snoozedUntil > base

  // 「あとで」：3日間は知らせない
  const snooze = () => {
    const d = new Date(Date.parse(base) + 3 * 86400000).toISOString().slice(0, 10)
    saveJSON(SNOOZE_KEY, d)
    setSnoozedUntil(d)
  }

  return { lastBackup, daysSince, due, snoozed, snooze, persisted }
}
