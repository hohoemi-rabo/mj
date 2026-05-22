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
- [x] Adapter 共通インターフェース（`types.ts`）
- [x] `server.ts`（Next.js + Socket.io 同居）
- [x] `dev`/`start` スクリプトをカスタムサーバー対応に変更
- [x] §6.3 の各イベントのハンドラ実装
- [x] サーバー権威で #08 のステートマシンを駆動し `game:state` を配信
- [x] 4桁合言葉の入室制限
- [x] `RemoteAdapter` スタブ（将来用）
- [ ] LAN内の実機（複数端末）で疎通確認（UI #14/#15 到達後に手動）

## 実装メモ
- **純粋セッションコアを分離**: `src/lib/server/session.ts` の `RoomStore`（socket/next 非依存）。部屋・席・合言葉・ゲーム進行・サーバー権威を持ち、vitest で網羅テスト（`session.test.ts` 16件）。`server.ts` はその薄いグルー。
- `RoomStore`: `createRoom`(host=席0)/`joinRoom`(席0→3・満席/誤合言葉/開始後/空名はエラー)/`fillWithCpu`(空席CPU化・冪等)/`startGame`(seed→`createInitialState`→自動ツモ整定)/`applyPlayerAction`(**`validate` で不正拒否＝サーバー権威**・席はサーバー束縛・自動ツモ整定)/`advanceAuto`(CPU席を進め人間席で停止・rng注入)/`getPlayers`/`getState`/`removeRoom`。結果は `Result<T>={ok,value}|{ok:false,error}`。
- **合言葉**: 4桁ゼロ詰め・衝突回避・`getPlayers/getState` に漏らさない（列挙防止のため未存在も WRONG_PASSCODE）。
- **自動ツモ**: `awaiting-draw` をサーバーが消化（`player:draw` は無視）。シニアは常に「打牌」だけ選ぶ。
- **クライアント Adapter**: `src/lib/adapter/types.ts`（`MahjongAdapter`＋ペイロード型）/`local.ts`（`socket.io-client` 実装）/`remote.ts`（将来クラウド用スタブ）。自分の合法手はクライアントが `legalActions(state, mySeat)` をローカル計算（payload は完全な `GameState` のみ）。エラーイベントは予約衝突回避で `app:error`。
- **カスタムサーバー** `server.ts`: `next({dev,turbopack:dev})`（**dev でも Turbopack 維持**・型は `turbopack?:boolean` を確認済み）＋`socket.io`。§6.3 イベント→`RoomStore`→`game:state`/`game:end` 配信。CPUの思考遅延(1〜3秒)・再接続は #16。
- 起動: `tsx`（devDep 追加）。`dev`=`tsx watch server.ts` / `start`=`NODE_ENV=production tsx server.ts` / `build`=`next build --turbopack`（不変）。tsx は tsconfig paths(`@/*`) を解決（確認済み）。
- 残: 実機LAN複数端末は UI（#15 入室・#14 対局）到達後に手動疎通。

## 完了条件
- 同一LANの複数端末が合言葉で同じ部屋に入り、サーバー権威で状態同期しながら1局打てる。
