import { BUILTIN_ANIMATIONS } from '../data/menuAnimations'
import type { AnimAction, AnimPlayer, AnimPoint, AnimStep, MenuAnimation, PracticeMenu } from '../types/menu'

// ゴール（リング）の位置（座標は 0〜100。x：左→右、y：上のエンドライン→下のハーフライン）
export const RIM: AnimPoint = { x: 50, y: 11.25 }

const TEAMS = ['offense', 'defense', 'neutral'] as const
const MOVE_TYPES = ['move', 'cut', 'dribble', 'screen'] as const
export const ANIM_LIMITS = { players: 12, steps: 20, actions: 10 }
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const asObj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const show = (v: unknown) => (typeof v === 'string' ? `「${v}」` : JSON.stringify(v) ?? String(v))

// 外から来たデータ（Claudeの回答・バックアップ）を厳しく確認する。
// 1つでも問題があれば animation は null とし、問題点をすべて日本語で返す（勝手に直したり捨てたりしない）
export function validateAnimation(v: unknown): { animation: MenuAnimation | null; errors: string[] } {
  const errors: string[] = []
  const o = asObj(v)
  if (!o) return { animation: null, errors: ['動きのデータ（オブジェクト）がありません。'] }
  if (o.court !== undefined && o.court !== 'half') errors.push(`court は "half" だけが使えます（${show(o.court)} になっています）。`)

  const point = (p: unknown, where: string): AnimPoint | null => {
    const q = asObj(p)
    if (!q || !isNum(q.x) || !isNum(q.y)) {
      errors.push(`${where}：座標が {"x": 数値, "y": 数値} の形になっていません。`)
      return null
    }
    if (q.x < 0 || q.x > 100 || q.y < 0 || q.y > 100) {
      errors.push(`${where}：座標 (${q.x}, ${q.y}) がコートの外です（x・y とも 0〜100）。`)
      return null
    }
    return { x: q.x, y: q.y }
  }

  const players: AnimPlayer[] = []
  if (!Array.isArray(o.players) || o.players.length === 0) errors.push('players（選手）が1人もいません。')
  else if (o.players.length > ANIM_LIMITS.players) errors.push(`選手が多すぎます（${o.players.length}人。${ANIM_LIMITS.players}人まで）。`)
  else
    o.players.forEach((p, i) => {
      const where = `選手${i + 1}人目`
      const q = asObj(p)
      if (!q) return errors.push(`${where}：形が正しくありません。`)
      if (!isStr(q.id)) return errors.push(`${where}：id がありません。`)
      if (players.some((x) => x.id === q.id)) return errors.push(`${where}：id「${q.id}」が重複しています。`)
      const team = TEAMS.find((t) => t === q.team)
      if (!team) errors.push(`選手「${q.id}」：team は offense / defense / neutral のどれかにしてください（${show(q.team)} になっています）。`)
      if (q.label !== undefined && typeof q.label !== 'string') errors.push(`選手「${q.id}」：label は文字にしてください。`)
      const start = point(q.start, `選手「${q.id}」の start`)
      if (team && start) players.push({ id: q.id, label: isStr(q.label) ? q.label.trim() : q.id, team, start })
    })
  // 形に問題がある選手も「いる」ことにして、後の STEP で同じ問題を重ねて報告しないようにする
  const ids = new Set(Array.isArray(o.players) ? o.players.map((p) => asObj(p)?.id).filter(isStr) : [])
  const known = (id: unknown, where: string, role: string) => {
    if (typeof id === 'string' && ids.has(id)) return true
    errors.push(`${where}：${role ? `${role} ` : ''}${show(id)} は players にいない選手です。`)
    return false
  }

  let ball: string | undefined
  if (o.ball !== undefined && o.ball !== null && o.ball !== '') {
    if (known(o.ball, 'ball（最初にボールを持つ選手）', '')) ball = o.ball as string
  }

  const steps: AnimStep[] = []
  // ボールの動きを追って、パスがボールを持っている選手から出ているか確かめる（buildFrames と同じ順：先に移動、次にパスなど）
  let holder: string | null = ball ?? null
  const checkHolder = ball !== undefined || o.ball === undefined || o.ball === null || o.ball === ''
  if (!Array.isArray(o.steps) || o.steps.length === 0) errors.push('steps（動きの手順）が1つもありません。')
  else if (o.steps.length > ANIM_LIMITS.steps) errors.push(`STEP が多すぎます（${o.steps.length}個。${ANIM_LIMITS.steps}個まで）。`)
  else
    o.steps.forEach((s, i) => {
      const where = `STEP ${i + 1}`
      const q = asObj(s)
      if (!q) return errors.push(`${where}：形が正しくありません。`)
      if (!isStr(q.text)) errors.push(`${where}：説明文（text）がありません。`)
      if (!Array.isArray(q.actions) || q.actions.length === 0) return errors.push(`${where}：actions（動き）がありません。動きがない場合は {"type": "wait"} を入れてください。`)
      if (q.actions.length > ANIM_LIMITS.actions) return errors.push(`${where}：動きが多すぎます（${ANIM_LIMITS.actions}個まで）。`)
      const actions: AnimAction[] = []
      const indexes: number[] = []
      const add = (j: number, a: AnimAction) => {
        actions.push(a)
        indexes.push(j)
      }
      q.actions.forEach((a, j) => {
        const at = `${where} の動き${j + 1}`
        const x = asObj(a)
        const type = x?.type
        if (!x) return errors.push(`${at}：形が正しくありません。`)
        if (MOVE_TYPES.some((t) => t === type)) {
          const ok = known(x.player, at, 'player')
          const to = point(x.to, `${at}（${type}）の to`)
          if (ok && to) add(j, { type: type as (typeof MOVE_TYPES)[number], player: x.player as string, to })
        } else if (type === 'pass') {
          const ok = known(x.from, at, 'from') && known(x.to, at, 'to')
          if (ok && x.from === x.to) errors.push(`${at}：自分自身へのパスになっています。`)
          else if (ok) add(j, { type: 'pass', from: x.from as string, to: x.to as string })
        } else if (type === 'shoot' || type === 'rebound') {
          if (known(x.player, at, 'player')) add(j, { type, player: x.player as string })
        } else if (type === 'wait') add(j, { type: 'wait' })
        else errors.push(`${at}：type ${show(type)} は使えません（move / cut / dribble / screen / pass / shoot / rebound / wait のどれか）。`)
      })
      if (checkHolder) {
        for (const a of actions) if (a.type === 'dribble') holder = a.player
        actions.forEach((a, k) => {
          if (a.type === 'pass') {
            if (a.from !== holder) errors.push(`${where} の動き${indexes[k] + 1}：パスを出す「${a.from}」はボールを持っていません（この時点でボールを持っているのは${holder ? `「${holder}」` : '誰もいません'}）。`)
            holder = a.to
          } else if (a.type === 'shoot') holder = null
          else if (a.type === 'rebound') holder = a.player
        })
      }
      if (isStr(q.text)) steps.push({ text: q.text.trim(), actions })
    })

  if (errors.length > 0) return { animation: null, errors }
  return { animation: { court: 'half', players, ...(ball && { ball }), steps }, errors }
}

