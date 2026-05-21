// 麻雀牌のデータ表現と基本ユーティリティ（純粋TS）。
// 以降の全ロジック（山牌・手牌・シャンテン・役判定・点数）の土台。
// 内部表現は public/tiles/ のSVGファイル名と一致させる（REQUIREMENTS §5.5）。

/** 数牌のスーツ */
export type NumberSuit = "m" | "p" | "s";
/** スーツ（z は字牌） */
export type Suit = NumberSuit | "z";

/** 字牌：z1東 z2南 z3西 z4北 z5白 z6發 z7中 */
export type Honor = "z1" | "z2" | "z3" | "z4" | "z5" | "z6" | "z7";

/** 数牌（萬子・筒子・索子 各1〜9） */
export type NumberTile =
  | "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "m8" | "m9"
  | "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "p8" | "p9"
  | "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7" | "s8" | "s9";

/** 牌（標準34種） */
export type Tile = NumberTile | Honor;

/** 牌の種類数 */
export const TILE_COUNT = 34;
/** 1種あたりの枚数 */
export const TILES_PER_KIND = 4;

/** 数牌のスーツ（正準順） */
const NUMBER_SUITS: readonly NumberSuit[] = ["m", "p", "s"];

/** 全34種を正準順（m1..m9, p1..p9, s1..s9, z1..z7）で並べた配列。index順＝ソート順の唯一の出所。 */
export const ALL_TILES: readonly Tile[] = [
  ...NUMBER_SUITS.flatMap(
    (suit) => Array.from({ length: 9 }, (_, i) => `${suit}${i + 1}` as Tile),
  ),
  ...Array.from({ length: 7 }, (_, i) => `z${i + 1}` as Tile),
];

/** 全136枚（各種4枚）の多重集合。山牌側でコピーしてシャッフルする。 */
export const ALL_136: readonly Tile[] = ALL_TILES.flatMap((t) => [t, t, t, t]);

// --- 抽出 ---

/** スーツを取得（'m'|'p'|'s'|'z'） */
export const suitOf = (t: Tile): Suit => t[0] as Suit;

/** 数字を取得（数牌1〜9 / 字牌は1〜7の生番号） */
export const rankOf = (t: Tile): number => Number(t[1]);

/** 字牌か */
export const isHonor = (t: Tile): t is Honor => suitOf(t) === "z";

// --- 述語 ---

/** 数牌か（萬子・筒子・索子） */
export const isNumber = (t: Tile): boolean => !isHonor(t);

/** 老頭牌か（数牌の1または9） */
export const isTerminal = (t: Tile): boolean =>
  isNumber(t) && (rankOf(t) === 1 || rankOf(t) === 9);

/** 么九牌か（老頭牌＋字牌） */
export const isTerminalOrHonor = (t: Tile): boolean =>
  isHonor(t) || isTerminal(t);

/** 中張牌か（数牌の2〜8）。タンヤオ判定で使用 */
export const isSimple = (t: Tile): boolean => isNumber(t) && !isTerminal(t);

/** 風牌か（z1〜z4：東南西北） */
export const isWind = (t: Tile): boolean => isHonor(t) && rankOf(t) <= 4;

/** 三元牌か（z5〜z7：白發中） */
export const isDragon = (t: Tile): boolean => isHonor(t) && rankOf(t) >= 5;

// --- index 変換（0〜33。シャンテン計算の counts[34] バケット等で使用） ---

const SUIT_OFFSET: Readonly<Record<Suit, number>> = {
  m: 0,
  p: 9,
  s: 18,
  z: 27,
};

/** 牌→index（0〜33。正準順＝ソート順） */
export const tileToIndex = (t: Tile): number =>
  SUIT_OFFSET[suitOf(t)] + (rankOf(t) - 1);

/** index→牌（0〜33）。範囲外・非整数は RangeError */
export const tileFromIndex = (i: number): Tile => {
  if (!Number.isInteger(i) || i < 0 || i >= TILE_COUNT) {
    throw new RangeError(`tileFromIndex: index out of range: ${i}`);
  }
  return ALL_TILES[i];
};

// --- ソート ---

/** 牌の比較関数（m < p < s < 字牌、各内で昇順） */
export const compareTiles = (a: Tile, b: Tile): number =>
  tileToIndex(a) - tileToIndex(b);

/** 牌列を正準順にソートした新しい配列を返す（入力は破壊しない） */
export const sortTiles = (tiles: readonly Tile[]): Tile[] =>
  [...tiles].sort(compareTiles);

// --- 表示名（漢数字＋読み仮名。シニア向け / REQUIREMENTS §3.7） ---

const KANJI_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const NUMERAL_READINGS = [
  "いち", "に", "さん", "し", "ご", "ろく", "しち", "はち", "きゅう",
];
const NUMBER_SUIT_LABEL: Readonly<Record<NumberSuit, { kanji: string; sound: string }>> = {
  m: { kanji: "萬", sound: "マン" },
  p: { kanji: "筒", sound: "ピン" },
  s: { kanji: "索", sound: "ソー" },
};
const HONOR_NAMES: Readonly<Record<Honor, string>> = {
  z1: "東（ひがし）",
  z2: "南（みなみ）",
  z3: "西（にし）",
  z4: "北（きた）",
  z5: "白（はく）",
  z6: "發（はつ）",
  z7: "中（ちゅん）",
};

const buildTileName = (t: Tile): string => {
  if (isHonor(t)) return HONOR_NAMES[t];
  const suit = suitOf(t) as NumberSuit;
  const n = rankOf(t);
  const { kanji, sound } = NUMBER_SUIT_LABEL[suit];
  return `${KANJI_NUMERALS[n - 1]}${kanji}（${NUMERAL_READINGS[n - 1]}${sound}）`;
};

/** 牌→日本語表示名（漢数字＋読み仮名） */
export const TILE_NAMES: Readonly<Record<Tile, string>> = Object.fromEntries(
  ALL_TILES.map((t) => [t, buildTileName(t)]),
) as Record<Tile, string>;

/** 牌の日本語表示名を返す */
export const tileName = (t: Tile): string => TILE_NAMES[t];

// --- ドラ（表ドラのみ / REQUIREMENTS §3.2） ---

/**
 * ドラ表示牌→ドラ牌。
 * 数牌は次の数（9→1）、風は東→南→西→北→東、三元は白→發→中→白。
 * 風と三元は別サイクル（z4→z1 であって z5 にしない）。
 */
export const doraFromIndicator = (indicator: Tile): Tile => {
  if (isNumber(indicator)) {
    const suit = suitOf(indicator);
    const n = rankOf(indicator);
    return `${suit}${n === 9 ? 1 : n + 1}` as Tile;
  }
  const n = rankOf(indicator);
  if (isWind(indicator)) {
    return `z${n === 4 ? 1 : n + 1}` as Tile;
  }
  // 三元牌（z5〜z7）
  return `z${n === 7 ? 5 : n + 1}` as Tile;
};
