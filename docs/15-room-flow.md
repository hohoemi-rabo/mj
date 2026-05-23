# 15. 部屋作成・入室フロー

> 対応フェーズ: フェーズ3 ｜ 関連要件: REQUIREMENTS.md §3.1, §3.6, §7.1, §2.2
> 依存: #11, #12, #13

## 目的
トップ・ホスト・入室の各画面と、部屋作成〜席割り〜対局開始までの導線を実装する。

## 対象ファイル
- `src/app/page.tsx`（トップ）
- `src/app/host/page.tsx`（ホスト）
- `src/app/join/page.tsx`（入室）

## スコープ / 仕様（§7.1, §3.6）
- **トップ画面**: 「部屋を作る」「部屋に入る」の2択。
- **ホスト画面**: 4桁合言葉＋**QRコード**表示（`qrcode`）、LAN URL（`http://192.168.x.x:3000`）、参加者一覧、CPU強さ設定（弱/中/強 §3.4）、「CPUで埋める」、「対局開始」。先生はプレイヤーとしても参加（§2.1）。
- **入室画面**: 合言葉入力 → 名前入力 → 席選択（東南西北 / 自動 or 手動 §3.1）。
- 対局フロー（§3.6）通りに遷移し、開始で #14 の対局画面へ。
- 入室制限は4桁合言葉（§4.4）。個人情報は名前のみ・永続化なし（§4.3）。

## Todo
- [x] トップ画面（部屋を作る／部屋に入る／ひとりで練習 の導線）
- [x] ホスト画面（合言葉・QR・LAN URL表示）
- [x] 参加者一覧のリアルタイム更新（`room:players` / `PlayerList`）
- [x] CPU強さ設定（弱/中/強・既定medium）・「CPUで埋める」（開始時に空席自動補完）
- [x] 入室画面（合言葉→名前→入室。`?code=` プリフィル対応）
- [x] 席割り（自動。手動選択は今回スコープ外）
- [x] 「対局開始」で対局画面へ遷移（`useGotoRoomOnStart`）

## 完了条件
- ホストが部屋を作り、別端末がQR/合言葉で入室・席選択し、対局開始まで進める。

## 実装メモ
- 画面: `src/app/host/page.tsx`(→`HostScreen`/`HostLobby`)・`src/app/join/page.tsx`(→`JoinScreen`、`await searchParams` で `?code=`)・`src/app/page.tsx`(3導線)。共有 `src/components/room/`（`PlayerList`/`useServerInfo`/`useGotoRoomOnStart`）。
- LAN疎通: `server.ts` を `0.0.0.0` bind（`HOST` env 可）＋起動ログにLAN URL。`src/app/api/server-info/route.ts`（`os.networkInterfaces` でLAN IPv4）。`next.config.ts` の `allowedDevOrigins` に起動時LAN IP（dev のcross-origin制限回避）。
- QR: `src/components/game/QrCode.tsx`（`qrcode.toDataURL`）。値は `http://<lan-ip>:<port>/join?code=<合言葉>`（端末はホスト由来オリジンで開く→same-origin で接続）。
- 部品追加: `src/components/ui/Input.tsx`（シニア向け入力）。`src/lib/adapter/connect.ts`（`ensureConnected` 冪等接続・practice導線も共用）。
- 席は自動（入室順 ホスト=0→1→2→3）。風（東南西北）は親確定が開始時のためロビーでは出さない。
- 繰延: 手動席選択・「もう一局/部屋を解散」(§3.6 step8→#19)・再接続/切断復帰・CPU思考遅延→#16・配牌アニメ/音→#17。
