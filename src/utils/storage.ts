import { useEffect, useState } from 'react'
import { LIBRARY_VERSION, createLibraryMenus } from '../data/libraryMenus'
import { LIBRARY2_VERSION, createLibraryMenus2 } from '../data/libraryMenus2'
import { createSampleMenus } from '../data/sampleMenus'
import type { MenuInput, PracticeMenu } from '../types/menu'

const STORAGE_KEY = 'basketball-menu-warehouse'
// 追加メニュー集をすでに取り込んだかどうかの記録（削除したメニューが復活しないようにするため）
const LIBRARY_KEY = 'basketball-menu-warehouse-library'
// 追加メニュー集は、まとまり（パック）ごとに1回だけ取り込む。新しいパックを足しても、前のパックで削除したメニューは戻らない
const LIBRARY_PACKS = [
  { key: LIBRARY_KEY, version: LIBRARY_VERSION, create: createLibraryMenus },
  { key: 'basketball-menu-warehouse-library-2', version: LIBRARY2_VERSION, create: createLibraryMenus2 },
]

export function loadJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できない環境（プライベートモード等）では何もしない
  }
}

function loadMenus(): PracticeMenu[] {
  const data = loadJSON(STORAGE_KEY)
  // 読み込めない・未保存の場合はサンプルで始める
  let menus: PracticeMenu[] = Array.isArray(data) ? data : createSampleMenus()
  // まだ取り込んでいない追加メニュー集があれば、既存のメニューはそのままに、まだないものだけを後ろに追加する
  for (const pack of LIBRARY_PACKS) {
    if (loadJSON(pack.key) === pack.version) continue
    const ids = new Set(menus.map((m) => m.id))
    menus = [...menus, ...pack.create().filter((m) => !ids.has(m.id))]
  }
  return menus
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useMenus() {
  const [menus, setMenus] = useState<PracticeMenu[]>(loadMenus)

  useEffect(() => {
    saveJSON(STORAGE_KEY, menus)
    for (const pack of LIBRARY_PACKS) saveJSON(pack.key, pack.version)
  }, [menus])

  const addMenu = (input: MenuInput) => {
    const now = new Date().toISOString()
    setMenus((prev) => [...prev, { ...input, id: newId(), favorite: false, createdAt: now, updatedAt: now }])
  }

  const updateMenu = (id: string, input: Partial<MenuInput>) => {
    const now = new Date().toISOString()
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...input, updatedAt: now } : m)))
  }

  const deleteMenu = (id: string) => {
    setMenus((prev) => prev.filter((m) => m.id !== id))
  }

  const toggleFavorite = (id: string) => {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)))
  }

  const replaceMenus = (list: PracticeMenu[]) => setMenus(list)

  return { menus, addMenu, updateMenu, deleteMenu, toggleFavorite, replaceMenus }
}

export type MenuActions = ReturnType<typeof useMenus>
