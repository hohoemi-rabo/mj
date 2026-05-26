# 18. お助けモード

> 対応フェーズ: フェーズ4 ｜ 関連要件: REQUIREMENTS.md §3.3
> 依存: #05, #08, #12, #14

## 目的
初心者でも遊べる「お助けモード」を実装する。トグルで切替・**デフォルトON**。

## 対象ファイル
- `src/components/help/`
- 連携: 対局画面（#14）・ストア（#12）

## スコープ / 仕様（§3.3）
- **ON時**:
  - 自分の手牌に対する**待ち牌をハイライト**（#05 の待ち牌列挙）。
  - 聴牌時に**「あと1枚でアガリ！」通知**。
  - 他家の捨て牌のうち、自分の**当たり牌・有効牌を色分け**。
  - リーチ可能時に**「リーチできます」ボタンが点滅**。
  - 現在成立しうる役を**手牌の下に常時表示**（#06 連携）。
  - 鳴き可能時の通知＋意味の説明（読みやすい日本語・カッコ補足 §3.7）。
- **OFF時**: ツモ・ロン・鳴き・リーチの成立可能通知のみ（最低限のサポート）。
- 個別トグル（ストア #12、デフォルトON）。合法手・待ち・役は既存ロジックから取得し、UIで提示するだけにする。

## Todo
- [x] 待ち牌ハイライト（#14 で自手牌の `tenpai-keep`/`riichi` 枠強調済み）
- [x] 聴牌通知「あと1枚でアガリ！」（`TenpaiNotice` バッジ・手牌上に表示）
- [x] 他家河の当たり牌の色分け（`DiscardPile` の `helpHighlight` prop ＋ `Tile` の `wait` ハイライト・**待ち牌のみ**＝tenpai時のみ）
- [x] リーチ可能ボタンの点滅（#14 で実装済）
- [x] 成立役の常時表示（`YakuBadges`＋`currentlyPossibleYaku` ヒューリスティック）
- [x] 鳴き可能通知＋意味の説明（claim 中の **pon/chi/kan ボタンも点滅** ＋ 既存 `<Term>` のカッコ補足）
- [x] ON/OFFトグル（デフォルトON）と OFF時の最低限通知（既存 `helpMode`・OFFで装飾が消える）

## 完了条件
- ONで待ち/役/危険牌/各種通知が表示され、OFFで最低限通知のみになる。トグルが効く。

## 実装メモ
- `src/lib/store/selectors.ts` に追加: `selectMyWaits(hand)`（drawn===null && tenpai時の `handWaits` 集合）／`currentlyPossibleYaku(hand, seatWind, roundWind)`（13/14枚どちらでも動くヒューリスティック）。
- ヒューリスティック対象役: **タンヤオ・役牌(白發中／自風／場風)・ホンイツ・チンイツ・七対子・対々和・リーチ・門前清自摸和**。三色同順／一気通貫／一盃口は**誤検出回避**のため進行中表示はしない（決定時は `evaluateYaku` が結果モーダルで正確に表示）。
- 役名文字列は `yaku.ts` の `YakuHit.name` と完全一致＝音声 mp3 マッピングと統一。
- 河ハイライトは **自席を除く他家3河のみ**（自分の捨て牌に当たり牌は出ない）。
- 新規 UI: `src/components/ui/Badge.tsx`（primary/danger/info/neutral・高コントラスト）／`src/components/game/TenpaiNotice.tsx`／`src/components/game/YakuBadges.tsx`。
- テスト: `src/lib/store/selectors.test.ts`（19件・`tenpaiKeepDiscards`/`waitsAfterDiscard`/`selectMyWaits`/`currentlyPossibleYaku` を網羅）。
