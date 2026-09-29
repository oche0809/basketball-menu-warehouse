import type { MenuAnimation } from '../types/menu'

// 代表メニューの「動き」の解説データ（メニューの id ごと）。
// 座標は 0〜100（x：左→右、y：上のエンドライン→下のハーフライン）。ゴールは (50, 11)。
// 目安：トップ (50, 64)／右ウイング (82, 45)／左ウイング (18, 45)／右コーナー (94, 12)／エルボー (34 or 66, 41)
export const BUILTIN_ANIMATIONS: Record<string, MenuAnimation> = {
  // ミート＆シュート
  'sample-5': {
    court: 'half',
    players: [
      { id: 'S', label: 'S', team: 'offense', start: { x: 84, y: 32 } },
      { id: 'P', label: 'P', team: 'offense', start: { x: 50, y: 64 } },
    ],
    ball: 'P',
    steps: [
      { text: 'シューター（S）は一度ゴール方向へ動き、ディフェンスを押し込む。', actions: [{ type: 'cut', player: 'S', to: { x: 70, y: 24 } }] },
      { text: '外へ出てパスを受ける（ミート）。受ける前にひざを曲げて準備する。', actions: [{ type: 'cut', player: 'S', to: { x: 82, y: 45 } }, { type: 'pass', from: 'P', to: 'S' }] },
      { text: '受けたらすぐにシュート。', actions: [{ type: 'shoot', player: 'S' }] },
      { text: 'パサー（P）はリバウンドを取り、次のパスに備える。', actions: [{ type: 'move', player: 'P', to: { x: 56, y: 20 } }, { type: 'rebound', player: 'P' }] },
    ],
  },

  // 1on1クローズアウト
  'sample-6': {
    court: 'half',
    players: [
      { id: 'O', label: '1', team: 'offense', start: { x: 82, y: 45 } },
      { id: 'D', label: '1', team: 'defense', start: { x: 50, y: 16 } },
    ],
    ball: 'D',
    steps: [
      { text: 'ゴール下のディフェンスが、ウイングのオフェンスへパスする。', actions: [{ type: 'pass', from: 'D', to: 'O' }] },
      { text: 'ディフェンスはすぐに詰める（クローズアウト）。最後は小刻みなステップで止まり、手を上げる。', actions: [{ type: 'move', player: 'D', to: { x: 75, y: 39 } }] },
      { text: '詰めてきた勢いを見て、オフェンスはドライブでゴールへ。ディフェンスは足を動かしてついていく。', actions: [{ type: 'dribble', player: 'O', to: { x: 62, y: 22 } }, { type: 'move', player: 'D', to: { x: 64, y: 28 } }] },
      { text: 'レイアップで得点を狙う。', actions: [{ type: 'shoot', player: 'O' }] },
    ],
  },

  // 2on2パス＆カット
  'sample-8': {
    court: 'half',
    players: [
      { id: 'O1', label: '1', team: 'offense', start: { x: 50, y: 64 } },
      { id: 'O2', label: '2', team: 'offense', start: { x: 82, y: 45 } },
      { id: 'D1', label: '1', team: 'defense', start: { x: 50, y: 55 } },
      { id: 'D2', label: '2', team: 'defense', start: { x: 76, y: 39 } },
    ],
    ball: 'O1',
    steps: [
      { text: 'トップの1番がウイングの2番へパス。', actions: [{ type: 'pass', from: 'O1', to: 'O2' }] },
      { text: 'パスした瞬間に、1番はディフェンスの前を通ってゴールへカット。', actions: [{ type: 'cut', player: 'O1', to: { x: 56, y: 20 } }, { type: 'move', player: 'D1', to: { x: 52, y: 30 } }] },
      { text: '2番は、カットした1番へリターンパス。', actions: [{ type: 'pass', from: 'O2', to: 'O1' }] },
      { text: '1番がゴール下でシュート。', actions: [{ type: 'shoot', player: 'O1' }] },
    ],
  },

  // ボックスアウトドリル
  'sample-12': {
    court: 'half',
    players: [
      { id: 'C', label: 'C', team: 'neutral', start: { x: 50, y: 58 } },
      { id: 'O', label: '1', team: 'offense', start: { x: 64, y: 40 } },
      { id: 'D', label: '1', team: 'defense', start: { x: 58, y: 29 } },
    ],
    ball: 'C',
    steps: [
      { text: 'コーチ（C）がシュートを打つ。', actions: [{ type: 'shoot', player: 'C' }] },
      { text: 'ディフェンスは振り向いて相手を探し、体を当てる（ボックスアウト）。', actions: [{ type: 'move', player: 'D', to: { x: 61, y: 34 } }] },
      { text: 'オフェンスは回り込もうとする。ディフェンスは腰を落とし、足を動かして押さえ続ける。', actions: [{ type: 'move', player: 'O', to: { x: 55, y: 38 } }, { type: 'move', player: 'D', to: { x: 55, y: 31 } }] },
      { text: 'ボールが落ちてきたら、ディフェンスが高い位置で両手でリバウンド。', actions: [{ type: 'move', player: 'D', to: { x: 53, y: 22 } }, { type: 'rebound', player: 'D' }] },
    ],
  },

  // コーナーシュート（ドライブからのキック）
  'lib-034': {
    court: 'half',
    players: [
      { id: 'D', label: '1', team: 'offense', start: { x: 80, y: 47 } },
      { id: 'S', label: '2', team: 'offense', start: { x: 94, y: 12 } },
    ],
    ball: 'D',
    steps: [
      { text: 'コーナーの2番は、ひざを曲げ手を出して準備して待つ。', actions: [{ type: 'wait' }] },
      { text: 'ウイングの1番がゴールに向かってドライブ。', actions: [{ type: 'dribble', player: 'D', to: { x: 63, y: 26 } }] },
      { text: '進みながら、コーナーの2番へパス（キックアウト）。', actions: [{ type: 'pass', from: 'D', to: 'S' }] },
      { text: '2番は受けてすぐにシュート。', actions: [{ type: 'shoot', player: 'S' }] },
    ],
  },

  // ピック＆ロール 2on2（基本）
  'lib-059': {
    court: 'half',
    players: [
      { id: 'O1', label: '1', team: 'offense', start: { x: 50, y: 66 } },
      { id: 'O2', label: '2', team: 'offense', start: { x: 67, y: 42 } },
      { id: 'D1', label: '1', team: 'defense', start: { x: 50, y: 57 } },
      { id: 'D2', label: '2', team: 'defense', start: { x: 64, y: 34 } },
    ],
    ball: 'O1',
    steps: [
      { text: '2番が1番のディフェンスの横に立ち、止まってスクリーンをかける。', actions: [{ type: 'screen', player: 'O2', to: { x: 57, y: 57 } }, { type: 'move', player: 'D2', to: { x: 61, y: 49 } }] },
      { text: '1番はスクリーンに肩をこするようにドリブルで抜ける。1番のディフェンスはスクリーンに引っかかる。', actions: [{ type: 'dribble', player: 'O1', to: { x: 68, y: 43 } }, { type: 'move', player: 'D1', to: { x: 52, y: 55 } }] },
      { text: 'スクリーンをかけた2番は、ゴールへ向かう（ロール）。2番のディフェンスはボールマンに寄る。', actions: [{ type: 'cut', player: 'O2', to: { x: 55, y: 22 } }, { type: 'move', player: 'D2', to: { x: 66, y: 37 } }] },
      { text: '空いた2番へパス。', actions: [{ type: 'pass', from: 'O1', to: 'O2' }] },
      { text: '2番がゴール下でシュート。', actions: [{ type: 'shoot', player: 'O2' }] },
    ],
  },

  // スペーシング 3on3（ドライブへの合わせ）
  'lib-062': {
    court: 'half',
    players: [
      { id: 'O1', label: '1', team: 'offense', start: { x: 50, y: 64 } },
      { id: 'O2', label: '2', team: 'offense', start: { x: 82, y: 45 } },
      { id: 'O3', label: '3', team: 'offense', start: { x: 18, y: 45 } },
      { id: 'D1', label: '1', team: 'defense', start: { x: 50, y: 55 } },
      { id: 'D2', label: '2', team: 'defense', start: { x: 74, y: 40 } },
      { id: 'D3', label: '3', team: 'defense', start: { x: 28, y: 38 } },
    ],
    ball: 'O1',
    steps: [
      { text: 'トップの1番が右へドライブ。', actions: [{ type: 'dribble', player: 'O1', to: { x: 62, y: 30 } }, { type: 'move', player: 'D1', to: { x: 58, y: 36 } }] },
      { text: '同じ側の2番はコーナーへ下がる（ドリフト）。逆側の3番は高い位置へ上がる（リフト）。2番のディフェンスはヘルプに寄る。', actions: [{ type: 'move', player: 'O2', to: { x: 94, y: 12 } }, { type: 'move', player: 'O3', to: { x: 24, y: 58 } }, { type: 'move', player: 'D2', to: { x: 70, y: 25 } }, { type: 'move', player: 'D3', to: { x: 38, y: 40 } }] },
      { text: 'ヘルプが寄って空いたコーナーの2番へパス。', actions: [{ type: 'pass', from: 'O1', to: 'O2' }] },
      { text: '2番がコーナーからシュート。', actions: [{ type: 'shoot', player: 'O2' }] },
    ],
  },

  // 2on1 速攻（全面）※フロントコート側を表示
  'lib-083': {
    court: 'half',
    players: [
      { id: 'O1', label: '1', team: 'offense', start: { x: 42, y: 96 } },
      { id: 'O2', label: '2', team: 'offense', start: { x: 78, y: 96 } },
      { id: 'D', label: '1', team: 'defense', start: { x: 50, y: 30 } },
    ],
    ball: 'O1',
    steps: [
      { text: 'オフェンス2人は、間隔を広くとって攻め上がる（レーンを分ける）。', actions: [{ type: 'dribble', player: 'O1', to: { x: 44, y: 64 } }, { type: 'move', player: 'O2', to: { x: 82, y: 60 } }] },
      { text: 'ボールマンは、ディフェンスが止めに来るまでドリブルで進む。', actions: [{ type: 'dribble', player: 'O1', to: { x: 46, y: 42 } }, { type: 'move', player: 'D', to: { x: 47, y: 34 } }, { type: 'move', player: 'O2', to: { x: 78, y: 36 } }] },
      { text: 'ディフェンスを引きつけたら、走り込む2番へパス。', actions: [{ type: 'pass', from: 'O1', to: 'O2' }, { type: 'cut', player: 'O2', to: { x: 70, y: 26 } }] },
      { text: '2番はそのままゴールへ向かい、レイアップ。', actions: [{ type: 'dribble', player: 'O2', to: { x: 60, y: 15 } }, { type: 'shoot', player: 'O2' }] },
    ],
  },
}
