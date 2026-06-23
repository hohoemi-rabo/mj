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
- **誤操作リカバリ**：打牌確認ダイアログ「この牌を切りますか？」（オンオフ可・デフォルトオン・#13/#14 実装済）／「待って」ボタン（自ターン一時停止・#14 はローカルオーバーレイのみ＝**サーバー連動 pause は未実装**）／「もう一度」（**専用ボタンなし**＝ロン/ツモ/解散の `ConfirmDialog` とチー/カンの Picker で「直前アクションの確認・取り消し」を網羅・#19 解釈）。
- **横画面（ランドスケープ）基本**、縦でも崩れない最低限のレスポンシブ（§2.3）。
- 明瞭なナビゲーション（どこを押すか一目で分かる導線）。

## お助けモード（§3.3／#18 実装範囲）
- デフォルトON・トグルで切替（`settingsStore.helpMode`）。
- **実装済み**（#14＋#18）: 自手牌の待ち牌/リーチ可能枠ハイライト（`tenpai-keep`/`riichi`）／聴牌通知バッジ「あと1枚でアガリ！」（`TenpaiNotice`）／他家河の**待ち牌**色分け（`DiscardPile` の `helpHighlight`・自席は除外）／ツモ・ロン・リーチ・鳴きボタンの `animate-pulse`／**成立しうる役**バッジ列（`YakuBadges`＋`currentlyPossibleYaku` ヒューリスティック）／鳴き意味は `<Term word hint>` のカッコ補足。
- **意図的な対象外**（ユーザー判断・誤検出回避）: 三色同順／一気通貫／一盃口の進行中推測表示／有効牌（ukeire）の河ハイライト／鳴きの長文説明モーダル。
- OFF 時は装飾がすべて消え、操作ボタンだけ残る（§3.3 OFF時の最低限通知）。
- 待ち・役・合法手はロジック層（`src/lib/mahjong`）から取得し、selectors の純ヘルパ（`tenpaiKeepDiscards`/`waitsAfterDiscard`/`selectMyWaits`/`currentlyPossibleYaku`）経由で `useMemo` してから UI に渡す。**ガードは形ベース**（`concealed+drawn` の `3n+1`/`3n+2`・詳細は `transport-and-state` の「お助け純ヘルパの形ベースガード」）。ポン/チー直後（`drawn===null` だが 3n+2）の throw 回避を含む。

## 音声・効果音（§3.5／#17 実装済み）
- 設計どおり**事前録音mp3**を再生（実行時TTSは使わない・§5.4）。**コード側は完成**：
  - `src/lib/audio/manifest.ts` … ID→`/audio/{id}.mp3` 規約（VOICE/SFX/BGM／役名・限定役名の辞書）
  - `src/lib/audio/player.ts` … `play/playSequence/preload/startBgm/stopBgm/setBgmVolume`。**404・autoplay・デコード失敗は握りつぶす**＝mp3 未配置でもゲーム継続。`useSettingsStore` の volume/muted/bgmOn を毎再生で参照。
  - `src/lib/audio/events.ts` … `detectAudioEvents(prev,curr)` 純関数（shuffle/discard/riichi/meld/win/ryuukyoku）。
  - `useGameEventAudio()`（gameState 差分→SE/読み上げ発火）と `useGameBgm()`（対局中ループ・終局で停止・マスター×0.5）を `GameBoard` で1回ずつ呼ぶだけで配線完了。
- **mp3 素材は `public/audio/` 後入れ運用**（一覧は `docs/AUDIO_MANIFEST.md`）。未配置のものは無音でスキップ。役名 mp3 のキーは `YakuHit.name` と一致（音声と表示文字列を統一）。
- 音量は端末ごとに調節・ミュート可（デフォルト中音量・既定 ON）。`Audio` を使う部分は `'use client'`。

## SVG麻雀牌素材（§5.5 / public/tiles）
- 自作SVG。viewBox `0 0 60 80`（縦長3:4）、背景 白/淡クリーム、枠線 濃グレー `#333` 2px、角丸6px、高コントラスト、数字・図柄は大きめ。
- 命名: `m1`〜`m9` / `p1`〜`p9` / `s1`〜`s9` / `z1`〜`z7` / `back`。パス解決は `@/lib/tileAsset`（`tileImagePath(tile)` / `TILE_BACK_PATH`）に集約。
- 描画は**素の `<img>`**（next/image 未設定・固定寸法で最適化不要）。`Tile.tsx` のその行だけ `// eslint-disable-next-line @next/next/no-img-element`。
- **裏向き（faceDown）時は牌種を一切描画しない**（他家の concealed 漏洩防止＝最重要。OpponentArea には枚数だけ渡す）。

