import { describe, expect, it } from 'vitest'
import { createSampleMenus } from '../src/data/sampleMenus'
import type { PracticeLogEntry, PracticeMenu, PracticePlan } from '../src/types/menu'
import { parseBackup } from '../src/utils/backup'
import { ALL, EMPTY_CONDITIONS, MEDIA_OPTIONS, filterMenus } from '../src/utils/filters'
import { analyzeLog, normalizeLog } from '../src/utils/practiceLog'
import { bestOf, normalizeRecords } from '../src/utils/players'
import { getMenuVideos, normalizeVideos, youtubeId } from '../src/utils/referenceVideos'
import { decodeStudentPlan, encodeStudentPlan } from '../src/utils/studentView'
import { EMPTY_BOARD, normalizeBoard, publishToBoard, removeFromBoard, splitBoard } from '../src/utils/teamBoard'

const sample = createSampleMenus()
const custom: PracticeMenu = {
  ...sample[0],
  id: 'custom-1',
  title: '先生のオリジナル',
  purpose: 'テストの目的',
  videos: [{ title: 'v', url: 'https://youtu.be/YD1_cxU61dg' }],
}
const menus = [...sample, custom]

describe('参考動画', () => {
  it('危険な URL や形の崩れたものは取り込まない', () => {
    expect(normalizeVideos([{ title: 'x', url: 'javascript:alert(1)' }, { url: 'https://example.com/a' }, 'bad'])).toEqual([
      { title: 'https://example.com/a', url: 'https://example.com/a' },
    ])
    expect(normalizeVideos('bad')).toBeNull()
  })

  it('いろいろな YouTube の URL から動画 ID を取り出せる', () => {
    for (const u of ['https://www.youtube.com/watch?v=YD1_cxU61dg', 'https://youtu.be/YD1_cxU61dg', 'https://www.youtube.com/shorts/YD1_cxU61dg', 'https://www.youtube.com/watch?t=3&v=YD1_cxU61dg'])
      expect(youtubeId(u), u).toBe('YD1_cxU61dg')
    expect(youtubeId('https://example.com/watch?v=x')).toBeNull()
  })

  it('先生が登録した動画（空も含む）は公式より優先する', () => {
    expect(getMenuVideos(custom).source).toBe('personal')
    expect(getMenuVideos({ ...sample[4], videos: [] }).videos).toEqual([])
  })
})

describe('絞り込み', () => {
  it('「どちらもなし」は動きも動画もないメニューだけ', () => {
    const noMedia = { ...custom, id: 'none', videos: [] }
    const res = filterMenus([...menus, noMedia], '', ALL, { ...EMPTY_CONDITIONS, media: MEDIA_OPTIONS[3] })
    expect(res.map((m) => m.id)).toEqual(['none'])
  })

  it('キーワードは全角・半角を区別しない', () => {
    expect(filterMenus(menus, 'ｵﾘｼﾞﾅﾙ', ALL, EMPTY_CONDITIONS).map((m) => m.id)).toEqual(['custom-1'])
  })
})

describe('生徒用リンク', () => {
  const plan: PracticePlan = {
    title: '今日の練習',
    date: '2026-10-25',
    target: '全員',
    players: 10,
    plannedDuration: 60,
    items: [
      { id: 'a', menuId: sample[4].id, duration: 10, note: '秘密のメモ' },
      { id: 'b', menuId: 'custom-1', duration: 15, note: '' },
    ],
  }

  it('メモは初期設定では載せず、オリジナルメニューの中身と動画は届く', async () => {
    const code = await encodeStudentPlan(plan, menus, false)
    const view = await decodeStudentPlan(code)
    expect(view?.title).toBe('今日の練習')
    expect(view?.items.map((i) => i.note)).toEqual([undefined, undefined])
    expect(view?.items[1].menu?.title).toBe('先生のオリジナル')
    expect(view?.items[1].menu?.videos?.[0].url).toBe('https://youtu.be/YD1_cxU61dg')
  })

  it('チェックしたときだけメモを載せる', async () => {
    const view = await decodeStudentPlan(await encodeStudentPlan(plan, menus, true))
    expect(view?.items[0].note).toBe('秘密のメモ')
  })

  it('壊れたリンクは null', async () => {
    expect(await decodeStudentPlan('zこわれた')).toBeNull()
    expect(await decodeStudentPlan('')).toBeNull()
  })
})

