# 12. Zustand 状態管理ストア

> 対応フェーズ: フェーズ3 ｜ 関連要件: REQUIREMENTS.md §5.1, §6.1
> 依存: #08, #11

## 目的
クライアント側のUI状態とサーバー同期状態を Zustand で一元管理する。

## 対象ファイル
- `src/lib/store/`（Zustand ストア）

## スコープ / 仕様
- 保持する状態: 自席・部屋情報・参加者一覧・ゲーム状態（`game:state` 受信分）・自分の合法手・接続状態。
- UI設定（クライアント個別）: お助けモードON/OFF（デフォルトON §3.3）、音量（デフォルト中 §3.5）、打牌確認ダイアログON/OFF（デフォルトON §3.7）。
- Adapter（#11）からのイベントでストアを更新し、UIはストアを購読する（通信の詳細をUIから隠す）。
- 永続化は基本なし（§4.3）。ただし音量・お助け等の**端末ローカル設定**のみ localStorage 永続化を検討可。
- セレクタを用意し再描画を最小化（パフォーマンス）。

## Todo
- [x] 部屋/参加者/ゲーム状態/合法手/接続状態のストア
- [x] UI設定ストア（お助け・音量・確認ダイアログ）
- [x] Adapter イベント → ストア更新の接続
- [x] 主要セレクタ（手牌・河・手番・他家情報）
- [x] 端末ローカル設定の永続化（必要なら）

## 実装メモ
- `src/lib/store/`。`gameStore.ts`（同期状態）/ `settingsStore.ts`（端末設定・persist）/ `selectors.ts`。
- **gameStore**: `connection/roomId/passcode/mySeat/myToken/players/gameState/myLegalActions/lastError` ＋ actions `connect/createRoom/joinRoom/start/send/disconnect/clearError`。**adapter は注入**（`connect(adapter)` で `MahjongAdapter` を受け、`onConnectionChange/onPlayers/onState/onEnd/onError` を購読配線）＝具体 LocalAdapter を import せず socket 無しでテスト可能。adapter 参照と購読解除関数はモジュールクロージャに保持（再描画を誘発しない）。`onState/onEnd` 受信で `myLegalActions = legalActions(gameState, mySeat)` を導出（サーバー権威・楽観適用なし）。失敗は `lastError`。
- **settingsStore**: `helpMode`(既定ON)/`volume`(0..1,既定0.5,クランプ)/`muted`/`discardConfirm`(既定ON)。`persist`（name `mj-settings`・`partialize` で設定値のみ）。**SSR/Node 安全**: `window` 無し時はメモリ実装の `StateStorage` にフォールバック（undefined を返すと setItem でクラッシュするため）。
- **selectors**: `selectMyHand/selectDiscards/selectCurrentSeat/selectIsMyTurn/selectDora/selectScores` ＋ `opponentSeats(mySeat)`（下家+1・対面+2・上家+3）。盤面導出は `state.ts`（`currentSeat/doraTiles`）に委譲。
- 小改修: `local.ts` の reject を AdapterError オブジェクトに（code 保持・ストア catch で扱える）。
- テスト: `gameStore.test.ts`（FakeAdapter で connect/部屋/イベント購読/myLegalActions導出/send委譲/selectors）・`settingsStore.test.ts`（既定値・操作・クランプ）。計13件。

## 完了条件
- 対局画面が全てストア購読で描画され、サーバー更新が即UIへ反映される。
