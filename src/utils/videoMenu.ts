import { CATEGORIES, DIFFICULTIES, TARGET_LEVELS } from '../data/options'
import type { MenuInput, PracticeMenu } from '../types/menu'
import { extractJSON } from './aiPlan'
import { normalizeForSearch } from './filters'

// 動画URLから練習メニューを抽出してもらうための依頼文（Claudeに手動で貼り付ける。アプリから動画へはアクセスしない）
export function buildVideoMenuPrompt(url: string, note: string): string {
  return `あなたは日本の中学校バスケットボール部の指導を手伝うコーチです。
次の動画を確認し、動画内に登場するバスケットボールの練習メニューを抽出・整理してください。
単なる動画の要約ではなく、中学校のバスケットボール部で実際に練習メニューとして再現できる形に整理してください。

## 動画URL
${url.trim()}

## 先生からの追加指示
${note.trim() || '特になし（動画内の練習メニューを可能な範囲で抽出してください）'}

## 守ること
- 動画の内容（映像・音声）を確認できない場合は、推測でメニューを作らないでください。その場合は "items" を空の配列にして、"summary" に確認できなかった理由を書いてください。
- 動画で確認できない情報は断定しないでください。
  - 人数が分からない場合、players は "要確認" としてください。
  - 時間が分からない場合、duration は 10 とし、tags に "要確認" を加えてください。
- category は次のいずれか：${CATEGORIES.join('、')}
- difficulty は次のいずれか：${DIFFICULTIES.join('、')}
- targetLevel は次のいずれか：${TARGET_LEVELS.join('、')}
- duration は分単位の整数（5分単位）にしてください。
- equipment には実際に必要な道具だけを書いてください（例：ボール、ゴール、マーカー、コーン、ビブス）。
- coachingPoints は3〜5個、commonMistakes は中学生が起こしやすいミスを2〜3個書いてください。
- tags には練習の特徴（例：シュート、判断、半面、ゲーム形式）を書いてください。「#」は付けないでください。
- videoTitle には動画のタイトルを、実際に確認できた場合だけ書いてください。推測で作らないでください。
- すべて日本語で、先生がそのまま実施できる程度に具体的に書いてください。

## 回答形式
次の形式の JSON だけを返してください。Markdown のコードブロック（\`\`\`）や、JSON の前後の説明文は付けないでください。

{
  "summary": "動画から抽出した練習メニューの概要",
  "videoTitle": "動画のタイトル（確認できた場合のみ。分からなければ空文字）",
  "items": [
    {
      "title": "メニュー名",
      "category": "シュート",
      "difficulty": "中級",
      "targetLevel": "全員",
      "players": "6〜12人",
      "duration": 10,
      "equipment": ["ボール", "ゴール"],
      "purpose": "練習の目的",
      "setup": "コートの準備・配置",
      "instructions": "具体的な手順",
      "coachingPoints": ["ポイント1", "ポイント2", "ポイント3"],
      "commonMistakes": ["よくあるミス1", "よくあるミス2"],
      "progression": "発展方法（難しくする）",
      "regression": "簡単にする方法",
      "tags": ["シュート", "判断"]
    }
  ]
}`
}

// 画面で確認するための抽出候補。checks（要確認の項目）と similar（似た既存メニュー）は表示だけに使い、保存はしない
export type VideoMenuCandidate = { input: MenuInput; checks: string[] }

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v.map(text).filter(Boolean) : [])

