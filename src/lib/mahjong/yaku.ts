// 役判定・ドラ・符（純粋TS / REQUIREMENTS §3.2）。
// 和了形（14枚）から成立する役・翻・ドラ・符を判定し、点数計算（#07）が使う
// 確定した和了形（decomposition）と符を返す。フェーズ1で実装する役のみ（役満なし）。
//
// 符の境界（設計判断）: 和了形は複数解釈に分解でき、点数最大化には「翻が同点なら
// 符が高い解釈」を選ぶ必要がある。よって本モジュールで符も算出し、(翻 desc → 符 desc)
// で解釈を選ぶ。#07 は totalHan + fu から点数と精算を行う。
//
// 純粋関数・不変・I/O非依存。結果はプレーンなデータ（テスト/同期で扱える）。

import {
  type Honor,
  type NumberSuit,
  type Tile,
  doraFromIndicator,
  isDragon,
  isHonor,
  isSimple,
  isTerminalOrHonor,
  rankOf,
  sortTiles,
  suitOf,
  tileFromIndex,
} from "@/lib/mahjong/tiles";
import {
  type Hand,
  type Meld,
  completedMeldCount,
  isMenzen,
} from "@/lib/mahjong/hand";
import { shanten, toCounts } from "@/lib/mahjong/shanten";

// --- 型 ---

export type GroupType = "sequence" | "triplet" | "kan" | "pair";

/** 面子・雀頭の1グループ。open=明（明刻/明槓/加槓/ロン完成刻）, false=暗。 */
export interface Group {
  readonly type: GroupType;
  readonly tiles: readonly Tile[];
  readonly open: boolean;
  readonly fromMeld: boolean;
}

export type WaitType = "ryanmen" | "kanchan" | "penchan" | "tanki" | "shanpon";

export interface StandardParse {
  readonly kind: "standard";
  readonly groups: readonly Group[]; // 4面子
  readonly pair: Group; // 雀頭
  readonly wait: WaitType;
  readonly winningGroupIndex: number; // groups内index、雀頭なら -1
}

export interface ChiitoitsuParse {
  readonly kind: "chiitoitsu";
  readonly pairs: readonly Group[]; // 7対子
  readonly wait: "tanki";
}

export type Parse = StandardParse | ChiitoitsuParse;

export interface YakuHit {
  readonly name: string; // 日本語役名（読み上げ/表示は #14/#17）
  readonly han: number; // 開閉に応じ食い下がり済み
}

export interface WinContext {
  readonly hand: Hand; // concealed（あがり牌を含まない）+ melds + riichi
  readonly winningTile: Tile;
  readonly isTsumo: boolean;
  readonly seatWind: Honor; // 自風
  readonly roundWind: Honor; // 場風
  readonly doraIndicators: readonly Tile[];
}

export interface YakuResult {
  readonly hasYaku: boolean; // ドラを除く役が1つ以上（=和了可能）
  readonly yaku: readonly YakuHit[];
  readonly doraCount: number; // 表ドラのみ
  readonly yakuHan: number; // Σyaku.han（ドラ除く）
  readonly totalHan: number; // yakuHan + doraCount
  readonly fu: number; // 採用解釈の符
  readonly decomposition: Parse;
  readonly winningTile: Tile;
  readonly isTsumo: boolean;
  readonly menzen: boolean;
  readonly seatWind: Honor;
  readonly roundWind: Honor;
}

// --- 名前テーブル ---

const WIND_NAME: Readonly<Record<Honor, string>> = {
  z1: "東", z2: "南", z3: "西", z4: "北", z5: "白", z6: "發", z7: "中",
};
const DRAGON_NAME: Readonly<Partial<Record<Tile, string>>> = {
  z5: "役牌 白", z6: "役牌 發", z7: "役牌 中",
};

// --- index ヘルパ（shanten と同じ境界規則） ---

const isNumberIndex = (i: number): boolean => i < 27;
const posInSuit = (i: number): number => i % 9;

// --- 副露 → Group ---

const meldToGroup = (m: Meld): Group => {
  switch (m.type) {
    case "pon":
      return { type: "triplet", tiles: [...m.tiles], open: true, fromMeld: true };
    case "chi":
      return { type: "sequence", tiles: [...m.tiles], open: true, fromMeld: true };
    case "minkan":
    case "kakan":
      return { type: "kan", tiles: [...m.tiles], open: true, fromMeld: true };
    case "ankan":
      return { type: "kan", tiles: [...m.tiles], open: false, fromMeld: true };
  }
};

