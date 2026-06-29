// 1プレイヤーの手牌管理（純粋TS / REQUIREMENTS §3.1, §3.2）。
// 純手牌・副露（鳴き）・捨て牌（河）・ツモ牌・リーチ状態と、その上の操作を扱う。
// #05 シャンテン・#06 役判定・#07 点数・#08 ステートマシンが共通参照する土台。
//
// 設計方針:
// - 純粋関数＋不変更新（毎操作で新しい Hand を返す）。React・通信・I/Oに非依存。
// - Hand はメソッドを持たないプレーンオブジェクト（#11 で game:state として
//   シリアライズ同期できるよう、wall.ts と同方針）。
// - hand.ts は「構造的不変条件」だけを強制する（牌が手にあるか・面子の形が正しいか）。
//   手番/席の意味/テンパイ/フリテン等のゲーム文脈の合法性は #08 の責務。
// - 自風・場風など牌以外のゲーム文脈は保持しない（#08 が #06/#07 へ文脈として渡す）。

import { isNumber, rankOf, sortTiles, suitOf, type Tile } from "@/lib/mahjong/tiles";

/** 副露の種別。minkan=大明槓 / ankan=暗槓 / kakan=加槓 */
export type MeldType = "pon" | "chi" | "minkan" | "ankan" | "kakan";

/** 副露（鳴き）1つ。 */
export interface Meld {
  readonly type: MeldType;
  /** 構成牌（sortTiles 済み）。pon/chi=3枚、各カン=4枚。 */
  readonly tiles: readonly Tile[];
  /** 他家から取得した牌（pon/chi/minkan/kakan）。ankan は null。 */
  readonly calledTile: Tile | null;
  /** 鳴いた相手の席(0..3)。ankan は null。kakan は元の pon から継承。 */
  readonly from: number | null;
}

/** 捨て牌（河）の1枚。 */
export interface Discard {
  readonly tile: Tile;
  /** ツモ切り（ツモ牌をそのまま捨てた）か。 */
  readonly tsumogiri: boolean;
  /** この打牌でリーチ宣言したか（横向き表示）。 */
  readonly riichi: boolean;
}

/**
 * 1プレイヤーの手牌。
 *
 * 注: シャンポン（双碰）ロンの明刻は和了時に concealed 側に存在し melds には入らない。
 * その符上の扱いは和了形を分解する側（#06/#07）の責務で、hand.ts の melds には現れない。
 */
export interface Hand {
  /** 純手牌（concealed）。常に sortTiles 維持。drawn は含めない。 */
  readonly concealed: readonly Tile[];
  /** 副露（鳴いた順）。 */
  readonly melds: readonly Meld[];
  /** 今ツモった牌（ツモ切り判定・UI用に分離）。なければ null。 */
  readonly drawn: Tile | null;
  /** 捨て牌（打牌順）。 */
  readonly discards: readonly Discard[];
  /** リーチ宣言済みか。 */
  readonly riichi: boolean;
}

/** 配牌の枚数。 */
export const STARTING_HAND_SIZE = 13;

// --- 内部ユーティリティ ---

/** 牌列から tile を1枚除いた新配列を返す（存在しなければ throw）。 */
const removeOne = (tiles: readonly Tile[], tile: Tile): Tile[] => {
  const i = tiles.indexOf(tile);
  if (i < 0) throw new Error(`手牌に ${tile} がありません`);
  return [...tiles.slice(0, i), ...tiles.slice(i + 1)];
};

/** 牌列から tile を n 枚除いた新配列を返す（不足なら throw）。 */
const removeN = (tiles: readonly Tile[], tile: Tile, n: number): Tile[] => {
  let rest: Tile[] = [...tiles];
  for (let k = 0; k < n; k++) rest = removeOne(rest, tile);
  return rest;
};

/** 牌列中の tile の枚数。 */
const countOf = (tiles: readonly Tile[], tile: Tile): number =>
  tiles.reduce((n, t) => (t === tile ? n + 1 : n), 0);

// --- 生成 ---

/** 配牌13枚から手牌を作る（concealed はソート）。13枚以外は throw。 */
export const createHand = (tiles: readonly Tile[]): Hand => {
  if (tiles.length !== STARTING_HAND_SIZE) {
    throw new Error(`createHand: 配牌は${STARTING_HAND_SIZE}枚必要です (received ${tiles.length})`);
  }
  return {
    concealed: sortTiles(tiles),
    melds: [],
    drawn: null,
    discards: [],
    riichi: false,
  };
};

// --- 門前・面子の述語 ---

