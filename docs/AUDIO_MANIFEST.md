# 音声・効果音 マニフェスト（#17）

`src/lib/audio/manifest.ts` の規約。プレイヤーは `public/audio/{id}.mp3` を再生する。**未配置の mp3 は 404 で静かに失敗してゲームは続行**するので、必要なものから順に追加していけばよい。

## 推奨ファイル形式
- 形式: **mp3**（要件§5.4「事前録音mp3」）。
- 長さ: 宣言・役名は 0.5〜1.5 秒。SFX は 0.2〜0.8 秒。拍手は 1〜2 秒。
- 音量: ノーマライズして揃える（音量はプレイヤー側でも `useSettingsStore.volume` を反映）。
- サンプリングレート/ビットレート: 44.1kHz / 128kbps 程度で十分。

## 素材調達
要件§5.4 は実行時 TTS を禁止しているが、**事前に mp3 を作って配置するのは問題なし**。例:
- 教室で実際の声を録音（最もシニア向け・親しみやすい）
- 無料の効果音サイトから DL（出典明記の規約に従う）
- オフラインの音声合成サービスで mp3 を生成してから配置

## 配置先
すべて `public/audio/` 配下。下記の **id** に `.mp3` を付け、サブディレクトリを掘って置く。

## 一覧

### 宣言（voice）— 必須に近い
| id | 想定セリフ | 場面 |
|----|-----------|------|
| `voice/tsumo` | 「ツモ！」 | 自摸和了 |
| `voice/ron` | 「ロン！」 | 出和了 |
| `voice/riichi` | 「リーチ！」 | リーチ宣言 |
| `voice/pon` | 「ポン」 | ポン宣言 |
| `voice/chi` | 「チー」 | チー宣言 |
| `voice/kan` | 「カン」 | 暗カン・加カン・大明カン共通 |
| `voice/ryuukyoku` | 「流局」 | 流局 |

### 効果音（sfx）— 必須に近い
| id | 想定SE | 場面 |
|----|-------|------|
| `sfx/discard` | 牌を切る音 | あらゆる打牌 |
| `sfx/meld` | 鳴きの効果音 | ポン/チー/カン直前 |
| `sfx/riichi` | リーチ宣言の効果音（棒を置く音等） | リーチ |
| `sfx/applause` | 拍手 | 和了直後 |
| `sfx/shuffle` | 牌をシャッフルする音 | 配牌（対局開始） |

### BGM — 任意
| id | 想定 | 場面 |
|----|------|------|
| `bgm/game` | 対局中の背景音楽（ループ再生） | 対局中ずっと（終局・タイトル時は停止）。マスター音量×0.5・BGMトグルでON/OFF・ミュート連動 |

### 役名（voice/yaku）— 任意（未配置は読み上げ省略）
このプロジェクトで実装している役（`mahjong-logic` ルール参照）。

| id | 役 |
|----|----|
| `voice/yaku/riichi` | 立直 |
| `voice/yaku/menzen-tsumo` | 門前清自摸和 |
| `voice/yaku/tanyao` | 断幺九 |
| `voice/yaku/pinfu` | 平和 |
| `voice/yaku/iipeikou` | 一盃口 |
| `voice/yaku/sanshoku-doujun` | 三色同順 |
| `voice/yaku/ittsu` | 一気通貫 |
| `voice/yaku/toitoi` | 対々和 |
| `voice/yaku/chiitoitsu` | 七対子 |
| `voice/yaku/honitsu` | 混一色 |
| `voice/yaku/chinitsu` | 清一色 |
| `voice/yaku/yakuhai-haku` | 役牌 白 |
| `voice/yaku/yakuhai-hatsu` | 役牌 發 |
| `voice/yaku/yakuhai-chun` | 役牌 中 |
| `voice/yaku/jikaze-ton` | 自風 東 |
| `voice/yaku/jikaze-nan` | 自風 南 |
| `voice/yaku/jikaze-sha` | 自風 西 |
| `voice/yaku/jikaze-pei` | 自風 北 |
| `voice/yaku/bakaze-ton` | 場風 東 |
| `voice/yaku/bakaze-nan` | 場風 南 |
| `voice/yaku/bakaze-sha` | 場風 西 |
| `voice/yaku/bakaze-pei` | 場風 北 |

### 限定役名（voice/limit）— 任意
| id | 役 |
|----|----|
| `voice/limit/mangan` | 満貫 |
| `voice/limit/haneman` | 跳満 |
| `voice/limit/baiman` | 倍満 |
| `voice/limit/sanbaiman` | 三倍満 |
| `voice/limit/kazoeyakuman` | 数え役満 |

## 動作確認
1. 任意の mp3 を `public/audio/sfx/discard.mp3` に置く。
2. `npm run dev` でタイトルから「ひとりで練習」。
3. 打牌すると音が鳴る。設定モーダルの「音を試す」でも同じ音が再生される。
4. ミュートONや音量変更が**次の再生から**反映される（プレイヤーは毎再生で `settingsStore` を読み出す）。
