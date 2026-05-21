---
paths:
  - "src/lib/adapter/**/*.ts"
  - "src/lib/store/**/*.ts"
  - "server.ts"
---

# 通信層・状態管理のルール（adapter / store / server.ts）

3層構成の通信層。ゲームロジック（`src/lib/mahjong`）から分離し、**差し替え可能なインターフェース**にする（REQUIREMENTS.md §6.1）。該当チケット: `docs/11`（通信）・`docs/12`（ストア）・`docs/16`（信頼性）。

## 通信層（src/lib/adapter）
- 共通インターフェース `types.ts` を先に設計し、`LocalAdapter`（Socket.io 同一LAN・今回実装）と将来の `RemoteAdapter`（クラウド）が同じ型を実装する。
- **権威はサーバー側のステートマシン**（`src/lib/mahjong/state.ts`）。クライアントの不正アクションは合法手でガードする。
- 状態は**サーバーのメモリ上のみ**（DB不要・記録なし）。ホストPC1台で完結。個人情報は名前のみ・永続化なし（§4.3）。
- 入室制限は4桁合言葉のみ（LANクローズド前提・認証なし §4.4）。
- Socket.io イベント（§6.3）: `room:create`/`room:created`, `room:join`/`room:joined`, `room:players`, `game:start`, `game:state`, `player:draw`/`player:discard`, `player:pon`/`player:chi`/`player:kan`, `player:riichi`, `player:tsumo`/`player:ron`, `game:end`。

## カスタムサーバー（server.ts）
- Next.js と Socket.io を同居させるカスタムサーバー。導入時に `package.json` の `dev`/`start` を素の `next` からカスタムサーバー起動へ変更する（`tsx` 等が必要）。現状の `next dev --turbopack` ではカスタムサーバーは動かない。

## 状態管理（src/lib/store・Zustand）
- 保持: 部屋情報・参加者一覧・ゲーム状態（`game:state` 受信分）・自分の合法手・接続状態。
- UI設定（端末個別）: お助けモード（デフォルトON）・音量（デフォルト中）・打牌確認ダイアログ（デフォルトON）。これらのみ localStorage 永続化可。
- Adapter からのイベントでストアを更新し、UI はストアを購読する（通信の詳細を UI から隠す）。セレクタで再描画を最小化。
