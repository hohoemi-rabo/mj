# 08. ゲーム進行ステートマシン

> 対応フェーズ: フェーズ1〜3 ｜ 関連要件: REQUIREMENTS.md §3.1, §3.6, §5.3, §6.1
> 依存: #03, #04, #06, #07

## 目的
1局の対局進行を管理する純粋なステートマシン。通信に依存しない「ゲームの心臓部」。

## 対象ファイル
- `src/lib/mahjong/state.ts`（純粋TS）

## スコープ / 仕様
- 1ゲーム = **1局のみ**（連荘・本場なし / §3.2）。親は開始時ランダム（§3.2）。持ち点25,000スタート。
- 局面: 配牌 → 各家のツモ/打牌ループ → 鳴き割り込み（ポン/チー/カン）→ リーチ → 和了（ツモ/ロン）or 流局。
- 入力（アクション）→ 次状態を返す純粋なreducer設計。`game:state` 同期（#11）にそのまま使える形にする。
- 各局面で**合法手の列挙**（打てる牌・鳴ける/リーチできる/ツモ・ロンできるか）。お助けモード（#18）とCPU（#09）が参照。
- 流局処理（聴牌/不聴・テンパイ料）。役なし和了の不可判定（#06連携）。
- 「待って」ボタン用に**進行の一時停止**状態を表現できるようにする（§3.7, CPU思考も止まる）。

## Todo
- [x] 局の状態型（席・親・持ち点・場/局・フェーズ・手番）
- [x] アクション型と reducer（ツモ/打牌/ポン/チー/カン/リーチ/ツモ和了/ロン/パス）
- [x] 各局面での合法手列挙
- [x] 鳴きの優先順位・割り込み解決
- [x] 和了（#06/#07連携）と点数反映
- [x] 流局（テンパイ判定・点数移動）
- [x] 一時停止状態
- [x] 単体テスト（代表的な進行・割り込み・流局）

## 実装メモ
- `src/lib/mahjong/state.ts`。`GameState`（players/wall/dealer/roundWind/phase/riichiSticks/lastDiscard/paused/riichiFuriten/result）は**プレーンなシリアライズ可能データ**（#11 の game:state にそのまま）。
- **reducer は total かつ pure**：不正・一時停止中のアクションは no-op（同一参照を返す。throw しない）。依存ヘルパ（wall.draw/call*/evaluateYaku）は不正で throw するため、reducer は毎回 `legalActions` で検証してから呼ぶ＝**サーバー権威**。
- フェーズ: `awaiting-draw{seat,rinshan}` / `awaiting-discard{seat}` / `awaiting-claims{window}` / `ended{result}`。アクション: init/draw/discard{riichi?}/pon/chi/minkan/ankan/kakan/tsumo/ron/pass/pause/resume。
- 席風: `["z1".."z4"][(seat-dealer+4)%4]`（親=東）。場風 z1 固定。dealer は seed 由来 or 明示。
- **カンは2段階**（kan→awaiting-draw{rinshan}→draw が drawRinshan）。pon/chi 後は claimer が awaiting-discard（ツモなし）。鳴かれた牌は放銃者の河から除去（牌の保存則）。**カンドラ非公開**。
- 鳴き窓: discardSeat 以外に ClaimOffer（canRon/canPon/canMinkan/chiOptions＝下家のみ）を計算。全 eligible 応答で優先度解決 **ron>pon=minkan>chi**、**多重ロンは頭ハネ**。
- 合法手 `legalActions(state,seat)`（純）: 打牌候補・canTsumo・riichiDiscards（門前・未リーチ・点数≥1000・残り山≥4・打牌後テンパイ）・ankan/kakanTiles・claim 各種。
- 和了: `evaluateYaku({hand, winningTile, isTsumo, seatWind, roundWind, doraIndicators: wall.doraIndicators←生})`→`scoreFromYaku({isDealer, riichiSticks})`→点数反映（勝者は winnerGain＝供託回収）。**ツモは hand そのまま・winningTile=hand.drawn**（drawn を concealed に混ぜない）。
- 流局: 全 pass＋山尽き。形式テンパイ=`handShanten===0`。テンパイ料 t=1→3000/2→各1500/3→各1000。**リーチ棒は流局で回収しない**（1局制）。
- フリテン: 自河＋リーチ後恒久（`riichiFuriten`）。フェーズ1の判断: **チャンカンなし・リーチ後の暗槓禁止・双ロンなし（頭ハネ）**。
- 一時停止: `paused` を reducer と legalActions の両方で尊重（待ったボタンで CPU/お助けも停止）。
- `state.test.ts` 17件: 全シードのドライバ走破で**保存則（点数100000・牌136）を全遷移検証**＋ツモ/ロン+フリテン/ポン割り込み/暗槓嶺上/リーチ精算/流局テンパイ料/役なし不可/一時停止/純粋性。

## 完了条件
- 1局を最後まで（和了/流局）進められ、合法手・点数結果がテストで保証される。通信・UIに非依存。