// --- 和了形の分解（具体的な面子+雀頭の全列挙） ---

/** counts（バックトラッキング）から need 面子を全消費する全分解を返す。 */
const enumMentsu = (counts: number[], need: number): Group[][] => {
  if (need === 0) {
    return counts.every((c) => c === 0) ? [[]] : [];
  }
  let i = 0;
  while (i < counts.length && counts[i] === 0) i++;
  if (i >= counts.length) return [];

  const out: Group[][] = [];
  const t0 = tileFromIndex(i);
  // 刻子（字牌も可）
  if (counts[i] >= 3) {
    counts[i] -= 3;
    for (const rest of enumMentsu(counts, need - 1)) {
      out.push([{ type: "triplet", tiles: [t0, t0, t0], open: false, fromMeld: false }, ...rest]);
    }
    counts[i] += 3;
  }
  // 順子（数牌・スーツ境界内のみ）
  if (isNumberIndex(i) && posInSuit(i) <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    const seq: Tile[] = [t0, tileFromIndex(i + 1), tileFromIndex(i + 2)];
    counts[i]--; counts[i + 1]--; counts[i + 2]--;
    for (const rest of enumMentsu(counts, need - 1)) {
      out.push([{ type: "sequence", tiles: seq, open: false, fromMeld: false }, ...rest]);
    }
    counts[i]++; counts[i + 1]++; counts[i + 2]++;
  }
  return out;
};

/** concealedプールを（雀頭1 + need面子）に分解する全パターン。 */
const enumStandard = (
  counts: number[],
  need: number,
): { groups: Group[]; pair: Group }[] => {
  const out: { groups: Group[]; pair: Group }[] = [];
  for (let t = 0; t < counts.length; t++) {
    if (counts[t] >= 2) {
      const pairTile = tileFromIndex(t);
      const pair: Group = { type: "pair", tiles: [pairTile, pairTile], open: false, fromMeld: false };
      counts[t] -= 2;
      for (const mentsu of enumMentsu(counts, need)) {
        out.push({ groups: mentsu, pair });
      }
      counts[t] += 2;
    }
  }
  return out;
};

/** 順子のあがり牌位置から待ち種別を判定。 */
const sequenceWait = (tiles: readonly Tile[], w: Tile): WaitType => {
  const [a, b, c] = tiles;
  if (w === b) return "kanchan";
  if (w === a) return rankOf(a) === 7 ? "penchan" : "ryanmen"; // 789 の 7
  return rankOf(c) === 3 ? "penchan" : "ryanmen"; // 123 の 3
};

/** 1つの構造（melds固定+面子+雀頭）に対し、あがり牌の置き場ごとに待ちを展開。 */
const expandWaits = (
  groups: Group[],
  pair: Group,
  ctx: WinContext,
): StandardParse[] => {
  const w = ctx.winningTile;
  const out: StandardParse[] = [];
  // 雀頭（単騎）
  if (pair.tiles[0] === w) {
    out.push({ kind: "standard", groups, pair, wait: "tanki", winningGroupIndex: -1 });
  }
  // 各 concealed グループ
  groups.forEach((g, idx) => {
    if (g.fromMeld || !g.tiles.includes(w)) return;
    if (g.type === "triplet") {
      // シャンポン：ロン完成は明刻（minko）、ツモは暗刻
      const ng: Group = ctx.isTsumo ? g : { ...g, open: true };
      const ngroups = groups.map((x, i) => (i === idx ? ng : x));
      out.push({ kind: "standard", groups: ngroups, pair, wait: "shanpon", winningGroupIndex: idx });
    } else if (g.type === "sequence") {
      out.push({ kind: "standard", groups, pair, wait: sequenceWait(g.tiles, w), winningGroupIndex: idx });
    }
  });
  return out;
};

/** 七対子の分解（門前・副露なし・7種ちょうど2枚）。 */
const chiitoitsuParse = (ctx: WinContext): ChiitoitsuParse | null => {
  if (completedMeldCount(ctx.hand) !== 0 || !isMenzen(ctx.hand)) return null;
  const pool = sortTiles([...ctx.hand.concealed, ctx.winningTile]);
  const counts = toCounts(pool);
  let pairs = 0;
  let kinds = 0;
  for (const c of counts) {
    if (c > 0) kinds++;
    if (c === 2) pairs++;
  }
  if (kinds !== 7 || pairs !== 7) return null;
  const pairGroups: Group[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 2) {
      const t = tileFromIndex(i);
      pairGroups.push({ type: "pair", tiles: [t, t], open: false, fromMeld: false });
    }
  }
  return { kind: "chiitoitsu", pairs: pairGroups, wait: "tanki" };
};