/** 副露が門前を崩すか（暗槓のみ崩さない）。 */
export const isOpenMeld = (meld: Meld): boolean => meld.type !== "ankan";
/** 副露が暗（門前）か。 */
export const isClosedMeld = (meld: Meld): boolean => meld.type === "ankan";

/** 門前か（鳴きが無い、または暗槓のみ）。 */
export const isMenzen = (hand: Hand): boolean => hand.melds.every(isClosedMeld);

/** ツモ牌込みの純手牌（ソート済み）。#05 シャンテン・#06 門前役が使用。 */
export const concealedWithDrawn = (hand: Hand): Tile[] =>
  sortTiles(hand.drawn ? [...hand.concealed, hand.drawn] : [...hand.concealed]);

/** 完成面子（副露）の数。暗槓も1面子として数える（#05 が 4−この値で必要面子を算出）。 */
export const completedMeldCount = (hand: Hand): number => hand.melds.length;

/** 論理枚数（手番間13/ツモ時14。カンも3として数える＝嶺上補充でバランス）。 */
export const handTileCount = (hand: Hand): number =>
  hand.concealed.length + 3 * hand.melds.length + (hand.drawn ? 1 : 0);

/** 物理枚数（カンは4枚で数える。136保存則の検証用）。 */
export const physicalTileCount = (hand: Hand): number =>
  hand.concealed.length +
  hand.melds.reduce((n, m) => n + m.tiles.length, 0) +
  (hand.drawn ? 1 : 0);

/** 直近の捨て牌（無ければ null）。 */
export const lastDiscard = (hand: Hand): Discard | null =>
  hand.discards.length > 0 ? hand.discards[hand.discards.length - 1] : null;

// --- ツモ・打牌 ---

/** ツモ。drawn にセット（既に drawn があれば throw）。 */
export const drawTile = (hand: Hand, tile: Tile): Hand => {
  if (hand.drawn !== null) {
    throw new Error("drawTile: 既にツモ牌があります（先に打牌してください）");
  }
  return { ...hand, drawn: tile };
};

/**
 * 打牌。drawn と concealed を合わせたプールから1枚捨てる（ツモ切り/手出しを統一処理）。
 * ツモ切り判定は drawn と同一牌を捨てたか（同名牌が手にある場合もツモ牌を切ったとみなす慣習）。
 * opts.riichi 指定時は門前かつ未リーチでのみ宣言できる（テンパイ判定は #08 の責務）。
 */
export const discard = (
  hand: Hand,
  tile: Tile,
  opts?: { riichi?: boolean },
): Hand => {
  const declareRiichi = opts?.riichi ?? false;
  if (declareRiichi) {
    if (!isMenzen(hand)) throw new Error("discard: 副露があるためリーチできません");
    if (hand.riichi) throw new Error("discard: 既にリーチ済みです");
  }

  const pool = hand.drawn ? [...hand.concealed, hand.drawn] : [...hand.concealed];
  const rest = removeOne(pool, tile); // プールに無ければ throw
  const tsumogiri = hand.drawn !== null && tile === hand.drawn;

  return {
    ...hand,
    concealed: sortTiles(rest),
    drawn: null,
    discards: [...hand.discards, { tile, tsumogiri, riichi: declareRiichi }],
    riichi: hand.riichi || declareRiichi,
  };
};

// --- 鳴き（ポン・チー・カン） ---

/** twoFromHand＋calledTile が同種・連続の数牌順子か。 */
const isValidChi = (calledTile: Tile, twoFromHand: readonly [Tile, Tile]): boolean => {
  const three = sortTiles([calledTile, ...twoFromHand]);
  if (!three.every(isNumber)) return false;
  const suit = suitOf(three[0]);
  if (!three.every((t) => suitOf(t) === suit)) return false;
  return rankOf(three[1]) === rankOf(three[0]) + 1 && rankOf(three[2]) === rankOf(three[1]) + 1;
};

/** ポン可能か（自分の手番でない＝drawn無し、かつ同種2枚所持）。 */
export const canCallPon = (hand: Hand, tile: Tile): boolean =>
  hand.drawn === null && countOf(hand.concealed, tile) >= 2;

/** ポン。同種2枚を消費して明刻を作る。次は呼び出し側が打牌する。 */
export const callPon = (hand: Hand, tile: Tile, from: number): Hand => {
  if (hand.riichi) throw new Error("callPon: リーチ後はポンできません");
  if (hand.drawn !== null) throw new Error("callPon: ツモ牌がある状態ではポンできません");
  if (countOf(hand.concealed, tile) < 2) throw new Error(`callPon: ${tile} が2枚ありません`);
  return {
    ...hand,
    concealed: removeN(hand.concealed, tile, 2),
    melds: [
      ...hand.melds,
      { type: "pon", tiles: sortTiles([tile, tile, tile]), calledTile: tile, from },
    ],
  };
};

