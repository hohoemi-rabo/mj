# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 実装の詳細ルールは作業対象に応じて自動ロードされる **`.claude/rules/`（path-scoped）** に分割している。このファイルには**毎セッション必要な要点だけ**を置く（context節約のため肥大化させない）。

## プロジェクトの現状

「ほほ笑みラボ（PC・スマホ教室）のシニア生徒向け、教室内LANで動く初心者ファーストの4人麻雀ゲーム」。**`REQUIREMENTS.md` が設計の唯一の信頼できる情報源（source of truth）**。実装は `REQUIREMENTS.md`「8. 開発ロードマップ」のフェーズ順（ロジック土台 → 役判定・点数 → ローカル4人対戦 → シニア向け仕上げ）に沿う。

**進捗はチケット単位で `docs/00-index.md` の状態欄を参照（常に最新の真実）。** 現時点のスナップショット: **#01〜#19 完了（全チケット完了）**＝基盤（#01）＋ゲームロジック層 #02〜#09（`src/lib/mahjong/` 純粋TS）＋#10 SVG牌素材（`public/tiles/`・`src/lib/tileAsset.ts`）＋#11 通信層（カスタムサーバー `server.ts`・純粋セッションコア `src/lib/server/session.ts`・差し替え可能 `src/lib/adapter/`）＋#12 状態管理（`src/lib/store/`）＋#13 共通UI基盤（`src/components/ui/`・`src/lib/cn.ts`・確認用 `/ui`）＋#14 対局画面（`src/components/game/`・`src/app/room/[id]/`・`useGameConnection`）＋#15 入室フロー（`src/app/host`・`src/app/join`・`src/components/room/`・QR/合言葉・0.0.0.0 bind・`/api/server-info`）＋#16 信頼性（CPU思考演出＝一手ずつ遅延 `CPU_DELAY_MS`・切断検知/connected反映・**切断中はCPU代行で進行継続**・通信断の自動再接続＝`room:reconnect`＋トークン再束縛・接続バナー）＋#17 音声・効果音（`src/lib/audio/` manifest/player/events・`useGameEventAudio`・BGM ループ＋トグル・**コード完成／mp3 は `public/audio/` 後入れ運用** [`docs/AUDIO_MANIFEST.md`](docs/AUDIO_MANIFEST.md)・現状 BGM/打牌SE/宣言6声 配置済）＋#18 お助けモード（`selectMyWaits`/`currentlyPossibleYaku` ヒューリスティック・`Badge`/`TenpaiNotice`/`YakuBadges`・他家河の当たり牌色分け・鳴きボタン点滅・OFFで装飾消し）＋#19 仕上げ・結果画面（`session.rematch`＋`game:rematch`/`room:dissolve` イベント＋adapter.rematch/dissolve/onDissolved＋store.rematch/dissolve/dissolved・ResultModalの大表示＋3ボタン＋aria-live・ツモ確認ダイアログ）。テスト287件（UIはブラウザ目視確認）。**全機能スコープ完了**（残るは教室実機テストとフィードバック反映の運用作業）。実機LANは2クライアント結合テスト済（作成→入室→開始→切断→CP代行→再接続→もう一局→解散）。**#19以降の後追い仕上げ**: お助け純ヘルパの形ベースガード化（drawn フラグでなく concealed+drawn の `3n+1`/`3n+2` で分岐＝鳴き直後のクラッシュ修正）／上家・下家の手牌を縦並び＋90°回転（卓っぽい見た目）／対局中の`SettingsModal`にホスト専用「対局を終了する」ボタン（`onDissolve` 経由・danger 確認）／卓面の見た目強化（`.mahjong-felt`/`.mahjong-wood` CSS・SVGノイズ＋木目グラデ＋inset/dropシャドウ・対局画面のみ周囲背景固定 `#1f1611` セピア）。**UI集約リワーク (生徒さん実機テストの反映)**: 中央スコアパネル `CenterPanel`（`RiverGrid` の `center` スロット）に4家の風/名前/CPU/点数と場風/残り山/現手番ハイライトを集約＝ Phase 1／`OpponentArea` のヘッダ(風家+名前+CPU+点数+手番枠)を撤去 = 裏向き手牌/リーチ/鳴きのみに簡素化／`HandTiles` から自席 amber 手番枠も撤去（ツモ牌の「ツモ」ラベル+ring は「いま引いた牌」を示す基本UIとして維持）＝ Phase 2／鳴き牌の方角別 90°回転（`meldDisplayTiles` ヘルパ + 単体テスト・上家=左端 / 対面=2番目 / 下家=右端 / チーは calledTile を左端へ並べ直し / 暗槓は無回転 / 加槓は4枚並びの大明槓相当）／牌同士は隙間なしで詰める（`Tile.tsx` の button から `p-1` 撤去・`HandTiles`/`OpponentArea`/`meld` の `gap-0.5` 削除・タップ域は `min-h-tap`/`min-w-tap` で確保）／`DiscardPile` に `min-w-[190px]`（1巡目に side river の捨て牌数が左右で違うと auto 列幅が非対称になり中央パネルが横ズレするバグ修正）／操作 popup を手牌上に **絶対配置**（行5廃止・row-4 wrapper を `relative`・popup は `absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2`・赤いカード `bg-danger rounded-2xl shadow-2xl`・layout を一切動かさない=シニアのノートPCで縦が足りず popup がスクロール送りになる事故と手牌のジタッと動きを同時解決）＝ Phase 4／`showActionPopup` ヘルパで「実際にボタンが1つ以上描画される場合のみ」popup を出す＝空赤カード残り防止／`ActionButtons` の Term ヒントは popup 表示時のみ省略（緊急アクションは語のみでコンパクト化・通常UIでは Term 維持）／中央パネルの風表示は「東家」→「東」（4方向のレイアウトで席が自明なため）／`TopBar` から場/自風/残りを撤去し `ドラ`/お助け Toggle/設定ボタンのみ残す＝局情報は CenterPanel に一本化（`TopBarProps` から `mySeat` 削除）＝ Phase 5／鳴き対象牌の点滅（ロン/ポン/カン/チー 可能時に `lastDiscard` を `tailwind.config.ts` 独自 `naki-pulse` keyframes＝`steps(1,end) 0.8s` で opacity 1↔0.15＋scale 1.08↔1 をカクッと不連続に切替・色なし・お助け非依存）／牌の立体感強化（`<img>` を `<span class="tile-shadow">` でラップし、外側 box-shadow 2段＋擬似要素 `::after` で上端 1.5px 白ハイライト・下端の inset 暗陰＝「光を受けた厚みのある板」感／hover で外側影が `0 10px 16px` まで深まる／ring（お助けハイライト）は `<img>` 側に残して衝突回避）／効果音デフォルト音量を MAX に引き上げ（`settingsStore.volume` 既定 0.5→1.0・persist `version:2` の `migrate` で既存 localStorage の `<1.0` も自動上書き・mp3 素の音量が控えめでもクランプ上限まで使う）。**残課題**: Phase 3 卓の見た目刷新（木目フチ撤去・フェルト簡素化）。

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
- **サーバー env**: `PORT`（既定 3000）/ `HOST`（既定 `0.0.0.0`＝LAN公開。#15）/ `CPU_DELAY_MS`（CPU思考演出の間隔ms。未指定で 0.8〜1.8s ランダム、`0` で即時＝テスト向け。#16）。ホストの LAN IP は `GET /api/server-info`、dev の他端末アクセス許可は `next.config.ts` の `allowedDevOrigins`（起動時LAN IP）。
- TypeScript `strict: true`。パスエイリアス `@/*` → `./src/*`。
- 主要ライブラリ導入済み: Zustand（状態）/ Socket.io（通信）/ qrcode / lucide-react / Vitest（テスト）/ **clsx + tailwind-merge**（クラス結合 `cn()` ＝ `src/lib/cn.ts`）。日本語フォントは BIZ UDPGothic（CSS変数 `--font-jp-sans`）。

## ルールの所在（.claude/rules/ — path-scoped で自動ロード）

各ルールは対象パスのファイルを読んだときだけ context に載る（CLAUDE.md は常時ロード）。新しい実装ルールを足すときも、毎回不要なら CLAUDE.md ではなく該当ルールに書く。

| ルール | 適用パス | 内容 |
|--------|----------|------|
| `mahjong-logic` | `src/lib/mahjong/**/*.ts` | 純粋TSの制約・牌の命名・役/点数のスコープ・テスト方針 |
| `transport-and-state` | `src/lib/adapter/**`・`src/lib/store/**`・`server.ts` | 差し替え可能アダプタ・Socket.ioイベント・サーバー権威・Zustand |
| `senior-ui` | `src/components/**/*.tsx`・`src/app/**/*.tsx` | シニア向けUI・お助けモード・音声・SVG牌素材 |
| `nextjs-app-router` | `src/**/*.tsx`・`src/app/**/*.ts` | App Router v15 ベストプラクティス（Server/Client境界・破壊的変更・ファイル規約） |
