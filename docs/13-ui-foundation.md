# 13. 共通UI・シニア向けデザイン基盤

> 対応フェーズ: フェーズ1（叩き台）・フェーズ4（作り込み）｜ 関連要件: REQUIREMENTS.md §3.7, §2.3
> 依存: #01

## 目的
全画面で使う共通UIと、シニアファーストのデザイン基盤を整える。

## 対象ファイル
- `src/components/ui/`（ボタン・ダイアログ・トグル等）

## スコープ / 仕様（§3.7）
- **大きなボタン**: 最小タップ領域 60×60px 以上。
- **高コントラスト配色**。読みやすい日本語（用語にカッコ補足、例「リーチ（あと1枚で完成）」）。
- 共通コンポーネント: ボタン、確認ダイアログ、トグルスイッチ、モーダル、見出し。
- **打牌確認ダイアログ**「この牌を切りますか？」（オンオフ可・デフォルトオン）の共通部品。
- **横画面（ランドスケープ）基本**、縦でも崩れない最低限のレスポンシブ（§2.3）。
- 明瞭なナビゲーション（どこを押すか一目で分かる導線）。
- `'use client'` は対話部品（ボタン・ダイアログ等）に限定（CLAUDE.md / App Router 方針）。

## Todo
- [x] 大型ボタン（60px+・高コントラスト・状態表現）
- [x] 確認ダイアログ（打牌確認に流用可能）
- [x] トグルスイッチ（お助け/設定用）
- [x] モーダル/オーバーレイ基盤
- [x] 横画面前提のレイアウト基盤＋縦の最低限対応
- [x] アクセシブルな配色・フォントサイズの確定

## 実装メモ
- `src/components/ui/`: `Button`(+`buttonVariants`)・`Heading`・`Term`(用語カッコ補足)・`ScreenContainer`(横画面基本)・`Modal`・`ConfirmDialog`(打牌確認の流用元)・`Toggle`、`index.ts`(バレル)。
- クラス結合は `src/lib/cn.ts`（`clsx` + `tailwind-merge`）。`tailwind.config.ts` にセマンティック色 `primary`/`danger`（高コントラスト固定hex）と `fontSize` `sm`/`2xl` を追加。
- 提示用（directiveなし・Server/Client両用）: Button/Heading/Term/ScreenContainer。`'use client'`: Modal/ConfirmDialog/Toggle。
- 確認用ギャラリー `/ui`（`src/app/ui/page.tsx` → `src/components/showcase/UiShowcase.tsx`）。`src/app/page.tsx` はテンプレ撤去し簡易タイトル画面に置換（本格ホームは #15）。
- ConfirmDialog/Toggle は設定を参照しない純粋部品。`useSettingsStore`(`discardConfirm`/`helpMode`/`muted`)との接続は呼び出し側（#14）。

## 完了条件
- 主要共通部品が揃い、タップ領域・コントラストがシニア向け基準を満たす。
