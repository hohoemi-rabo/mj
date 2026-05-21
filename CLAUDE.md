# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクトの現状

このリポジトリは **Create Next App のボイラープレートそのまま**の状態（`src/app/page.tsx` 等はテンプレート）。アプリ本体はまだ実装されていない。

**`REQUIREMENTS.md` が設計の唯一の信頼できる情報源（source of truth）**。何を作るか・どう作るかは必ずここを参照する。概要は「ほほ笑みラボ（PC・スマホ教室）のシニア生徒向け、教室内LANで動く初心者ファーストの4人麻雀ゲーム」。

実装を進める際は `REQUIREMENTS.md` の「8. 開発ロードマップ」のフェーズ順（ロジック土台 → 役判定・点数 → ローカル4人対戦 → シニア向け仕上げ）に沿う。

## チケット / タスク管理（docs/）

開発は `REQUIREMENTS.md` を要件・機能ごとに分割した **`docs/` 配下の連番チケット**に沿って進める。一覧と推奨着手順は **`docs/00-index.md`**（連番＝依存関係に沿った開発順）。

### Todo の記法（厳守）
各チケットは Todo をチェックボックスで管理する。

- 未完了: `- [ ]`
- 完了: `- [x]`（タスクが終わったら `- [ ]` を `- [x]` に書き換える）

チケット自体を完了したら、`docs/00-index.md` のチケット一覧テーブルの状態欄も `- [x]` に更新する。作業の進捗は常にこの記法で該当チケットへ反映すること。

## コマンド

```bash
npm run dev     # 開発サーバー（Turbopack）http://localhost:3000
npm run build   # 本番ビルド（Turbopack）
npm run start   # ビルド済みアプリの起動
npm run lint    # ESLint
```

- **テストランナーは未導入**。`REQUIREMENTS.md` は役判定（`lib/mahjong/yaku.ts`）の網羅的な単体テストを要求しているため、フェーズ2に入る前にテスト基盤の選定・導入が必要。
- 単一テスト実行のコマンドは、テストフレームワーク導入後にここへ追記すること。

## アーキテクチャ（実装時の必須制約）

`REQUIREMENTS.md`「6. アーキテクチャ」で定義された3層構成を厳守する。これがこのプロジェクトの最重要な設計判断：

1. **UI層**（Next.js / React）
2. **ゲームロジック層** … `src/lib/mahjong/` 配下の**純粋なTypeScriptモジュール**。通信・React・I/Oに一切依存させない（牌・山・手牌管理、シャンテン計算、役判定、点数計算、状態遷移、CPU思考）。この分離により単体テスト容易性と将来のクラウド移植性を確保する。
3. **通信層** … `src/lib/adapter/` で差し替え可能なインターフェースにする。今回は Socket.io の `LocalAdapter`（同一LAN）のみ実装し、将来の `RemoteAdapter`（クラウド）を見据えた共通 `types.ts` を用意する。

予定ディレクトリ構成（`src/` 配下に配置。`REQUIREMENTS.md` 6.2 が詳細）：`lib/mahjong/`（ロジック）、`lib/adapter/`（通信）、`lib/store/`（Zustand）、`components/game|ui|audio|help/`、`app/{host,join,room/[id]}/`。

### 通信モデル
クラウド・DB不要。**ホストPC1台で完結**し、状態はメモリ上のみで管理（永続化なし）。Socket.io を Next.js と同居させる**カスタムサーバー `server.ts`** を使う想定。これを導入する際は `dev`/`start` スクリプトを素の `next` からカスタムサーバー起動へ変更する必要がある（現状の `next dev --turbopack` ではカスタムサーバーは動かない）。Socket.io イベント名は `REQUIREMENTS.md` 6.3 に定義済み。

## 実装に影響する製品上の制約

- **シニアファースト**：最小タップ領域 60×60px 以上、高コントラスト、大きな文字、誤操作リカバリ（打牌確認ダイアログ・「待って」「もう一度」ボタン）。
- **お助けモード**：待ち牌ハイライト・成立役の常時表示など。デフォルトON、トグルで切替。
- **役のスコープはフェーズ1限定**（リーチ/ツモ/ピンフ/タンヤオ/役牌/一盃口/三色/一気通貫/トイトイ/七対子/ホンイツ/チンイツ/表ドラのみ）。役満・一発・裏ドラ等は実装しない。1ゲーム=1局（連荘なし）。
- **音声は事前録音mp3**（TTSは使わない）を事前ロードして再生。
- **麻雀牌はSVGで自作**し `public/tiles/` に配置（命名規則は `REQUIREMENTS.md` 5.5：`m1-9` `p1-9` `s1-9` `z1-7` `back`）。