/** あがり形の全候補（標準の待ち展開 + 七対子）を列挙。 */
export const enumerateParses = (ctx: WinContext): Parse[] => {
  const meldCount = completedMeldCount(ctx.hand);
  const meldGroups = ctx.hand.melds.map(meldToGroup);
  const pool = sortTiles([...ctx.hand.concealed, ctx.winningTile]);
  const counts = toCounts(pool);
  const out: Parse[] = [];
  for (const { groups, pair } of enumStandard(counts, 4 - meldCount)) {
    out.push(...expandWaits([...meldGroups, ...groups], pair, ctx));
  }
  const chii = chiitoitsuParse(ctx);
  if (chii) out.push(chii);
  return out;
};

// --- 役判定 ---

const isYakuhaiTile = (tile: Tile, ctx: WinContext): boolean =>
  isDragon(tile) || tile === ctx.seatWind || tile === ctx.roundWind;

/** 全physical牌（concealed + あがり牌 + 副露牌、槓は4枚）。 */
const allPhysicalTiles = (ctx: WinContext): Tile[] => [
  ...ctx.hand.concealed,
  ctx.winningTile,
  ...ctx.hand.melds.flatMap((m) => [...m.tiles]),
];

const evalYaku = (parse: Parse, ctx: WinContext, allTiles: readonly Tile[]): YakuHit[] => {
  const hits: YakuHit[] = [];
  const menzen = isMenzen(ctx.hand);

  // 門前限定（手牌全体）
  if (menzen && ctx.hand.riichi) hits.push({ name: "立直", han: 1 });
  if (menzen && ctx.isTsumo) hits.push({ name: "門前清自摸和", han: 1 });

  // タンヤオ（開でも可・喰いタンあり）
  if (allTiles.every(isSimple)) hits.push({ name: "断幺九", han: 1 });

  // 混一色・清一色（全physical牌から）
  const numberSuits = new Set<NumberSuit>();
  let hasHonor = false;
  for (const t of allTiles) {
    if (isHonor(t)) hasHonor = true;
    else numberSuits.add(suitOf(t) as NumberSuit);
  }
  if (numberSuits.size === 1) {
    if (hasHonor) hits.push({ name: "混一色", han: menzen ? 3 : 2 });
    else hits.push({ name: "清一色", han: menzen ? 6 : 5 });
  }

  if (parse.kind === "chiitoitsu") {
    hits.push({ name: "七対子", han: 2 });
    return hits;
  }

  // --- 標準形のみ ---
  const groups = parse.groups;

  // 役牌（三元・自風・場風。連風は両方計上）
  for (const g of groups) {
    if (g.type !== "triplet" && g.type !== "kan") continue;
    const tile = g.tiles[0];
    if (isDragon(tile)) hits.push({ name: DRAGON_NAME[tile]!, han: 1 });
    if (tile === ctx.seatWind) hits.push({ name: `自風 ${WIND_NAME[tile as Honor]}`, han: 1 });
    if (tile === ctx.roundWind) hits.push({ name: `場風 ${WIND_NAME[tile as Honor]}`, han: 1 });
  }

  // 平和（門前・全順子・雀頭非役牌・両面待ち）
  const allSeq = groups.every((g) => g.type === "sequence");
  if (menzen && allSeq && !isYakuhaiTile(parse.pair.tiles[0], ctx) && parse.wait === "ryanmen") {
    hits.push({ name: "平和", han: 1 });
  }

  // 一盃口（門前・concealed同一順子2組。二盃口は範囲外＝1止まり）
  if (menzen) {
    const seen = new Set<string>();
    for (const g of groups) {
      if (g.fromMeld || g.type !== "sequence") continue;
      const key = g.tiles.join(",");
      if (seen.has(key)) {
        hits.push({ name: "一盃口", han: 1 });
        break;
      }
      seen.add(key);
    }
  }

  // 三色同順・一気通貫（副露の順子も含む）
  const seqStarts: Record<NumberSuit, Set<number>> = { m: new Set(), p: new Set(), s: new Set() };
  for (const g of groups) {
    if (g.type !== "sequence") continue;
    seqStarts[suitOf(g.tiles[0]) as NumberSuit].add(rankOf(g.tiles[0]));
  }
  for (let n = 1; n <= 7; n++) {
    if (seqStarts.m.has(n) && seqStarts.p.has(n) && seqStarts.s.has(n)) {
      hits.push({ name: "三色同順", han: menzen ? 2 : 1 });
      break;
    }
  }
  for (const suit of ["m", "p", "s"] as NumberSuit[]) {
    if (seqStarts[suit].has(1) && seqStarts[suit].has(4) && seqStarts[suit].has(7)) {
      hits.push({ name: "一気通貫", han: menzen ? 2 : 1 });
      break;
    }
  }

  // 対々和（全4面子が刻子or槓）
  if (groups.every((g) => g.type === "triplet" || g.type === "kan")) {
    hits.push({ name: "対々和", han: 2 });
  }

  return hits;
};

