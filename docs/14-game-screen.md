# 14. 対局画面UI

> 対応フェーズ: フェーズ1（手牌表示・ツモ切り）・フェーズ3（4人分）｜ 関連要件: REQUIREMENTS.md §3.1, §7.2
> 依存: #10, #12, #13

## 目的
対局画面のUIを構築する。フェーズ1ではCPU1人とローカルで打てる最小版、後に4人対応。

## 対象ファイル
- `src/components/game/`（`HandTiles` / `DiscardPile` / `OpponentArea` / `ActionButtons` 等）
- `src/app/room/[id]/page.tsx`（対局画面ページ）

## スコープ / 仕様（§7.2 レイアウト）
- **自分の手牌**: 画面下部に大きく表示（SVG牌 #10）。
- **他家の手牌**: 上・左・右に裏向き表示。
- **河（捨て牌）**: 中央。
- **操作ボタン**: ツモ・打牌・ポン・チー・カン・リーチ・パス（合法手 #08 に応じて活性/非活性）。
- 配牌アニメーション（シャッフル音は #17 連携 / §3.6）。
- お助けトグル右上、音量・設定ボタン右上、「待って」ボタン左下（自ターン時のみ §3.7）。
- 状態はストア購読（#12）。静的シェルは Server Component、対話部分のみ `'use client'`（CLAUDE.md）。

## Todo
- [x] `HandTiles`（自手牌・大きく・選択/打牌）
- [x] `DiscardPile`（河）＋ `RiverGrid`（4河を方位配置）
- [x] `OpponentArea`（他家・裏向き×3方向・鳴きface-up・名前/点/手番/リーチ）
- [x] `ActionButtons`（合法手連動で活性制御。ツモ/リーチ/ポン/チー/カン/ロン/パス＋チー・カン選択ピッカー）
- [x] `room/[id]/page.tsx` のレイアウト（横画面基準・CSS Grid方位配置）
- [ ] 配牌アニメーション（→ #17/§3.6 と一緒に。今回は静的）
- [x] お助けトグル/設定/待ってボタンの配置（TopBar・SettingsModal・WaitButton）
- [x] フェーズ1: CPU3人とローカルで1局打てる最小動作（タイトルの「ひとりで練習」）

## 完了条件
- フェーズ1で手牌表示・ツモ切りができ、最終的に4人分のレイアウトで1局を操作できる。

## 実装メモ
- 起動: タイトルの **`PracticeStartButton`**（connect→createRoom→start{fillWithCpu, weak}→`/room/[id]`）。本格的な部屋作成/入室/QR/合言葉は #15。
- 配線: `src/lib/store/useGameConnection.ts`（冪等connect・遷移で切断しない singleton 前提）。
- 盤面: `src/components/game/`（`GameBoard` オーケストレータ＋`Tile`/`HandTiles`/`DiscardPile`/`RiverGrid`/`OpponentArea`/`TopBar`/`ActionButtons`/`ChiOptionPicker`/`KanTilePicker`/`SettingsModal`/`WaitButton`/`ResultModal`/`ErrorToast`）。
- サーバー権威: UIは `gameState` を触らず `store.send`→次の `game:state` を待つ。合法手は `myLegalActions` をそのまま信用。
- お助け（既定ON）: `selectors.ts` に `tenpaiKeepDiscards`/`waitsAfterDiscard`（`drawn===null` ガード内包・`handWaits` の throw 回避）を追加し、HandTilesで枠強調＋打牌確認に待ち補足。深いお助け（他家危険牌・常時役）は #18。
- 漏洩防止: 他家の `concealed` は **枚数だけ** OpponentArea に渡す（中身は描画しない）。
- 牌は素の `<img>`（静的SVG・next/image未設定）。`Tile.tsx` のみ `eslint-disable @next/next/no-img-element`。
- 「待って」は #14 ではローカル一時停止オーバーレイのみ（自手番はCPUが元々止まる）。サーバー連動pause/再接続は #16。
- 結果は最小表示（役名/翻符/点/増減 or 流局聴牌者）。演出・連荘・複数局・読み上げは #17/#19。