## 技術スタックの注意点

- **Tailwind CSS は v3（3.4.17）**。直近コミットで v4 から意図的にダウングレード済み（`tailwind.config.ts` + `postcss.config.mjs` で `tailwindcss`/`autoprefixer` を使う旧構成）。v4 のインライン設定は使わないこと。
- **Turbopack を dev・build 両方で使用**。
- TypeScript は `strict: true`。パスエイリアス `@/*` → `./src/*`。
- 状態管理は **Zustand**、通信は **Socket.io**（いずれも `REQUIREMENTS.md` 指定だが**未インストール**。利用開始時に追加する）。

## Next.js App Router ベストプラクティス（v15 / 最新）

context7（`/vercel/next.js`）で確認した App Router の現行ベストプラクティス。このプロジェクトはゲーム状態を **Socket.io + Zustand でクライアント駆動**するため、SSRデータフェッチ/キャッシュ機構の出番は限定的。以下のうち「Server/Client境界」「ファイル規約」「v15の破壊的変更」が特に効く。

### Server / Client Components の境界設計（最重要）
- **デフォルトは Server Component**。`'use client'` は state・effect・イベントハンドラ・ブラウザAPI（`Audio`、Socket.io クライアント等）が必要な**末端コンポーネントだけ**に付ける。境界を浅く（ツリー上位）に置くとクライアントJSが肥大化する。
- 対局画面（`app/room/[id]`）は実質クライアント主体になるが、**操作のない静的シェル・レイアウト・見出しは Server Component のまま**残し、`HandTiles` / `ActionButtons` など対話部分のみ Client Component にする。
- **Server Component を Client Component に import 不可**。組み合わせたいときは Server Component を `children` や props として Client Component に渡す（"slot" パターン）。
- データは Server Component で取得し、props で Client Component へ渡す。Client Component 内で直接サーバーデータ取得しない。

```tsx
// ❌ 不可：Client から Server を import
'use client'
import ServerThing from './server-thing'

// ✅ 可：Server を children として渡す
// app/page.tsx (Server)
<ClientShell><ServerThing /></ClientShell>
```

### v15 の破壊的変更・注意点
- **動的リクエストAPIは非同期（await 必須）**：`cookies()` `headers()` `draftMode()`、および `page.tsx`/`layout.tsx` の `params`・`searchParams` props は **Promise**。`const { id } = await params` のように await する。
- **`fetch` はデフォルトで非キャッシュ**になった（v14 までの `force-cache` デフォルトから変更）。キャッシュしたい場合のみ `fetch(url, { cache: 'force-cache' })` を明示。GET Route Handler もデフォルト非キャッシュ。Client Router Cache の page セグメントは `staleTime: 0`。
- React 19 前提（`react@19`）。

### ファイル規約を活用する
- `loading.tsx`：自動で `<Suspense>` 境界を張る即時ローディングUI（配牌待ち等にスケルトンを）。
- `error.tsx`：**Client Component 必須**。ルートセグメントのエラーバウンダリ（再接続失敗などのリカバリUIに）。
- `not-found.tsx`：存在しない部屋ID等の404。
- 部分的なストリーミングは `<Suspense>` で重い部分だけ遅延させ、ルート全体をブロックしない。

### データ更新・キャッシュ無効化
- 永続データを持たない本プロジェクトでは出番が少ないが、サーバー側ミューテーションが要るなら **Server Actions（`'use server'`）** を使う。
- 大きいファイル受信やストリーミングが要る場合は Server Actions ではなく **Route Handler（`app/api/.../route.ts`）**（bodySizeLimit の制約を受けない）。
- オンデマンド無効化は Server Action 内で `revalidateTag('tag')` / `revalidatePath('/path')`（`fetch(url, { next: { tags: ['tag'] } })` でタグ付け）。

### 最適化API
- 画像は `next/image`、フォントは `next/font`（self-host・CLS抑制）。シニア向け日本語UIなので、`next/font/google` か `next/font/local` で**日本語フォント**を設定し、`display: 'swap'` を付ける。現状の `Geist`（英字想定）は日本語表示に不向きなので差し替えを検討。
- ページ毎の `<title>`/OG は手書き `<head>` ではなく **Metadata API**（`export const metadata` / `generateMetadata`）で。現状 `layout.tsx` は `"Create Next App"` のままなので、アプリ名・`lang="ja"` に修正する。
