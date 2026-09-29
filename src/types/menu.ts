export type PracticeMenu = {
  id: string
  title: string
  category: string
  difficulty: string
  targetLevel: string
  players: string
  duration: number
  equipment: string[]
  purpose: string
  setup: string
  instructions: string
  coachingPoints: string[]
  commonMistakes: string[]
  progression: string
  regression: string
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  // 出典・参考情報（任意）。既存のメニューにはないので、ない場合は表示しない
  sourceType?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceNote?: string
  // 🎬 動きの解説アニメーション（任意）。出典とは別の情報
  animation?: MenuAnimation
}

// ---- 動きの解説アニメーション（ハーフコート） ----
// 座標は画面サイズに依存しない 0〜100。x：左→右、y：上（エンドライン・ゴール側）→下（ハーフライン）
export type AnimPoint = { x: number; y: number }

export type AnimPlayer = {
  id: string
  label: string
  team: 'offense' | 'defense' | 'neutral'
  start: AnimPoint
}

// 1つのステップの中の動き（同じステップ内の動きは同時に起きる）
export type AnimAction =
  | { type: 'move' | 'cut' | 'dribble' | 'screen'; player: string; to: AnimPoint }
  | { type: 'pass'; from: string; to: string }
  | { type: 'shoot' | 'rebound'; player: string }
  | { type: 'wait' }

// text は「この瞬間に何が起きているか」の短い説明
export type AnimStep = { text: string; actions: AnimAction[] }

export type MenuAnimation = {
  court: 'half'
  players: AnimPlayer[]
  // 最初にボールを持っている選手の id
  ball?: string
  steps: AnimStep[]
}

// 練習計画の1項目。時間は計画内だけの値で、元メニューのdurationは変えない
export type PracticePlanItem = {
  id: string
  menuId: string
  duration: number
  note?: string
  // 次回の練習に向けた改善メモ（note とは別）
  nextNote?: string
}

// 練習計画全体（タイトル・日付などの情報と、並べたメニュー）
export type PracticePlan = {
  title: string
  date: string
  target: string
  players: number
  plannedDuration: number
  reflection?: string
  items: PracticePlanItem[]
}

// 保存済み計画の項目。保存時点のメニュー名・カテゴリ・タグも残す（倉庫から消えても検索・表示できる）
export type SavedPlanItem = PracticePlanItem & {
  title?: string
  category?: string
  tags?: string[]
}

// 保存済み練習計画（保存した時点のスナップショット）
export type SavedPlan = Omit<PracticePlan, 'items'> & {
  id: string
  savedAt: string
  favorite: boolean
  items: SavedPlanItem[]
}

export type MenuInput = Omit<PracticeMenu, 'id' | 'favorite' | 'createdAt' | 'updatedAt'>

// AIに練習計画の作成を依頼するときの条件（Phase 7-2 でそのまま AI に渡す）
export type AIPlanConditions = {
  targetLevel: string
  players: number
  plannedDuration: number
  theme: string
  focus: string
  equipment: string[]
  difficulty: string
  request: string
}

// AIの提案（検証済み）。menuId は必ずメニュー倉庫に存在するものだけ
export type AIPlanProposal = {
  summary: string
  items: { menuId: string; duration: number; reason: string }[]
}
