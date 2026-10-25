import { describe, expect, it } from 'vitest'
import { BUILTIN_ANIMATIONS } from '../src/data/menuAnimations'
import officialData from '../src/data/officialAnimations.json'
import videoData from '../src/data/referenceVideos.json'
import { createLibraryMenus } from '../src/data/libraryMenus'
import { createLibraryMenus2 } from '../src/data/libraryMenus2'
import { createLibraryMenus3 } from '../src/data/libraryMenus3'
import { createLibraryMenus4 } from '../src/data/libraryMenus4'
import { createSampleMenus } from '../src/data/sampleMenus'
import { CATEGORIES } from '../src/data/options'
import { validateAnimation } from '../src/utils/animation'
import { normalizeVideos, youtubeId } from '../src/utils/referenceVideos'

// アプリに入っている公式データが壊れていないか
const menus = [...createSampleMenus(), ...createLibraryMenus(), ...createLibraryMenus2(), ...createLibraryMenus3(), ...createLibraryMenus4()]
const ids = new Set(menus.map((m) => m.id))

describe('公式データ', () => {
  it('メニューの id が重複していない', () => {
    expect(ids.size).toBe(menus.length)
  })

  it('メニューのカテゴリはすべて選択肢にある', () => {
    expect(menus.filter((m) => !CATEGORIES.includes(m.category)).map((m) => m.id)).toEqual([])
  })

  it('すべてのメニューに動き（公式またはアプリ内蔵）がある', () => {
    const anim = (officialData as { animations: Record<string, unknown> }).animations
    expect(menus.filter((m) => !anim[m.id] && !BUILTIN_ANIMATIONS[m.id]).map((m) => m.id)).toEqual([])
  })

  it('公式の動きはすべて検証に通り、存在するメニューのもの', () => {
    for (const [id, a] of Object.entries((officialData as { animations: Record<string, unknown> }).animations)) {
      expect(ids.has(id), id).toBe(true)
      expect(validateAnimation(a).errors, id).toEqual([])
    }
    for (const [id, a] of Object.entries(BUILTIN_ANIMATIONS)) expect(validateAnimation(a).errors, id).toEqual([])
  })

  it('参考動画は存在するメニューのもので、YouTube の URL として正しい', () => {
    for (const [id, list] of Object.entries((videoData as { videos: Record<string, unknown> }).videos)) {
      expect(ids.has(id), id).toBe(true)
      const videos = normalizeVideos(list)!
      expect(videos.length, id).toBe((list as unknown[]).length)
      for (const v of videos) expect(youtubeId(v.url), v.url).not.toBeNull()
    }
  })
})
