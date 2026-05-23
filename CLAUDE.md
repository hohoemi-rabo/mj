# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 実装の詳細ルールは作業対象に応じて自動ロードされる **`.claude/rules/`（path-scoped）** に分割している。このファイルには**毎セッション必要な要点だけ**を置く（context節約のため肥大化させない）。

## プロジェクトの現状

「ほほ笑みラボ（PC・スマホ教室）のシニア生徒向け、教室内LANで動く初心者ファーストの4人麻雀ゲーム」。**`REQUIREMENTS.md` が設計の唯一の信頼できる情報源（source of truth）**。実装は `REQUIREMENTS.md`「8. 開発ロードマップ」のフェーズ順（ロジック土台 → 役判定・点数 → ローカル4人対戦 → シニア向け仕上げ）に沿う。

**進捗はチケット単位で `docs/00-index.md` の状態欄を参照（常に最新の真実）。** 現時点のスナップショット: **#01〜#15 完了**＝基盤（#01）＋ゲームロジック層 #02〜#09（`src/lib/mahjong/` 純粋TS）＋#10 SVG牌素材（`public/tiles/` 35枚・`src/lib/tileAsset.ts`）＋#11 通信層（カスタムサーバー `server.ts`・純粋セッションコア `src/lib/server/session.ts`・差し替え可能 `src/lib/adapter/`）＋#12 状態管理（`src/lib/store/`）＋#13 共通UI基盤（`src/components/ui/`・`src/lib/cn.ts`・確認用 `/ui`）＋#14 対局画面（`src/components/game/`・`src/app/room/[id]/`・配線 `useGameConnection`）＋#15 入室フロー（`src/app/host`・`src/app/join`・`src/components/room/`・QR/合言葉/参加者一覧・`server.ts` を 0.0.0.0 bind・`/api/server-info`・`next.config` allowedDevOrigins で実機LAN対応）。テスト235件（UIはブラウザ目視確認）。**次は #16 信頼性（CPU補完・切断/再接続・CPU思考遅延）→ #17 音声・#18 お助け・#19 仕上げ**（`senior-ui`/`nextjs-app-router` ルール適用。見た目はブラウザ目視確認が必要、`npm run dev` はカスタムサーバー起動）。実機LANは2クライアント結合テスト済（host作成→passcode入室→開始で全員 game:state）。

## チケット / タスク管理（docs/）

開発は `REQUIREMENTS.md` を要件・機能ごとに分割した **`docs/` 配下の連番チケット**に沿って進める。一覧と推奨着手順は **`docs/00-index.md`**（連番＝依存関係に沿った開発順）。実装に着手する前に対象チケットを読む。

### Todo の記法（厳守）
各チケットは Todo をチェックボックスで管理する。

- 未完了: `- [ ]`
- 完了: `- [x]`（タスクが終わったら `- [ ]` を `- [x]` に書き換える）

チケット自体を完了したら、`docs/00-index.md` の一覧テーブルの状態欄も `- [x]` に更新する。進捗は常にこの記法で該当チケットへ反映する。

## コマンド

```bash
npm run dev           # カスタムサーバー（tsx watch server.ts・Next dev + Socket.io）http://localhost:3000
npm run build         # 本番ビルド（Turbopack）
npm run start         # 本番起動（NODE_ENV=production tsx server.ts。要 npm run build）
npm run lint          # ESLint
npm run test          # Vitest（一発実行）
npm run test:watch    # Vitest ウォッチ
npm run test:coverage # カバレッジ（v8, src/lib/** 対象）
```

- 単一テスト実行: `npx vitest run path/to/file.test.ts` または `npx vitest run -t "<テスト名>"`。
- テストは純粋TSロジック中心で `environment: 'node'`。`@/*` エイリアスは Vite ネイティブ解決（`vitest.config.ts`）。UIコンポーネントのテストが要るときに jsdom + Testing Library を追加する。

## アーキテクチャ原則（常時）

`REQUIREMENTS.md` 6章の**3層構成を厳守**する（最重要の設計判断）。各層の詳細ルールは作業時に path-scoped で自動ロードされる。

1. **ゲームロジック層** `src/lib/mahjong/`（純粋TS。通信・React・I/Oに非依存）→ ルール `mahjong-logic`
2. **通信・状態層** `src/lib/adapter/`・`src/lib/store/`・`server.ts`（差し替え可能な通信層 / Zustand）→ ルール `transport-and-state`
3. **UI層** `src/components/`・`src/app/`（Next.js / React）→ ルール `senior-ui`・`nextjs-app-router`

予定ディレクトリ構成の詳細は `REQUIREMENTS.md` 6.2。

## 技術スタックの常時注意

- **Tailwind CSS は v3（3.4.17）**。v4 から意図的にダウングレード済み（`tailwind.config.ts` + `postcss.config.mjs` 構成）。v4 のインライン設定は使わない。
- **dev/start は カスタムサーバー `server.ts`（`tsx`）**（#11 で導入。Next.js + Socket.io 同居）。dev は `next({turbopack:dev})` で **Turbopack 維持**、build は `next build --turbopack`。`@/*` は tsx が tsconfig paths で解決。サーバー権威は `src/lib/server/session.ts`（純粋）、通信は `src/lib/adapter/`（差し替え可能）。
- TypeScript `strict: true`。パスエイリアス `@/*` → `./src/*`。
- 主要ライブラリ導入済み: Zustand（状態）/ Socket.io（通信）/ qrcode / lucide-react / Vitest（テスト）。日本語フォントは BIZ UDPGothic（CSS変数 `--font-jp-sans`）。

## ルールの所在（.claude/rules/ — path-scoped で自動ロード）

各ルールは対象パスのファイルを読んだときだけ context に載る（CLAUDE.md は常時ロード）。新しい実装ルールを足すときも、毎回不要なら CLAUDE.md ではなく該当ルールに書く。

| ルール | 適用パス | 内容 |
|--------|----------|------|
| `mahjong-logic` | `src/lib/mahjong/**/*.ts` | 純粋TSの制約・牌の命名・役/点数のスコープ・テスト方針 |
| `transport-and-state` | `src/lib/adapter/**`・`src/lib/store/**`・`server.ts` | 差し替え可能アダプタ・Socket.ioイベント・サーバー権威・Zustand |
| `senior-ui` | `src/components/**/*.tsx`・`src/app/**/*.tsx` | シニア向けUI・お助けモード・音声・SVG牌素材 |
| `nextjs-app-router` | `src/**/*.tsx`・`src/app/**/*.ts` | App Router v15 ベストプラクティス（Server/Client境界・破壊的変更・ファイル規約） |