/** チー可能か（drawn無し、かつ twoFromHand を所持して順子が成立）。 */
export const canCallChi = (
  hand: Hand,
  tile: Tile,
  twoFromHand: readonly [Tile, Tile],
): boolean => {
  if (hand.drawn !== null) return false;
  if (!isValidChi(tile, twoFromHand)) return false;
  // twoFromHand を実際に所持しているか（同一牌2枚要求にも対応）
  try {
    removeN(removeOne(hand.concealed, twoFromHand[0]), twoFromHand[1], 1);
    return true;
  } catch {
    return false;
  }
};

/** チー。手中の2枚＋鳴いた牌で順子を作る（不正な形・牌不足は throw）。 */
export const callChi = (
  hand: Hand,
  tile: Tile,
  from: number,
  twoFromHand: readonly [Tile, Tile],
): Hand => {
  if (hand.riichi) throw new Error("callChi: リーチ後はチーできません");
  if (hand.drawn !== null) throw new Error("callChi: ツモ牌がある状態ではチーできません");
  if (!isValidChi(tile, twoFromHand)) {
    throw new Error(`callChi: ${twoFromHand.join(",")} と ${tile} は順子になりません`);
  }
  const rest = removeOne(removeOne(hand.concealed, twoFromHand[0]), twoFromHand[1]);
  return {
    ...hand,
    concealed: rest,
    melds: [
      ...hand.melds,
      { type: "chi", tiles: sortTiles([tile, ...twoFromHand]), calledTile: tile, from },
    ],
  };
};

/** 大明槓（明カン）可能か（自分の手番でない＝drawn無し、かつ同種3枚所持）。 */
export const canCallMinkan = (hand: Hand, tile: Tile): boolean =>
  hand.drawn === null && countOf(hand.concealed, tile) >= 3;

/** 大明槓。手中3枚＋鳴いた牌でカンを作る。嶺上ツモは呼び出し側（#08）が行う。 */
export const callMinkan = (hand: Hand, tile: Tile, from: number): Hand => {
  if (hand.riichi) throw new Error("callMinkan: リーチ後は大明槓できません");
  if (hand.drawn !== null) throw new Error("callMinkan: ツモ牌がある状態では大明槓できません");
  if (countOf(hand.concealed, tile) < 3) throw new Error(`callMinkan: ${tile} が3枚ありません`);
  return {
    ...hand,
    concealed: removeN(hand.concealed, tile, 3),
    melds: [
      ...hand.melds,
      { type: "minkan", tiles: [tile, tile, tile, tile], calledTile: tile, from },
    ],
  };
};

/** 暗槓可能か（concealed+drawn で同種4枚）。 */
export const canCallAnkan = (hand: Hand, tile: Tile): boolean =>
  countOf(concealedWithDrawn(hand), tile) >= 4;

/** 暗槓。手中（ツモ込み）4枚でカンを作る。門前は維持。drawn は消費して null に。 */
export const callAnkan = (hand: Hand, tile: Tile): Hand => {
  const pool = concealedWithDrawn(hand);
  if (countOf(pool, tile) < 4) throw new Error(`callAnkan: ${tile} が4枚ありません`);
  return {
    ...hand,
    concealed: removeN(pool, tile, 4),
    drawn: null,
    melds: [...hand.melds, { type: "ankan", tiles: [tile, tile, tile, tile], calledTile: null, from: null }],
  };
};

/** 加槓可能か（同種の既存ポンがあり、4枚目を concealed+drawn で所持）。 */
export const canCallKakan = (hand: Hand, tile: Tile): boolean => {
  const hasPon = hand.melds.some((m) => m.type === "pon" && m.tiles[0] === tile);
  return hasPon && countOf(concealedWithDrawn(hand), tile) >= 1;
};

/** 加槓。既存のポンに4枚目を加えてカン化（calledTile/from を継承）。drawn は消費して null に。 */
export const callKakan = (hand: Hand, tile: Tile): Hand => {
  const idx = hand.melds.findIndex((m) => m.type === "pon" && m.tiles[0] === tile);
  if (idx < 0) throw new Error(`callKakan: ${tile} のポンがありません`);
  const pool = concealedWithDrawn(hand);
  if (countOf(pool, tile) < 1) throw new Error(`callKakan: 加える ${tile} がありません`);
  const pon = hand.melds[idx];
  const melds = [...hand.melds];
  melds[idx] = {
    type: "kakan",
    tiles: [tile, tile, tile, tile],
    calledTile: pon.calledTile,
    from: pon.from,
  };
  return { ...hand, concealed: removeOne(pool, tile), drawn: null, melds };
};