## 既存の共通部品（再利用・再発明しない／#13〜#19 実装済）
- `@/components/ui`: `Button`(+`buttonVariants({variant,size})`)・`Heading`・`Term`(用語＋カッコ補足)・`Input`・`ScreenContainer`(横画面土台/`showRotateHint`)・`Modal`(portal/Esc/フォーカス/`dismissOnOverlayClick`既定false)・`ConfirmDialog`(打牌/ロン/ツモ/解散の確認に流用・`tone='default'|'danger'`)・`Toggle`・**`Badge`**(primary/danger/info/neutral・#18)。クラス結合は `cn()`＝`@/lib/cn`(clsx+tailwind-merge)。
- Tailwind トークン: タップ域 `min-h-tap`/`min-w-tap`=60px、`fontSize` `sm/base/lg/xl/2xl`、`colors` `primary`/`danger`（高コントラスト固定hex）。
- `@/components/game`: GameBoard・Tile・HandTiles・DiscardPile・RiverGrid・OpponentArea・ActionButtons(+ChiOptionPicker/KanTilePicker)・TopBar・SettingsModal・ResultModal・ErrorToast・WaitButton・QrCode・PracticeStartButton・**TenpaiNotice/YakuBadges**(#18)・**useGameEventAudio/useGameBgm**(#17 フック)。`@/components/room`: HostScreen・HostLobby・JoinScreen・PlayerList・useServerInfo・useGotoRoomOnStart。配線は `useGameConnection`。

## 結果画面・確認パターン（#19）
- `ResultModal` は `role="status" aria-live="polite"` で読み上げ補助。タイトル `Heading level=1`、役名 `text-lg`、翻符・合計点 `text-2xl` の「大表示」化。
- 終局後の動線はホスト分岐: **ホスト**=「もう一局」(primary)/「部屋を解散」(secondary→**danger ConfirmDialog 確認**)/「タイトルへ戻る」(ghost)。**非ホスト**=「タイトルへ戻る」のみ＋「ホストが次の操作を選んでいます…」案内。
- 取り消し不能な行動は**確認ダイアログを必ず挟む**: 打牌（`useSettingsStore.discardConfirm`・既定ON）／ロン（`tone='danger'`）／ツモ（`tone='default'`・#19 で追加）／部屋を解散（`tone='danger'`）。チー/カン は picker が確認役を兼ねる。
- **対局途中のホスト中断**: `SettingsModal` の最下部に `isHost && onDissolve` のときだけ「対局を終了する」(`variant=danger`) を出す。確定で同じ #19 dissolve パイプライン（`gameStore.dissolve` → `room:dissolve` → `room:dissolved`）を使うので、終局後の「部屋を解散」と同じ挙動・終わらせ方が統一される。

## 対局画面の見た目（卓・他家・周囲背景）
- **卓フェルト＋木目フチ**: `globals.css` の `.mahjong-felt`（#0a3b22 ＋ radial vignette ＋ SVG feTurbulence ノイズ）と `.mahjong-wood`（#4a2f1a ＋ 横方向グラデ ＋ repeating-linear-gradient の年輪線）を、`GameBoard` の felt 用 grid item に **外=wood 枠 `p-2`／内=felt 子div** の二重構造で適用。外側は `0_8px_24px` のドロップシャドウ、内側は `inset_0_3px_6px` のインナーシャドウで「凹んだ卓面」感を出す。
- **felt の grid 配置**: `col-span-3 col-start-1 row-span-3 row-start-2` で 行2-4 を覆う背景。**他の grid item（自手牌行など）には `col-start-1` を明示**しないと、felt の row-span が行4を埋めてる扱いになって auto-placement が暗黙列を右に作り卓外へはみ出す（過去バグ）。コンテンツ側は `relative z-10` で felt（`z-0`）の上に乗せる。
- **木目フチからの逃げ**: 上家/下家・対面・自手牌行はそれぞれ `ml-4`/`mr-4`/`mt-4`/`pb-5 px-4` で felt の内側に引き込む。グリッドのセル端は wood 枠と一致してるので、margin/padding がないと文字や牌が枠線に被る。
- **他家手牌（卓っぽい縦並び）**: `OpponentArea` の position が `left`/`right` のときは裏向き牌を `flex-col` で縦一列に積み、`Tile` を `rotated`（90°回転）にする。回転後の見た目が 40w×30h なので各タイルを `h-[30px] w-[40px]` のラッパに入れる（`rotate` は box 寸法を変えないため）。対面（top）は従来どおり横並び折返し。melds は読みやすさ優先で常に横並び。
- **OpponentArea ヘッダ2行化**: 1行目=`風家`（`windLabel(seatWind)`に「家」を付ける）＋名前＋CPUバッジ、2行目=持ち点（`toLocaleString()` で `25,000点`・`text-base font-bold tabular-nums`）。`whitespace-nowrap`＋`leading-tight` で狭い枠でも崩れない。`ml-auto` は狭い枠で挙動が崩れたので撤去。
- **周囲背景の固定色**: 対局画面 (`GameBoard`/`Centered`) の `ScreenContainer` には **`className="bg-[#1f1611] text-white"`** を渡してダーク/ライト両モードで同じセピア背景に固定する。`Heading` は `text-foreground` を自前で持つので、ロード画面では `!text-white` で上書き必須。`YakuBadges` の「狙えそうな役：」ラベルもフェルト上にあるため `text-white/80` に固定（`text-foreground/70` だとライトモードで埋もれる）。Modal は portal なので親の `text-white` の影響を受けず、上書き不要。

## 配色・お助けの実装注意
- **ダークモード同化に注意**: `globals.css` は `prefers-color-scheme` で `--background`/`--foreground` を反転する。**固定グレー背景 ＋ `text-foreground`（反転する）の組合せは同化**するので、`dark:` バリアントか固定ペア（例 `text-gray-900 dark:text-gray-50`）で両モード可読にする（#13 で実害＝修正済）。
- お助けは**ロジック層から取得して提示するだけ**。待ち牌計算 `handWaits` は `drawn!==null` で throw → `selectors` の純ヘルパ（`tenpaiKeepDiscards`/`waitsAfterDiscard`、drawn ガード内包）を `useMemo` で使う。
- 操作は `useGameStore().send` のみ（楽観適用しない＝次の `game:state` を待つ）。「待って」は #14 のローカル一時停止のまま（server 連動は未実装）。
