// 音声・効果音のID→ファイル対応（docs/17 §3.5・§5.4）。
// プレイヤーは `public/audio/{id}.mp3` を fetch する。ASCII ファイル名で衝突回避。
// mp3 未配置時は 404 で静かに失敗（プレイヤー側が握りつぶし）→ ファイルを後から入れれば自動で鳴る。

/** 宣言の音声ID。 */
export const VOICE = {
  tsumo: "voice/tsumo",
  ron: "voice/ron",
  riichi: "voice/riichi",
  pon: "voice/pon",
  chi: "voice/chi",
  kan: "voice/kan",
  ryuukyoku: "voice/ryuukyoku",
} as const;

/** 効果音のID。 */
export const SFX = {
  discard: "sfx/discard",
  meld: "sfx/meld",
  riichi: "sfx/riichi",
  applause: "sfx/applause",
  shuffle: "sfx/shuffle",
} as const;

/** BGM のID（対局中にループ再生）。 */
export const BGM = {
  game: "bgm/game",
} as const;

/**
 * 役名（YakuHit.name）→ 音声ファイルID。
 * `yaku.ts` の DRAGON_NAME・WIND_NAME と各役の `name` 文字列をそのまま辞書のキーに使う。
 * 自風/場風は風ごとに別ファイル（全 16 役＋風12種＝最大28音、運用で必要な分だけ用意すればよい）。
 * 未マップ（将来追加された役）は呼び出し側で silent。
 */
export const YAKU_FILE: Readonly<Record<string, string>> = {
  立直: "voice/yaku/riichi",
  門前清自摸和: "voice/yaku/menzen-tsumo",
  断幺九: "voice/yaku/tanyao",
  平和: "voice/yaku/pinfu",
  一盃口: "voice/yaku/iipeikou",
  三色同順: "voice/yaku/sanshoku-doujun",
  一気通貫: "voice/yaku/ittsu",
  対々和: "voice/yaku/toitoi",
  七対子: "voice/yaku/chiitoitsu",
  混一色: "voice/yaku/honitsu",
  清一色: "voice/yaku/chinitsu",
  "役牌 白": "voice/yaku/yakuhai-haku",
  "役牌 發": "voice/yaku/yakuhai-hatsu",
  "役牌 中": "voice/yaku/yakuhai-chun",
  "自風 東": "voice/yaku/jikaze-ton",
  "自風 南": "voice/yaku/jikaze-nan",
  "自風 西": "voice/yaku/jikaze-sha",
  "自風 北": "voice/yaku/jikaze-pei",
  "場風 東": "voice/yaku/bakaze-ton",
  "場風 南": "voice/yaku/bakaze-nan",
  "場風 西": "voice/yaku/bakaze-sha",
  "場風 北": "voice/yaku/bakaze-pei",
};

/** 限定役名（LimitName）→ 音声ファイルID。 */
export const LIMIT_FILE: Readonly<Record<string, string>> = {
  満貫: "voice/limit/mangan",
  跳満: "voice/limit/haneman",
  倍満: "voice/limit/baiman",
  三倍満: "voice/limit/sanbaiman",
  数え役満: "voice/limit/kazoeyakuman",
};

/** 役名から音声IDを引く（未マップなら null）。 */
export const yakuVoiceId = (name: string): string | null => YAKU_FILE[name] ?? null;

/** 限定役名から音声IDを引く（未マップなら null）。 */
export const limitVoiceId = (limitName: string | null): string | null =>
  limitName ? (LIMIT_FILE[limitName] ?? null) : null;
