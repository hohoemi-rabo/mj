# 04. 手牌管理

> 対応フェーズ: フェーズ1 ｜ 関連要件: REQUIREMENTS.md §3.1, §3.2
> 依存: #02

## 目的
プレイヤーの手牌（純手・副露・捨て牌）を管理する。

## 対象ファイル
- `src/lib/mahjong/hand.ts`（純粋TS）

## スコープ / 仕様
- 手牌の状態: 純手牌（concealed）、副露（ポン・チー・カン）、ツモ牌、捨て牌（河）。
- 操作: ツモ、打牌（手出し/ツモ切り）、ポン・チー・カン（明カン/暗カン/加カン）、リーチ宣言。
- 門前判定（鳴きの有無）— 役判定（#06）・点数（#07）で使用。
- 副露の形を保持（鳴いた牌・誰から鳴いたか）。役の食い下がり・符計算に必要。
- 不変更新（新しい手牌オブジェクトを返す）。

## Todo
- [x] 手牌データ構造（純手/副露/捨て牌/リーチ状態/門前フラグ）
- [x] ツモ・打牌
- [x] ポン・チー・各種カン（明/暗/加）
- [x] リーチ宣言の状態管理
- [x] 門前判定・副露情報の保持
- [x] 単体テスト

## 実装メモ
- `src/lib/mahjong/hand.ts`。`Hand`/`Meld`/`Discard` はメソッドを持たないプレーンオブジェクト（#11 の `game:state` 同期でシリアライズ可能、`wall.ts` と同方針）。すべて純粋関数・不変更新（新 `Hand` を返す）。
- 構造: `concealed`（純手牌・常にソート）/ `melds`（副露・鳴いた順）/ `drawn`（ツモ牌を分離保持＝ツモ切り判定・UI用）/ `discards`（河）/ `riichi`。
- `Meld` は `type`(pon/chi/minkan/ankan/kakan) + `tiles` + `calledTile` + `from`(席0..3)。**暗槓のみ門前維持**（`isMenzen = melds.every(type==="ankan")`）。`calledTile`/`from` は #06 食い下がり・#07 符（明刻/暗刻・明槓/暗槓）・UI表示用。kakan は元 pon の `calledTile`/`from` を継承。
- 操作: `createHand`(13枚) / `drawTile` / `discard`（drawn+concealed のプールから1枚切る統一処理。ツモ切り＝drawn と同一牌。`{riichi:true}` は門前かつ未リーチでのみ） / `callPon` `callChi` `callMinkan` `callAnkan` `callKakan`。嶺上ツモは呼び出し側（#08）が `wall.drawRinshan` で行う。
- 補助/述語（DRY・#05/#06/#08 用）: `isMenzen` `isOpenMeld`/`isClosedMeld` `concealedWithDrawn`（ツモ込み純手牌） `completedMeldCount` `handTileCount`(論理=カン3) `physicalTileCount`(物理=カン4) `lastDiscard`、各 call に対応する非throw述語 `canCallPon/Chi/Minkan/Ankan/Kakan`。
- 不正は明確なメッセージで throw（早期検出）。**手番/席の意味/テンパイ/フリテン等のゲーム文脈の合法性は #08 の責務**で hand.ts は構造的不変条件のみ強制。自風・場風は保持しない。
- `tiles.ts` の `Tile`/`sortTiles`/`suitOf`/`rankOf`/`isNumber` を再利用（再定義なし）。
- `hand.test.ts` で網羅（生成/ツモ/打牌・ツモ切り/手出し・各鳴き・カン3種・門前遷移・リーチガード・枚数不変条件・多重集合保存・不変性・一連遷移）。

## 完了条件
- 一連の操作（配牌→ツモ→鳴き→打牌→リーチ）で手牌・河・門前状態が正しく遷移し、テストが通る。
