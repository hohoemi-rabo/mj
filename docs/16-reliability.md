# 16. CPU補完・切断/再接続（信頼性）

> 対応フェーズ: フェーズ3 ｜ 関連要件: REQUIREMENTS.md §3.1, §3.4, §4.2
> 依存: #09, #11, #12

## 目的
人数不足時のCPU補完と、切断時の再接続・状態復元を実装し、対局の流れを止めない。

## 対象ファイル
- `server.ts` / `src/lib/adapter/`（サーバー側ロジック中心）
- 必要に応じて `src/lib/store/`・対局UI

## スコープ / 仕様
- **CPU補完**（§3.1, §3.4）: 参加者4人未満なら自動でCPUを追加。ホストが選んだ強さ（弱/中/強）を適用。各CPUに名前（CPU東/南/西/北 等）。思考時間1〜3秒の演出（手自体は #09 が即返す）。
- **切断/再接続**（§4.2）: 参加端末が切断 → 5秒以内に再接続可能。再接続後に対局状態を復元（サーバー権威の `game:state` を再送）。
- **ホストPC断**: 対局終了でよい（1局制で影響軽微 §4.2）。
- 切断中プレイヤーの手番は進行を妨げない措置（暫定CPU代行 or 自動ツモ切り等）を検討。

## Todo
- [x] 人数不足の検出とCPU自動補完（強さ反映・命名）※ #11/#15 で実装済（本チケットは演出・代行を追加）
- [x] CPU思考の演出（一手ずつ遅延配信。既定0.8〜1.8s・`CPU_DELAY_MS` で調整可）
- [x] 切断検知 → 再接続受け入れ（socket.io 自動再接続＋トークンで席を再束縛）
- [x] 再接続時の状態復元（`room:reconnect` → `game:state`/`room:players` 再送）
- [x] 切断中の手番処理（CPU代行で進行を止めない）
- [ ] 実機で切断→再接続を検証（要ブラウザ目視。node 2クライアント結合テストは緑）

## 完了条件
- 2〜3人＋CPUで対局でき、途中で1端末が切断・再接続しても対局が継続・復元される。

## 実装メモ
- session（`src/lib/server/session.ts`）: `bindSocket`/`markDisconnected(socketId)`（一致時のみ落とす＝競合回避）/`findSeatByToken`/`reconnect(token検証)`。`stepAuto`（自動席＝`isCpu || !connected` の次の一手だけ進める＝**切断中の人間は CPU代行**）を追加し `advanceAuto` はそのループに。
- server（`server.ts`）: create/join で `bindSocket`、`room:reconnect` ハンドラ、`disconnect`→`markDisconnected`→参加者再配信＋`driveAutoTimed`。**時限ドライブ** `driveAutoTimed`（1room1チェイン・`setTimeout`・`cpuDelay()`＝`CPU_DELAY_MS` env か 800+rand(1000)）。人間の手は即時、CPUは一手ずつ遅延配信。
- adapter: `MahjongAdapter.reconnect(roomId,seat,token)`（`local` は `room:reconnect` emit、`remote` は stub）。store: `connect` の `onConnectionChange` で **`connected` 復帰時に入室済みなら `adapter.reconnect` 発火**（初回は roomId=null で発火しない）。
- UI: `GameBoard` に通信断バナー（`connection!=="connected"` で表示・再接続で消える）。
- 範囲: 通信断のみ復帰（ページ再読み込みの永続復帰は対象外）。server側 pause/resume は未配線（「待って」は局所のまま）。ホストPC断は対局終了でよい（§4.2）。
