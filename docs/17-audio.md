# 17. 音声・効果音システム

> 対応フェーズ: フェーズ4 ｜ 関連要件: REQUIREMENTS.md §3.5, §5.4
> 依存: #08, #12, #14

## 目的
「ワイワイ感」の中心となる音声読み上げ・効果音を実装する。シニアにも状況が伝わる。

## 対象ファイル
- `src/components/audio/`（再生コンポーネント/フック）
- `public/audio/`（mp3 素材）

## スコープ / 仕様（§3.5, §5.4）
- **音声読み上げ**（事前録音mp3。TTSは使わない §5.4）: ツモ・ロン宣言 / リーチ宣言 / ポン・チー・カン宣言 / 役名・点数アナウンス / 流局アナウンス。
- **効果音**: 牌を切る音 / 鳴き・リーチSE / アガリ時の**拍手音** / 配牌時のシャッフル音。
- **再生方式**: `HTMLAudioElement` または Web Audio API。mp3は**事前ロード**（§5.4）。
- **音量**: 各端末で個別調節・ミュート可能。デフォルト中音量（ストア #12 と連携 §3.5）。
- ゲーム状態（#08）・UIイベント（#14）に紐づけて発火。点数/役名は #07 の結果から読み上げ。

## Todo
- [ ] **mp3 素材の用意**（運用作業。一覧は [`AUDIO_MANIFEST.md`](./AUDIO_MANIFEST.md)。未配置は無音で続行）
- [x] 事前ロード機構（`src/lib/audio/player.ts` の `preload`・遅延キャッシュ）
- [x] 再生フック/コンポーネント（音量・ミュートは `settingsStore` を毎再生で参照）
- [x] ゲームイベント→音声/効果音のマッピング（`src/lib/audio/events.ts`＋`useGameEventAudio`：打牌SE/鳴き/リーチ/宣言/拍手/役名/限定役名/流局/シャッフル）
- [x] 音量設定UIとストア連携（`SettingsModal` のスライダ＋ミュート＋「音を試す」）
- [ ] 端末で音量・ミュートを確認（ブラウザ目視・mp3 を1つでも置けば即確認可）

## 完了条件
- 主要イベントで適切な読み上げ・効果音が鳴り、端末ごとに音量・ミュートできる。
- ＊mp3 未配置でも 404 を握りつぶしてゲームは無音で続行。後から `public/audio/` にドロップすれば自動で鳴り出す。

## 実装メモ
- `src/lib/audio/manifest.ts`：ID→ファイルパス規約（`voice/*`・`sfx/*`・`voice/yaku/*`・`voice/limit/*`）。役名は `YakuHit.name` を辞書キーに。
- `src/lib/audio/player.ts`（`'use client'`）：`play(id)`/`playSequence(ids)`/`preload(ids)`。`useSettingsStore` を毎再生で参照。404・autoplay 失敗は握りつぶし→ゲーム続行。
- `src/lib/audio/events.ts`（純関数）：`detectAudioEvents(prev, curr)` で `shuffle`/`discard`/`riichi`/`meld`/`win`/`ryuukyoku` を返す。`events.test.ts` で8件テスト。
- `src/components/game/useGameEventAudio.ts`：`GameBoard` で1行呼び。`useRef` で prev 保持、`useEffect` で発火、gameState=null で prev リセット（再開で `shuffle` が鳴る）。
- 数字（翻/符/点数）の読み上げは対象外（ResultModal の視覚表示）。お助け由来の音声通知は #18。
