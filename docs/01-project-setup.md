# 01. プロジェクト基盤整備

> 対応フェーズ: フェーズ1の前提 ｜ 関連要件: REQUIREMENTS.md §5（技術スタック）
> 依存: なし

## 目的
ボイラープレート状態のリポジトリを、本要件の開発に必要な状態へ整える。依存追加・テスト基盤・シニア向け／日本語向けの初期設定を済ませる。

## 対象ファイル
- `package.json`（依存・スクリプト）
- `src/app/layout.tsx`（`lang="ja"`・メタデータ・フォント）
- `src/app/globals.css` / `tailwind.config.ts`（シニア向けデザイントークン）
- テスト設定（`vitest.config.ts` 等）

## スコープ / 仕様
- 依存追加: `zustand`（状態）, `socket.io` / `socket.io-client`（通信）, `qrcode`（ホスト画面のQR）, `lucide-react`（アイコン, §5.5）。
- テスト基盤: **Vitest を推奨**（純粋TSロジックの単体テストが高速。役判定の網羅テストに必要 / §8 フェーズ2）。`npm run test` を追加。
- `layout.tsx` の `lang="en"`→`ja`、`title`/`description` をアプリ名に修正（現状 "Create Next App"）。
- フォントを**日本語対応**へ（`next/font` で Noto Sans JP 等、`display: 'swap'`）。英字向け `Geist` を置換。
- Tailwind にシニア向けトークン（大きめ基準フォント・高コントラスト色・最小タップ60px相当のサイズ）を定義。
- `tailwindcss` は **v3 系のまま**（v4化しない / CLAUDE.md 参照）。

## Todo
- [x] `zustand` / `socket.io` / `socket.io-client` / `qrcode` / `lucide-react` を追加
- [x] Vitest を導入し `npm run test`（および watch / coverage）スクリプトを追加
- [x] `layout.tsx` を `lang="ja"`・適切な `metadata` に修正
- [x] 日本語フォントを `next/font` で設定し `Geist` を置換
- [x] シニア向けデザイントークン（フォントサイズ・コントラスト・タップ領域）を Tailwind に定義
- [x] `npm run dev` / `lint` / `test` が通ることを確認

## 実装メモ
- 日本語フォントは **BIZ UDPGothic**（UDフォント・視認性優先）を CSS変数 `--font-jp-sans` で配線。アプリ名は **ほほ笑み麻雀**。
- `@/*` エイリアスのテスト解決は `vite-tsconfig-paths` ではなく **Vite ネイティブの `resolve.tsconfigPaths`** を使用（依存を1つ削減）。
- `src/lib/__smoke__.ts` / `__smoke__.test.ts` は暫定スモーク。`src/lib/mahjong` の実テストが入ったら削除する（docs/02 以降）。
- 既知の npm audit（moderate×2）は Next.js 同梱の `postcss` 由来。`audit fix --force` は Next を v9 へ破壊的ダウングレードするため**適用しない**。

## 完了条件
- `npm install` 後に `dev`・`lint`・`test` がエラーなく動く。
- トップページが日本語フォント・`lang="ja"` で表示される。