// --- 符計算 ---

export const computeFu = (parse: Parse, ctx: WinContext): number => {
  const menzen = isMenzen(ctx.hand);
  if (parse.kind === "chiitoitsu") return 25;

  const groups = parse.groups;
  const allSeq = groups.every((g) => g.type === "sequence");
  const isPinfu =
    menzen && allSeq && !isYakuhaiTile(parse.pair.tiles[0], ctx) && parse.wait === "ryanmen";
  if (isPinfu) return ctx.isTsumo ? 20 : 30;

  let fu = 20; // 副底
  for (const g of groups) {
    if (g.type === "sequence") continue;
    const yaochu = isTerminalOrHonor(g.tiles[0]);
    if (g.type === "triplet") {
      fu += g.open ? (yaochu ? 4 : 2) : yaochu ? 8 : 4;
    } else {
      // kan
      fu += g.open ? (yaochu ? 16 : 8) : yaochu ? 32 : 16;
    }
  }
  if (isYakuhaiTile(parse.pair.tiles[0], ctx)) fu += 2; // 雀頭符
  if (parse.wait === "kanchan" || parse.wait === "penchan" || parse.wait === "tanki") fu += 2;
  if (ctx.isTsumo) fu += 2; // ツモ符
  else if (menzen) fu += 10; // 門前ロン

  return Math.ceil(fu / 10) * 10;
};

// --- ドラ ---

/** 表ドラの枚数（全physical牌中）。 */
export const countDora = (tiles: readonly Tile[], indicators: readonly Tile[]): number => {
  const doraTiles = indicators.map(doraFromIndicator);
  let n = 0;
  for (const t of tiles) {
    for (const d of doraTiles) if (t === d) n++;
  }
  return n;
};

// --- 公開: 役評価 ---

export const evaluateYaku = (ctx: WinContext): YakuResult => {
  const meldCount = completedMeldCount(ctx.hand);
  if (ctx.hand.concealed.length !== 13 - 3 * meldCount) {
    throw new Error(
      `evaluateYaku: concealed の枚数が不正です (${ctx.hand.concealed.length}, melds=${meldCount})`,
    );
  }
  const full = sortTiles([...ctx.hand.concealed, ctx.winningTile]);
  if (shanten(full, meldCount) !== -1) {
    throw new Error("evaluateYaku: 和了形ではありません");
  }

  const menzen = isMenzen(ctx.hand);
  const allTiles = allPhysicalTiles(ctx);
  const doraCount = countDora(allTiles, ctx.doraIndicators);

  const candidates = enumerateParses(ctx);
  if (candidates.length === 0) {
    throw new Error("evaluateYaku: 和了形を分解できません");
  }

  let best: { parse: Parse; yaku: YakuHit[]; yakuHan: number; fu: number } | null = null;
  for (const parse of candidates) {
    const yaku = evalYaku(parse, ctx, allTiles);
    const yakuHan = yaku.reduce((s, y) => s + y.han, 0);
    const fu = computeFu(parse, ctx);
    if (best === null || yakuHan > best.yakuHan || (yakuHan === best.yakuHan && fu > best.fu)) {
      best = { parse, yaku, yakuHan, fu };
    }
  }
  // best は candidates.length>0 のため非null
  const chosen = best!;

  return {
    hasYaku: chosen.yaku.length > 0,
    yaku: chosen.yaku,
    doraCount,
    yakuHan: chosen.yakuHan,
    totalHan: chosen.yakuHan + doraCount,
    fu: chosen.fu,
    decomposition: chosen.parse,
    winningTile: ctx.winningTile,
    isTsumo: ctx.isTsumo,
    menzen,
    seatWind: ctx.seatWind,
    roundWind: ctx.roundWind,
  };
};
