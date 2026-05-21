# 11. 通信層（Adapter + Socket.io + カスタムサーバー）

> 対応フェーズ: フェーズ3 ｜ 関連要件: REQUIREMENTS.md §5.2, §6.1, §6.3, §4
> 依存: #08

## 目的
同一LANでの4端末対戦を実現する。**差し替え可能な通信層**としてゲームロジックから分離する（§6.1）。

## 対象ファイル
- `src/lib/adapter/types.ts`（共通インターフェース）
- `src/lib/adapter/local.ts`（Socket.io ローカル）
- `src/lib/adapter/remote.ts`（将来用のスタブ）
- `server.ts`（Next.js + Socket.io のカスタムサーバー）

## スコープ / 仕様
- **共通インターフェース**を先に設計し、`LocalAdapter`（今回）と将来の `RemoteAdapter` が同じ型を実装する。
- カスタムサーバー `server.ts` で Next.js と Socket.io を同居。導入時に `package.json` の `dev`/`start` をカスタムサーバー起動へ変更（CLAUDE.md 参照。`tsx`/`ts-node` 等が必要）。
- 状態は**サーバーのメモリ上のみ**（DB不要・記録なし / §4.3）。ホストPC1台で完結。
- ホスト画面のURLは `http://192.168.x.x:3000` 形式（LAN IP / §2.2）。
- Socket.io イベント（§6.3）: `room:create`/`room:created`, `room:join`/`room:joined`, `room:players`, `game:start`, `game:state`, `player:draw`/`player:discard`, `player:pon`/`player:chi`/`player:kan`, `player:riichi`, `player:tsumo`/`player:ron`, `game:end`。
- 権威はサーバー側のステートマシン（#08）。クライアントの不正アクションは合法手でガード。
- 4桁合言葉での入室制限（§2.2, §4.4）。

## Todo
- [ ] Adapter 共通インターフェース（`types.ts`）
- [ ] `server.ts`（Next.js + Socket.io 同居）
- [ ] `dev`/`start` スクリプトをカスタムサーバー対応に変更
- [ ] §6.3 の各イベントのハンドラ実装
- [ ] サーバー権威で #08 のステートマシンを駆動し `game:state` を配信
- [ ] 4桁合言葉の入室制限
- [ ] `RemoteAdapter` スタブ（将来用）
- [ ] LAN内の実機（複数端末）で疎通確認

## 完了条件
- 同一LANの複数端末が合言葉で同じ部屋に入り、サーバー権威で状態同期しながら1局打てる。