// 使えるデータならそのまま返し、問題があれば null（バックアップの読み込みなどで使う）
export function normalizeAnimation(v: unknown): MenuAnimation | null {
  return validateAnimation(v).animation
}

// メニュー自身のアニメーションがあればそれを、なければアプリに用意した代表メニューのものを使う
export function getMenuAnimation(menu: PracticeMenu): MenuAnimation | null {
  return (menu.animation && normalizeAnimation(menu.animation)) || BUILTIN_ANIMATIONS[menu.id] || null
}

// 画面で「🎬 動きを見る」が出るメニューか（メニュー自身の動き・アプリ内蔵の動きのどちらか）
export const hasAnimation = (menu: PracticeMenu) => getMenuAnimation(menu) !== null

// 動きのデータを持っているが、チェックに通らず表示できない（一括作成では上書きしない）
export const hasBrokenAnimation = (menu: PracticeMenu) => menu.animation !== undefined && normalizeAnimation(menu.animation) === null

// 各ステップ終了時点の状態（選手の位置とボールの場所）。frames[0] がはじめの配置、frames[k] が STEP k の後
export type Frame = { pos: Record<string, AnimPoint>; holder: string | null; ballAt: AnimPoint }

export function buildFrames(anim: MenuAnimation): Frame[] {
  const pos: Record<string, AnimPoint> = Object.fromEntries(anim.players.map((p) => [p.id, p.start]))
  let holder: string | null = anim.ball ?? null
  let ballAt = RIM
  const frames: Frame[] = [{ pos: { ...pos }, holder, ballAt }]
  for (const step of anim.steps) {
    // 先に選手の移動、その後でボールの受け渡し（パスは受け手の移動先に届く）
    for (const a of step.actions) {
      if (a.type === 'move' || a.type === 'cut' || a.type === 'screen' || a.type === 'dribble') pos[a.player] = a.to
      if (a.type === 'dribble') holder = a.player
    }
    for (const a of step.actions) {
      if (a.type === 'pass') holder = a.to
      if (a.type === 'shoot') {
        holder = null
        ballAt = RIM
      }
      if (a.type === 'rebound') holder = a.player
    }
    frames.push({ pos: { ...pos }, holder, ballAt })
  }
  return frames
}
