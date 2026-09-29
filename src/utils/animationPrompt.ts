import type { MenuAnimation, PracticeMenu } from '../types/menu'
import { extractJSON } from './aiPlan'
import { validateAnimation } from './animation'

const orNone = (v: string | undefined) => v?.trim() || '（記載なし）'

// ---- 新規作成・修正で共通の部品 ----

const INTRO = 'あなたは日本の中学校バスケットボール部の指導を手伝うコーチです。'

function menuSection(menu: PracticeMenu) {
  const source = [menu.sourceTitle, menu.sourceUrl].filter((v) => v?.trim()).join(' ')
  return `## 練習メニュー
- メニュー名：${menu.title}
- カテゴリ：${menu.category}
- 難易度：${menu.difficulty}
- 対象：${menu.targetLevel}
- 人数：${orNone(menu.players)}
- 所要時間：${menu.duration}分
- 目的：${orNone(menu.purpose)}
- 準備・配置：${orNone(menu.setup)}
- 手順：${orNone(menu.instructions)}
- 指導ポイント：${menu.coachingPoints.join('／') || '（記載なし）'}
${source ? `- 参考（文字情報のみ。アクセスは不要です）：${source}\n` : ''}`
}

// 動きの質についての約束（新規作成・修正の両方）
const QUALITY_RULES = `- 上の練習メニューに書かれている内容だけを表してください。新しい練習内容や、書かれていない動きを付け足さないでください。
- 人数を変えないでください（例：2on2 を 3on3 にしない）。大人数の練習は、代表的な1組だけを表してください。
- 複雑にせず、練習の要点が分かるシンプルな動きにしてください。STEP はできるだけ少なく、3〜6 個が目安です（最大 20 個）。
- 1つの STEP には、同時に起こる動きだけを入れてください。
- 選手は重ならないように、少なくとも 6 程度離して配置してください。コートの外（0〜100 の外）には置かないでください。
- パスは、その時点でボールを持っている選手からだけ出してください。自分自身へのパスは作らないでください。
- 各 STEP の text は、中学生に分かる短い日本語で書いてください。中学校の部活動で実際に使うことを想定してください。`

const COURT_AND_TYPES = `## コートと座標
- ハーフコートを上から見た図です。x は左→右、y は上（ゴール側のエンドライン）→下（センターライン）で、どちらも 0〜100 の数値です。
- ゴールは (50, 11)。目安：トップ (50, 64)、右ウイング (82, 45)、左ウイング (18, 45)、右コーナー (94, 12)、左コーナー (6, 12)、右エルボー (66, 41)、左エルボー (34, 41)、ゴール下 (50, 20)。

## 使えるもの（これ以外の項目・type は使えません）
- players：id（英数字、重複しない）、label（丸の中に表示する短い文字。例 "1"、"C"）、team（"offense"＝攻撃、"defense"＝守備、"neutral"＝コーチやパサーなど）、start（はじめの位置）
- ball：最初にボールを持っている選手の id（いなければ省略）
- actions の type：
  - "move"（移動）・"cut"（カット）・"dribble"（ドリブル）・"screen"（スクリーン）：{"type": "...", "player": "id", "to": {"x": 数値, "y": 数値}}
  - "pass"（パス）：{"type": "pass", "from": "id", "to": "id"}
  - "shoot"（シュート）・"rebound"（リバウンド）：{"type": "...", "player": "id"}
  - "wait"（待つ・構える）：{"type": "wait"}
- player・from・to には、players にいる選手の id だけを使ってください。`

const ANSWER_FORMAT = `## 回答形式
次の形の JSON だけを返してください。Markdown のコードブロックや、前後の説明文は付けないでください。

{
  "animation": {
    "court": "half",
    "players": [
      { "id": "O1", "label": "1", "team": "offense", "start": { "x": 50, "y": 64 } },
      { "id": "O2", "label": "2", "team": "offense", "start": { "x": 82, "y": 45 } },
      { "id": "D1", "label": "1", "team": "defense", "start": { "x": 50, "y": 55 } }
    ],
    "ball": "O1",
    "steps": [
      { "text": "1番がウイングの2番へパス。", "actions": [{ "type": "pass", "from": "O1", "to": "O2" }] },
      { "text": "1番はゴールへカット。", "actions": [{ "type": "cut", "player": "O1", "to": { "x": 56, "y": 20 } }, { "type": "move", "player": "D1", "to": { "x": 52, "y": 30 } }] },
      { "text": "2番から1番へリターンパス。", "actions": [{ "type": "pass", "from": "O2", "to": "O1" }] },
      { "text": "1番がシュート。", "actions": [{ "type": "shoot", "player": "O1" }] }
    ]
  }
}`

// メニューの「動き」を作ってもらうための依頼文（Claudeに手動で貼り付ける。アプリからは通信しない）
export function buildAnimationPrompt(menu: PracticeMenu): string {
  return `${INTRO}
次の練習メニューの「動き」を、ハーフコート上の選手とボールの動きとして JSON で表してください。
部員が「どこに立って、どう動くか」をアニメーションで理解するために使います。

${menuSection(menu)}
## 守ること
${QUALITY_RULES}

${COURT_AND_TYPES}

${ANSWER_FORMAT}`
}

// 今ある「動き」を、先生の修正内容に沿って部分的に直してもらうための依頼文（これもコピー＆ペーストで使う）
export function buildAnimationRevisionPrompt(menu: PracticeMenu, current: MenuAnimation, request: string): string {
  return `${INTRO}
次の練習メニューには、ハーフコート上の選手とボールの動き（アニメーション）がすでにあります。
下の「現在のアニメーション」をベースに、「修正してほしい内容」の部分だけを直してください。

${menuSection(menu)}
## 現在のアニメーション
${JSON.stringify({ animation: current }, null, 2)}

## 修正してほしい内容
${request.trim()}

## 修正のしかた（必ず守ること）
- 現在のアニメーションをベースに修正してください。全体を作り直さないでください。
- 修正してほしい内容に関係のない部分（選手・位置・STEP・説明文）は、原則として変更しないでください。
- 修正を成り立たせるために必要な関連部分（例：パスをなくしたときのボールの持ち主）だけは、最小限の変更をしてかまいません。
- 現在のアニメーションの構造（players・ball・steps の形）を保ってください。
- メニューの内容・メニュー名・人数は変えないでください。
- 選手の id は、現在のアニメーションにある id を使ってください。id を重複させないでください。
- 修正内容があいまいで判断できない部分は、推測で大きく変えず、現在の動きのままにしてください。
${QUALITY_RULES}

${COURT_AND_TYPES}

${ANSWER_FORMAT.replace('次の形の JSON だけを返してください。', '修正後のアニメーション全体を、次の形の JSON だけで返してください（形の例です。中身は修正後の動きにしてください）。')}`
}

// 貼り付けた回答を読み取り、厳しく確認する。問題があれば一覧を返す（保存はしない）
export function parseAnimationAnswer(answer: string): { animation: MenuAnimation | null; errors: string[] } {
  let data: unknown
  try {
    data = extractJSON(answer)
  } catch {
    return { animation: null, errors: ['Claudeの回答からJSONを読み取れませんでした。JSON形式の回答（{ "animation": … }）をそのまま貼り付けてください。'] }
  }
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  if (!o || !('animation' in o)) {
    return { animation: null, errors: ['回答に "animation" が見つかりませんでした。依頼文で指定した形式（{ "animation": { ... } }）の回答を貼り付けてください。'] }
  }
  return validateAnimation(o.animation)
}
