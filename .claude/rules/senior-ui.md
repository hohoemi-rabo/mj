---
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/*.tsx"
---

# シニア向けUI・素材のルール（components / app）

ほほ笑みラボのシニア生徒（ほぼ全員が麻雀初心者）が対象。**シニアファースト・初心者ファースト**を最優先する（REQUIREMENTS.md §3.7）。Next.js/React の書き方は `nextjs-app-router` ルールも併せて適用。該当チケット: `docs/13`（UI基盤）・`docs/14`（対局画面）・`docs/15`（入室）・`docs/17`〜`docs/19`。

## シニア向けUIの必須要件（§3.7）
- **大きなボタン・牌**：最小タップ領域 60×60px 以上。
- **高コントラスト配色**・大きな文字。
- **読みやすい日本語**：用語にカッコ補足（例「リーチ（あと1枚で完成）」）。
- **誤操作リカバリ**：打牌確認ダイアログ「この牌を切りますか？」（オンオフ可・デフォルトオン）/「待って」ボタン（自ターン一時停止、CPU思考も停止）/「もう一度」ボタン（直前アクション取消）。
- **横画面（ランドスケープ）基本**、縦でも崩れない最低限のレスポンシブ（§2.3）。
- 明瞭なナビゲーション（どこを押すか一目で分かる導線）。

## お助けモード（§3.3）
- デフォルトON・トグルで切替。ON時: 待ち牌ハイライト / 聴牌通知 / 他家河の当たり牌・有効牌の色分け / リーチ可能ボタン点滅 / 成立役の常時表示 / 鳴き可能通知＋意味の説明。
- OFF時: ツモ・ロン・鳴き・リーチの成立可能通知のみ（最低限）。
- 待ち・役・合法手はロジック層（`src/lib/mahjong`）から取得し、UIは提示するだけにする。

## 音声・効果音（§3.5）
- **事前録音mp3**を事前ロードして再生（TTSは使わない）。読み上げ: ツモ/ロン/リーチ/ポンチーカン/役名・点数/流局。効果音: 牌切る音/鳴き・リーチSE/アガリ拍手/配牌シャッフル。
- 音量は端末ごとに調節・ミュート可（デフォルト中音量）。`Audio` を使う部分は `'use client'`。

## SVG麻雀牌素材（§5.5 / public/tiles）
- 自作SVG。viewBox `0 0 60 80`（縦長3:4）、背景 白/淡クリーム、枠線 濃グレー `#333` 2px、角丸6px、高コントラスト、数字・図柄は大きめ。
- 命名: `m1`〜`m9` / `p1`〜`p9` / `s1`〜`s9` / `z1`〜`z7` / `back`。パス解決は `@/lib/tileAsset`（`tileImagePath(tile)` / `TILE_BACK_PATH`）に集約。
- 描画は**素の `<img>`**（next/image 未設定・固定寸法で最適化不要）。`Tile.tsx` のその行だけ `// eslint-disable-next-line @next/next/no-img-element`。
- **裏向き（faceDown）時は牌種を一切描画しない**（他家の concealed 漏洩防止＝最重要。OpponentArea には枚数だけ渡す）。

## 既存の共通部品（再利用・再発明しない／#13〜#16 実装済）
- `@/components/ui`: `Button`(+`buttonVariants({variant,size})`)・`Heading`・`Term`(用語＋カッコ補足)・`Input`・`ScreenContainer`(横画面土台/`showRotateHint`)・`Modal`(portal/Esc/フォーカス/`dismissOnOverlayClick`既定false)・`ConfirmDialog`(打牌確認の流用元/`tone`)・`Toggle`。クラス結合は `cn()`＝`@/lib/cn`(clsx+tailwind-merge)。
- Tailwind トークン: タップ域 `min-h-tap`/`min-w-tap`=60px、`fontSize` `sm/base/lg/xl/2xl`、`colors` `primary`/`danger`（高コントラスト固定hex）。
- `@/components/game`: GameBoard・Tile・HandTiles・DiscardPile・RiverGrid・OpponentArea・ActionButtons(+ChiOptionPicker/KanTilePicker)・TopBar・SettingsModal・ResultModal・ErrorToast・WaitButton・QrCode・PracticeStartButton。`@/components/room`: HostScreen・HostLobby・JoinScreen・PlayerList・useServerInfo・useGotoRoomOnStart。配線は `useGameConnection`。

## 配色・お助けの実装注意
- **ダークモード同化に注意**: `globals.css` は `prefers-color-scheme` で `--background`/`--foreground` を反転する。**固定グレー背景 ＋ `text-foreground`（反転する）の組合せは同化**するので、`dark:` バリアントか固定ペア（例 `text-gray-900 dark:text-gray-50`）で両モード可読にする（#13 で実害＝修正済）。
- お助けは**ロジック層から取得して提示するだけ**。待ち牌計算 `handWaits` は `drawn!==null` で throw → `selectors` の純ヘルパ（`tenpaiKeepDiscards`/`waitsAfterDiscard`、drawn ガード内包）を `useMemo` で使う。
- 操作は `useGameStore().send` のみ（楽観適用しない＝次の `game:state` を待つ）。「待って」は #14 のローカル一時停止のまま（server 連動は未実装）。