// 1件分を今のメニューの形に整える。値が選択肢にない・分からないものは初期値にして「要確認」として知らせる
function toCandidate(v: unknown): VideoMenuCandidate | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const title = text(o.title)
  if (!title) return null
  const checks: string[] = []
  const pick = (value: unknown, allowed: string[], fallback: string, label: string) => {
    const s = text(value)
    if (allowed.includes(s)) return s
    checks.push(`${label}（「${fallback}」にしました）`)
    return fallback
  }
  const category = pick(o.category, CATEGORIES, 'その他', 'カテゴリ')
  const difficulty = pick(o.difficulty, DIFFICULTIES, '初級', '難易度')
  const targetLevel = pick(o.targetLevel, TARGET_LEVELS, '全員', '対象')
  let players = text(o.players)
  if (!players || players.includes('要確認')) {
    checks.push('人数')
    players = players || '要確認'
  }
  let duration = typeof o.duration === 'number' && Number.isFinite(o.duration) ? Math.min(120, Math.max(5, Math.round(o.duration / 5) * 5)) : NaN
  if (Number.isNaN(duration)) {
    checks.push('時間（10分にしました）')
    duration = 10
  } else if (duration !== o.duration) checks.push(`時間（${duration}分に調整しました）`)
  const tags = list(o.tags).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean)
  if (tags.includes('要確認') && !checks.some((c) => c.startsWith('時間'))) checks.push('時間など（「要確認」タグあり）')
  return {
    input: {
      title,
      category,
      difficulty,
      targetLevel,
      players,
      duration,
      equipment: list(o.equipment),
      purpose: text(o.purpose),
      setup: text(o.setup),
      instructions: text(o.instructions),
      coachingPoints: list(o.coachingPoints),
      commonMistakes: list(o.commonMistakes),
      progression: text(o.progression),
      regression: text(o.regression),
      tags: [...new Set(tags)],
    },
    checks,
  }
}

// 動画URLから出典の種類を決める（URLにアクセスはしない。文字列を見るだけ）
export function sourceTypeFromUrl(url: string) {
  const u = url.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube'
  if (u.includes('instagram.com')) return 'Instagram'
  return 'その他'
}

// 貼り付けた回答を読み取る（JSONの取り出しは練習計画の取り込みと同じ extractJSON を使う）。
// 元の動画URLは、抽出した各メニューの出典として引き継ぐ
export function parseVideoAnswer(answer: string, videoUrl: string) {
  const data = extractJSON(answer)
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const summary = text(o.summary)
  if (!Array.isArray(o.items)) {
    throw new Error('Claudeの回答に "items"（メニューの一覧）が見つかりませんでした。依頼文で指定した形式の回答を貼り付けてください。')
  }
  const source = { sourceType: sourceTypeFromUrl(videoUrl), sourceUrl: videoUrl.trim() || undefined, sourceTitle: text(o.videoTitle) || undefined }
  const items = (o.items as unknown[]).map(toCandidate)
  const valid = items
    .filter((c): c is VideoMenuCandidate => c !== null)
    .map((c) => ({ ...c, input: { ...c.input, ...source } }))
  if (valid.length === 0) {
    throw new Error(`練習メニューを抽出できませんでした。${summary ? `（Claudeからの説明：${summary}）` : ''}`)
  }
  return { summary, items: valid, excluded: items.length - valid.length }
}

// ---- 既存メニューとの簡易的な重複チェック（タイトルの正規化と文字の重なり） ----

// 比較用：全角半角・大文字小文字をそろえ、かっこ内の補足・記号・空白を除く
const normalizeTitle = (s: string) =>
  normalizeForSearch(s)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s・＆&/／\-－ー〜~、。！!？?「」『』]/g, '')

const bigrams = (s: string) => {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

// 2つの文字列の似ている度合い（0〜1）。2文字ずつの組の重なりで判定する
function similarity(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return 0.9
  const x = bigrams(a)
  const y = bigrams(b)
  if (x.size === 0 || y.size === 0) return 0
  let common = 0
  for (const g of x) if (y.has(g)) common++
  return (2 * common) / (x.size + y.size)
}

const SIMILAR_THRESHOLD = 0.6

// タイトルが近い既存メニュー（似ている順・最大3件）。同じカテゴリならやや近いと判断する
export function findSimilarMenus(input: MenuInput, menus: PracticeMenu[]): PracticeMenu[] {
  const t = normalizeTitle(input.title)
  return menus
    .map((m) => ({ m, s: similarity(t, normalizeTitle(m.title)) + (m.category === input.category ? 0.05 : 0) }))
    .filter(({ s }) => s >= SIMILAR_THRESHOLD)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ m }) => m)
}
