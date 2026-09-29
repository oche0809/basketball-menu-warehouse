import type { MenuAnimation } from '../types/menu'

// 動きの種類（一覧で「シュートメニューなのにシュートがない」などを人が見つけやすくするための目印。エラー判定には使わない）
export const FEATURE_LABELS = {
  pass: 'パス',
  dribble: 'ドリブル',
  shoot: 'シュート',
  cut: 'カット',
  screen: 'スクリーン',
  rebound: 'リバウンド',
  defense: 'ディフェンス',
} as const
export type Feature = keyof typeof FEATURE_LABELS

export type AnimationQuality = {
  // 'ok'＝特に目立つ点なし、'warn'＝要確認（保存はできる）。チェックに通らないもの（エラー）はここには来ない
  level: 'ok' | 'warn'
  warnings: string[]
  features: Feature[]
  counts: { players: number; steps: number; actions: number }
}

const MOVES = ['move', 'cut', 'dribble', 'screen'] as const

// カテゴリに対して、あってほしい動き（ない場合は「要確認」の目安にするだけ）
const EXPECTED: Record<string, Feature> = { シュート: 'shoot', パス: 'pass', ドリブル: 'dribble', リバウンド: 'rebound' }

// チェックに通った動きについて、分かりやすさを機械的に確かめる（シンプルな練習をエラーにはしない）
export function checkAnimationQuality(anim: MenuAnimation, category?: string): AnimationQuality {
  const actions = anim.steps.flatMap((s) => s.actions)
  const real = actions.filter((a) => a.type !== 'wait')
  const team = new Map(anim.players.map((p) => [p.id, p.team]))
  const movers = new Set(actions.flatMap((a) => (MOVES.some((t) => t === a.type) && 'player' in a ? [a.player] : [])))
  const actors = new Set(actions.flatMap((a) => (a.type === 'pass' ? [a.from] : 'player' in a ? [a.player] : [])))

  const features = new Set<Feature>()
  for (const a of actions) {
    if (a.type === 'pass' || a.type === 'dribble' || a.type === 'cut' || a.type === 'screen' || a.type === 'rebound') features.add(a.type)
    if (a.type === 'shoot') features.add('shoot')
  }
  if ([...actors].some((id) => team.get(id) === 'defense')) features.add('defense')

  const warnings: string[] = []
  if (anim.steps.length === 1) warnings.push('STEPが1つだけです。')
  if (real.length <= 1) warnings.push('動きが少ない可能性があります。')
  if (actions.length > 0 && actions.length - real.length > real.length) warnings.push('「待つ（wait）」が多すぎます。')
  if (anim.steps.some((s) => s.actions.every((a) => a.type === 'wait')) && real.length === 0) warnings.push('すべてのSTEPが「待つ」だけです。')
  if (movers.size === 0 && !features.has('pass')) warnings.push('選手がほとんど動いていません。')
  else if (anim.players.length >= 3 && movers.size === 1) warnings.push('動く選手が1人だけです。')
  if (!anim.ball && !features.has('dribble') && !features.has('rebound')) warnings.push('最初にボールを持つ選手（ball）が設定されていません。')
  const expected = category ? EXPECTED[category] : undefined
  if (expected && !features.has(expected)) warnings.push(`カテゴリ「${category}」ですが、${FEATURE_LABELS[expected]}の動きがありません。`)

  return {
    level: warnings.length ? 'warn' : 'ok',
    warnings,
    features: (Object.keys(FEATURE_LABELS) as Feature[]).filter((f) => features.has(f)),
    counts: { players: anim.players.length, steps: anim.steps.length, actions: actions.length },
  }
}
