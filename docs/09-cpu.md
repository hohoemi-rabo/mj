# 09. CPU思考ロジック

> 対応フェーズ: フェーズ1（弱で1人）・フェーズ3（弱中強で補完）｜ 関連要件: REQUIREMENTS.md §3.4
> 依存: #05, #08

## 目的
弱・中・強の3段階のCPUプレイヤーを実装する。シニアが楽しめる相手。

## 対象ファイル
- `src/lib/mahjong/cpu/weak.ts` / `medium.ts` / `strong.ts`
- 共通インターフェース（合法手 → 選択アクション を返す純粋関数）

## スコープ / 仕様
- 入力はゲーム状態の**公開情報＋自分の手牌**のみ（他家の手牌は見ない）。`state.ts`（#08）の合法手を使う。
- 強さ別方針（§3.4）:
  - **弱**: 半ランダム打牌。手作りの方針は薄い。生徒が勝ちやすい。
  - **中**: シャンテン数（#05）を意識した手作り。役は狙うが甘い。降り判断は弱め。
  - **強**: 効率的な手作り＋簡易的な降り判断（他家リーチ時のベタ降り程度）。中級者相当。
- 鳴き・リーチ・ツモ/ロンの判断も強さに応じて。
- 思考時間 1〜3秒は**UI側の演出**で表現（ロジックは即時に手を返す）。各CPUに名前（例: CPU東/南/西/北 §3.4）はUI/補完側（#16）で付与。

## Todo
- [x] CPU共通インターフェース定義
- [x] 弱: 半ランダム打牌＋最低限の和了判断
- [x] 中: シャンテン低下を優先する手作り
- [x] 強: 受け入れ最大化＋簡易ベタ降り
- [x] 鳴き/リーチ/和了の判断（強さ別）
- [x] 単体テスト（合法手の中から妥当な手を返すか）

## 実装メモ
- `src/lib/mahjong/cpu/{common,weak,medium,strong,index}.ts`。各CPUは `ChooseAction = (state, seat, rng) => GameAction`。**既存ロジックは無改変の追加レイヤー**（`legalActions`/`reducer` 駆動）。エントリは `index.ts` の `chooseAction(strength, state, seat, rng)`。
- 共有 `common.ts`: `chooseTerminal`（canDraw→draw / canTsumo→tsumo / canRon→ron の背骨。全レベル「勝てるなら取る」）／`efficientDiscard`（打牌後シャンテン最小→受け入れ最大→正準順）／`bestRiichiDiscard`／`riichiOpponents`／`isYakuhaiTileFor`／`safestDiscard`（ベタ降り）／`safeFallback`（想定外フェーズは pass で no-op・total）。
- **弱**: 打牌は rng で一様ランダム・リーチ/鳴きなし（生徒が勝ちやすい）。**中**: 効率打牌＋テンパイでリーチ・**役牌ポンのみ**（役を必ず確保。チー/カン/明槓はしない＝役なし開手を回避）。**強**: 中＋簡易ベタ降り（他家リーチ＆自分ノーテンで現物を打つ・降り中はリーチ/鳴きなし。自分テンパイなら押す）。
- 安全性: `handShanten/handUkeire` は必ず `discard(hand,t)` 後（drawn=null）に評価し throw を回避。返す手は常に `legalActions` 由来。`canTsumo/canRon` は #08 が役込み判定済みなので**役なし和了は構造的に発生しない**。
- CPUは公開情報＋自分の手牌のみ参照（他家 concealed を見ない）。カン（暗槓/加槓）は phase-1 では打たない。フリテン/降りのスジ・ノーチャンスは未実装（簡易）。
- `cpu/cpu.test.ts` 34件: **自己対局ハーネス**（4卓×複数seedを全CPU駆動し、各ステップで `validate`＝合法手・点数100000・牌136 を検証して終局）＋レベル別（弱のランダム性/中の効率・リーチ・役牌ポン/強のベタ降り段階・押し判断）＋`safestDiscard`/`efficientDiscard` 単体。

## 完了条件
- 各強さが合法手の範囲で破綻なく打ち切れ、強さの傾向差がテスト/簡易対局で確認できる。
