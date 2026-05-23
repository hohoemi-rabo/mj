---
paths:
  - "src/**/*.tsx"
  - "src/app/**/*.ts"
---

# Next.js App Router ベストプラクティス（v15 / 最新）

context7（`/vercel/next.js`）で確認した App Router の現行ベストプラクティス。このプロジェクトはゲーム状態を **Socket.io + Zustand でクライアント駆動**するため、SSRデータフェッチ/キャッシュ機構の出番は限定的。以下のうち「Server/Client境界」「ファイル規約」「v15の破壊的変更」が特に効く。

## Server / Client Components の境界設計（最重要）
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

## v15 の破壊的変更・注意点
- **動的リクエストAPIは非同期（await 必須）**：`cookies()` `headers()` `draftMode()`、および `page.tsx`/`layout.tsx` の `params`・`searchParams` props は **Promise**。`const { id } = await params` のように await する。
- **`fetch` はデフォルトで非キャッシュ**になった（v14 までの `force-cache` デフォルトから変更）。キャッシュしたい場合のみ `fetch(url, { cache: 'force-cache' })` を明示。GET Route Handler もデフォルト非キャッシュ。Client Router Cache の page セグメントは `staleTime: 0`。
- React 19 前提（`react@19`）。

## ファイル規約を活用する
- `loading.tsx`：自動で `<Suspense>` 境界を張る即時ローディングUI（配牌待ち等にスケルトンを）。
- `error.tsx`：**Client Component 必須**。ルートセグメントのエラーバウンダリ（再接続失敗などのリカバリUIに）。
- `not-found.tsx`：存在しない部屋ID等の404。
- 部分的なストリーミングは `<Suspense>` で重い部分だけ遅延させ、ルート全体をブロックしない。

## データ更新・キャッシュ無効化
- 永続データを持たない本プロジェクトでは出番が少ないが、サーバー側ミューテーションが要るなら **Server Actions（`'use server'`）** を使う。
- 大きいファイル受信やストリーミングが要る場合は Server Actions ではなく **Route Handler（`app/api/.../route.ts`）**（bodySizeLimit の制約を受けない）。
- オンデマンド無効化は Server Action 内で `revalidateTag('tag')` / `revalidatePath('/path')`（`fetch(url, { next: { tags: ['tag'] } })` でタグ付け）。

## 最適化API
- フォントは `next/font`：#13 で `layout.tsx` に **BIZ UDPGothic**（`--font-jp-sans`・`display:'swap'`）＋`lang="ja"`＋アプリ名 metadata を設定済（Create Next App テンプレは撤去済）。
- ページ毎の `<title>` は **Metadata API**（`export const metadata`）。各ルート（`/host`・`/join`・`/room/[id]` 等）で設定済み。
- 画像最適化は基本 `next/image` だが、**牌などの固定寸法な静的SVG（`public/tiles`）は素の `<img>`** でよい（`next/image` 未設定・最適化不要・固定寸法でCLS無し）。`Tile.tsx`/`QrCode.tsx` のその行のみ `// eslint-disable-next-line @next/next/no-img-element`。
- 既存ルート: `/`(Server・導線)・`/host`・`/join`(`await searchParams` で `?code=`)・`/room/[id]`(`await params`)・`/api/server-info`(Route Handler・`dynamic='force-dynamic'`)・`/ui`(部品ギャラリー)。
