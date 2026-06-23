---
paths:
  - "src/lib/adapter/**/*.ts"
  - "src/lib/store/**/*.ts"
  - "server.ts"
---

# 通信層・状態管理のルール（adapter / store / server.ts）

3層構成の通信層。ゲームロジック（`src/lib/mahjong`）から分離し、**差し替え可能なインターフェース**にする（REQUIREMENTS.md §6.1）。該当チケット: `docs/11`（通信）・`docs/12`（ストア）・`docs/16`（信頼性）・`docs/19`（もう一局/解散）。

## 通信層（src/lib/adapter）
- 共通インターフェース `types.ts`（`MahjongAdapter`）を `LocalAdapter`（Socket.io 同一LAN・実装済）と将来の `RemoteAdapter`（スタブ）が実装する。`@/lib/adapter/connect.ts` の `ensureConnected()`（未接続なら接続）を practice/host/join 各導線で共用。
- **権威はサーバー側のステートマシン**（`src/lib/mahjong/state.ts`）。クライアントの不正アクションは合法手でガード。席は **socket 束縛**（自己申告 seat は上書き）。
- 状態は**サーバーのメモリ上のみ**（DB不要・記録なし）。ホストPC1台で完結。個人情報は名前のみ・永続化なし（§4.3）。
- 入室制限は4桁合言葉のみ（LANクローズド前提・認証なし §4.4）。
- **実装済み Socket.io イベント**（ack方式・`room:created`等の旧命名は無い）:
  - クライアント→サーバー（ackで結果）: `room:create`{name}/`room:join`{passcode,name}/`room:reconnect`{roomId,seat,token}/`game:start`{opts}/**`game:rematch`{opts}**（host のみ・#19）/**`room:dissolve`**{}（host のみ・#19） → ack は `SeatAssignment` か `{ok:true}` か `AdapterError`。プレイヤー手番: `player:discard`/`player:riichi`/`player:pon`/`player:chi`/`player:kan`/`player:tsumo`/`player:ron`/`player:pass`（`{action}`）。`player:draw` はサーバー自動ツモのため無視。
  - サーバー→クライアント（broadcast）: `room:players`(PlayerInfo[])/`game:state`(GameState)/`game:end`/`app:error`(AdapterError)/**`room:dissolved`**（payload 無し・#19）。
- アダプタ実装メソッド: `connect/disconnect/createRoom/joinRoom/reconnect/start/send/`**`rematch`(#19)/`dissolve`(#19)** ＋ `onPlayers/onState/onEnd/onError/onConnectionChange/`**`onDissolved`**(#19)。
- **アダプタ契約の要注意点**: `on*` 購読は `connect()` **前**に登録できること（store はそうする）。`LocalAdapter` はコンストラクタで `io(url,{autoConnect:false})` し、`connect()` で `socket.connect()`（#15 で修正したバグ＝socket 後生成だと on* が throw した）。

## カスタムサーバー（server.ts）
- Next.js と Socket.io を同居させるカスタムサーバー。導入時に `package.json` の `dev`/`start` を素の `next` からカスタムサーバー起動へ変更する（`tsx` 等が必要）。現状の `next dev --turbopack` ではカスタムサーバーは動かない。

## 状態管理（src/lib/store・Zustand）
- 保持: 部屋情報・参加者一覧・ゲーム状態（`game:state` 受信分）・自分の合法手・接続状態・`mySeat`/`myToken`・`dissolved`（#19 onDissolved で true）。
- UI設定（端末個別 `settingsStore`・localStorage 永続）: お助けモード(ON)・音量(中)・ミュート・打牌確認(ON)・**BGM(ON・#17)**。`gameStore` は永続化しない（通信断でもタブが生きていれば保持）。
- Adapter のイベントでストア更新→UI はストア購読（通信詳細を隠す）。`store`/`adapterRef` は**モジュール singleton**でクライアント遷移をまたいで保持。
- **Zustand セレクタの落とし穴（重要）**: `useGameStore(sel)` は useSyncExternalStore。**毎回新しい配列/オブジェクトを返すセレクタを直接渡すと無限再描画**（snapshot 不一致）。primitive か安定参照を返すものだけ直接渡す（`selectMyHand` は `gameState.players[seat].hand` の安定参照でOK）。`selectDora`/`selectScores` 等の新配列系は親で `gameState` を購読し `useMemo` で導出する。お助け計算（`tenpaiKeepDiscards`/`waitsAfterDiscard`/`selectMyWaits`）は selectors の**純ヘルパ**で、コンポーネントが `useMemo(()=>fn(hand),[hand])` で使う（store セレクタにしない）。
- **お助け純ヘルパの形ベースガード（要注意）**: `handWaits`/`assertDrawForm` は `concealed+drawn` が `3n+1` 形でないと throw する。selectors は `drawn` フラグでなく **`concealedWithDrawn(hand).length % 3`** で分岐する: `selectMyWaits` は `% 3 === 1`（次のツモ待ち）でのみ計算、`tenpaiKeepDiscards`/`waitsAfterDiscard` は `% 3 === 2`（打牌が必要）でのみ計算。**ポン/チー直後は `drawn===null` でも `concealed=11`(=3n+2)** の打牌待ち状態になる落とし穴があり、`drawn` フラグだけでガードすると `selectMyWaits` が throw する（過去バグ）。明槓/暗槓/加槓直後（嶺上待ち）は `3n+1` 形なので `selectMyWaits` 側で扱う。

## 切断/再接続・CPU代行（#16）
- 席束縛: create/join/reconnect で `store.bindSocket(roomId,seat,socketId)`。切断は `store.markDisconnected(socketId)`（**socketId 一致時のみ** connected=false＝再接続の競合回避）→`room:players` 再配信。
- 再接続（通信断のみ）: socket.io 自動再接続で `connected` 再発火 → `gameStore` が `roomId/mySeat/myToken` 揃えば `adapter.reconnect()` を自動発火（初回接続は roomId=null で発火しない）。サーバー `room:reconnect` は **token 検証**して席を再束縛し `game:state`/`room:players` を再送（状態復元）。誤トークンは安全側で `ROOM_NOT_FOUND`。
- 進行を止めない: `session.stepAuto`（自動席＝`isCpu || !connected`＝**切断中の人間はCPU代行**）の一手だけを、`server.ts` の `driveAutoTimed`（1room1チェイン・`setTimeout(cpuDelay)`）で**一手ずつ遅延配信**（CPU思考演出）。`advanceAuto` は `stepAuto` のループ（テスト/即時用）。`CPU_DELAY_MS` env で間隔調整（`0`=即時）。
- ページ再読み込み復帰や server 側 pause/resume は未実装（「待って」は局所）。ホストPC断は対局終了でよい（§4.2）。

## もう一局・部屋を解散（#19）
- `RoomStore.rematch(roomId, opts?)`: **終局後にだけ許可**（未開始/進行中は ILLEGAL_ACTION）。`started`/`state`/`seed` をリセットして既存 `startGame` を再呼び。**席・名前・isCpu・token・socketId・passcode は維持**（同じ部屋で続行）。
- `server.ts` の `game:rematch` ハンドラ: host=seat0 チェック → 既存 `driveTimers` を clearTimeout＋delete → `store.rematch` → `room:players` 再配信＋`broadcast`＋`driveAutoTimed`。
- `server.ts` の `room:dissolve` ハンドラ: host チェック → `driveTimers` clear → `io.to(roomId).emit("room:dissolved")` で全員に通知 → `store.removeRoom`。
- クライアント側: `adapter.onDissolved` を `gameStore.connect` で購読し、発火で `dissolved=true` をセット。UI（GameBoard）が `useEffect([dissolved])` で `disconnect()`＋タイトルへ遷移。
- 練習導線（PracticeStartButton）は `createRoom`→`start` のフレッシュな部屋作成パスで、rematch とは別物。再戦は `/room/[id]` を維持したまま行われる。