describe('チームページ', () => {
  const plan = (date: string, title: string): PracticePlan => ({
    title,
    date,
    target: '全員',
    players: 10,
    plannedDuration: 60,
    items: [
      { id: 'a', menuId: sample[0].id, duration: 10, note: '秘密のメモ' },
      { id: 'b', menuId: 'custom-1', duration: 15 },
    ],
  })

  it('同じ日に公開し直すと置き換わり、日付順に並ぶ', () => {
    let board = publishToBoard(EMPTY_BOARD, plan('2026-10-28', '水曜'), menus, false)
    board = publishToBoard(board, plan('2026-10-27', '火曜'), menus, false)
    board = publishToBoard(board, plan('2026-10-28', '水曜（変更）'), menus, false)
    expect(board.plans.map((e) => [e.date, e.plan.t])).toEqual([
      ['2026-10-27', '火曜'],
      ['2026-10-28', '水曜（変更）'],
    ])
    expect(removeFromBoard(board, '2026-10-27').plans.map((e) => e.date)).toEqual(['2026-10-28'])
  })

  it('メモはチェックしたときだけ載り、オリジナルメニューの中身も届く', () => {
    const [hidden] = splitBoard(publishToBoard(EMPTY_BOARD, plan('2026-10-28', 'x'), menus, false), '2026-10-01').upcoming
    expect(hidden.items[0].note).toBeUndefined()
    expect(hidden.items[1].menu?.title).toBe('先生のオリジナル')
    const [shown] = splitBoard(publishToBoard(EMPTY_BOARD, plan('2026-10-28', 'x'), menus, true), '2026-10-01').upcoming
    expect(shown.items[0].note).toBe('秘密のメモ')
  })

  it('今日以降は近い順、終わった練習は新しい順', () => {
    let board = EMPTY_BOARD
    for (const d of ['2026-10-20', '2026-10-24', '2026-10-26', '2026-10-30']) board = publishToBoard(board, plan(d, d), menus, false)
    const { upcoming, past } = splitBoard(board, '2026-10-26')
    expect(upcoming.map((p) => p.date)).toEqual(['2026-10-26', '2026-10-30'])
    expect(past.map((p) => p.date)).toEqual(['2026-10-24', '2026-10-20'])
  })

  it('古いものから消して30件までにする', () => {
    let board = EMPTY_BOARD
    for (let i = 1; i <= 31; i++) board = publishToBoard(board, plan(`2026-10-${String(i).padStart(2, '0')}`, ''), menus, false)
    expect(board.plans).toHaveLength(30)
    expect(board.plans[0].date).toBe('2026-10-02')
  })

  it('形の崩れたファイルは空として扱う', () => {
    expect(normalizeBoard(null).plans).toEqual([])
    expect(normalizeBoard({ v: 1, plans: [{ date: 'x' }, { date: '2026-10-01', plan: { v: 2 } }] }).plans).toEqual([])
  })
})

describe('実施記録', () => {
  const e = (date: string, itemId: string, category: string, duration: number, menuId = 'm'): PracticeLogEntry => ({
    id: `${date}:${itemId}`, date, itemId, menuId, title: 't', category, duration, planTitle: '', recordedAt: '',
  })

  it('同じ日の同じ項目は1件にまとめ、壊れた記録は捨てる', () => {
    expect(normalizeLog([e('2026-10-01', 'a', 'パス', 10), e('2026-10-01', 'a', 'パス', 20), { date: 'x' }])).toHaveLength(1)
  })

  it('期間内でやっていないカテゴリと、半分以上を占めるカテゴリを知らせる', () => {
    const log = [e('2026-10-20', 'a', 'シュート', 50), e('2026-10-21', 'b', 'パス', 10), e('2026-08-01', 'c', 'ドリブル', 30)]
    const r = analyzeLog(log, [], 30, '2026-10-25')
    expect(r.inRange).toHaveLength(2)
    expect(r.missing).toContain('ドリブル')
    expect(r.dominant?.category).toBe('シュート')
  })

  it('30日以上やっていないお気に入りを出す', () => {
    const fav = [{ ...sample[0], favorite: true }, { ...sample[1], favorite: true }]
    const r = analyzeLog([e('2026-10-20', 'a', 'パス', 10, sample[0].id)], fav, 30, '2026-10-25')
    expect(r.staleFavorites.map((x) => x.menu.id)).toEqual([sample[1].id])
  })
})

describe('選手の記録', () => {
  it('同じ人・項目・日の記録は1件にまとめる', () => {
    const r = normalizeRecords([
      { playerId: 'p', testId: 't', date: '2026-10-01', value: 5 },
      { playerId: 'p', testId: 't', date: '2026-10-01', value: 7 },
      { playerId: 'p', testId: 't', date: 'bad', value: 1 },
    ])
    expect(r).toEqual([{ id: 'p:t:2026-10-01', playerId: 'p', testId: 't', date: '2026-10-01', value: 7 }])
  })

  it('ベストは「良い向き」で決める', () => {
    expect(bestOf([30, 28, 31], 'lower')).toBe(28)
    expect(bestOf([3, 7, 5], 'higher')).toBe(7)
    expect(bestOf([], 'higher')).toBeNull()
  })
})

describe('バックアップ', () => {
  const file = (extra: object) => JSON.stringify({ app: 'basketball-menu-warehouse', menus: [custom], ...extra })

  it('動画・実施記録・選手の記録をそのまま戻せる', () => {
    const data = parseBackup(
      file({
        practiceLog: [{ date: '2026-10-01', itemId: 'a', menuId: 'custom-1', title: 't', category: 'パス', duration: 10 }],
        playersData: { players: [{ id: 'p', name: '山田', number: '4', grade: '2年' }], tests: [{ id: 't', name: 'FT', unit: '本', better: 'higher' }], records: [{ playerId: 'p', testId: 't', date: '2026-10-01', value: 7 }] },
      }),
    )
    expect(data?.menus[0].videos).toEqual(custom.videos)
    expect(data?.practiceLog).toHaveLength(1)
    expect(data?.playersData?.players[0]).toMatchObject({ name: '山田', active: true })
    expect(data?.playersData?.records).toHaveLength(1)
  })

  it('古い形式のファイルでは、実施記録・選手の記録は null（今のデータを消さない）', () => {
    const data = parseBackup(file({}))
    expect(data?.practiceLog).toBeNull()
    expect(data?.playersData).toBeNull()
  })

  it('メニュー倉庫のファイルでないものは読み込まない', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'other', menus: [] }))).toBeNull()
  })
})
