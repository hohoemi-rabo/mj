// ゲーム進行ステートマシン（純粋TS / REQUIREMENTS §3.1, §3.6, §6.1）。
// 1局（配牌→ツモ/打牌ループ→鳴き割り込み→リーチ→和了/流局）を駆動する純粋reducer。
// 通信非依存。状態全体はプレーンデータで、#11 の game:state としてそのまま同期できる
// （class/closure/Map/Set を state に持たせない）。サーバー権威＝reducer が単一の真実で、
// 不正・一時停止中のアクションは no-op（state をそのまま返す。throw しない）。
//
// フェーズ1の判断: 多重ロンは頭ハネ（双ロンなし）/ フリテンは自河＋リーチ後恒久 /
// チャンカンなし / リーチ後の暗槓は禁止 / 流局でリーチ棒は回収しない（1局制）。

import { type Honor, type Tile, rankOf, sortTiles, suitOf } from "@/lib/mahjong/tiles";
import {
  type Hand,
  callAnkan,
  callChi,
  callKakan,
  callMinkan,
  callPon,
  canCallAnkan,
  canCallChi,
  canCallKakan,
  canCallMinkan,
  canCallPon,
  concealedWithDrawn,
  createHand,
  discard as discardTileFromHand,
  drawTile,
  isMenzen,
} from "@/lib/mahjong/hand";
import {
  type Wall,
  RINSHAN_MAX,
  buildWall,
  createRng,
  currentDora,
  deal,
  draw as drawFromWall,
  drawRinshan,
  isExhausted,
  remainingDraws,
} from "@/lib/mahjong/wall";
import { handShanten, handWaits } from "@/lib/mahjong/shanten";
import { type YakuHit, evaluateYaku } from "@/lib/mahjong/yaku";
import { type LimitName, type ScoreResult, scoreFromYaku } from "@/lib/mahjong/score";

// --- 型 ---

export type Seat = 0 | 1 | 2 | 3;

export interface PlayerState {
  readonly seat: Seat;
  readonly hand: Hand;
  readonly points: number;
  readonly seatWind: Honor;
}

export interface ClaimOffer {
  readonly seat: Seat;
  readonly canRon: boolean;
  readonly canPon: boolean;
  readonly canMinkan: boolean;
  readonly chiOptions: readonly [Tile, Tile][];
}

export type ClaimChoice =
  | { readonly kind: "pass" | "ron" | "pon" | "minkan" }
  | { readonly kind: "chi"; readonly tiles: readonly [Tile, Tile] };

export interface ClaimResponse {
  readonly seat: Seat;
  readonly choice: ClaimChoice;
}

export interface ClaimWindow {
  readonly discardSeat: Seat;
  readonly discardTile: Tile;
  readonly eligible: readonly ClaimOffer[];
  readonly responses: readonly ClaimResponse[];
}

export interface Winner {
  readonly seat: Seat;
  readonly isTsumo: boolean;
  readonly yaku: readonly YakuHit[];
  readonly han: number;
  readonly fu: number;
  readonly limitName: LimitName | null;
  readonly score: ScoreResult;
}

export type GameResult =
  | {
      readonly kind: "win";
      readonly winners: readonly Winner[];
      readonly loserSeat: Seat | null; // ロンの放銃者。ツモは null
      readonly pointDeltas: readonly number[]; // length 4
      readonly riichiSticksCollected: number;
    }
  | {
      readonly kind: "ryuukyoku";
      readonly tenpaiSeats: readonly Seat[];
      readonly pointDeltas: readonly number[]; // length 4
    };

export type Phase =
  | { readonly kind: "awaiting-draw"; readonly seat: Seat; readonly rinshan: boolean }
  | { readonly kind: "awaiting-discard"; readonly seat: Seat }
  | { readonly kind: "awaiting-claims"; readonly window: ClaimWindow }
  | { readonly kind: "ended"; readonly result: GameResult };

export interface GameState {
  readonly seed: number;
  readonly players: readonly PlayerState[];
  readonly wall: Wall;
  readonly dealer: Seat;
  readonly roundWind: Honor; // 場風（常に東 z1）
  readonly phase: Phase;
  readonly riichiSticks: number;
  readonly lastDiscard: { readonly seat: Seat; readonly tile: Tile } | null;
  readonly paused: boolean;
  readonly riichiFuriten: readonly boolean[]; // length 4
  readonly result: GameResult | null; // phase.result のミラー
}

export type GameAction =
  | { type: "init"; seed: number; dealer?: Seat }
  | { type: "draw" }
  | { type: "discard"; seat: Seat; tile: Tile; riichi?: boolean }
  | { type: "pon"; seat: Seat }
  | { type: "chi"; seat: Seat; tiles: [Tile, Tile] }
  | { type: "minkan"; seat: Seat }
  | { type: "ankan"; seat: Seat; tile: Tile }
  | { type: "kakan"; seat: Seat; tile: Tile }
  | { type: "tsumo"; seat: Seat }
  | { type: "ron"; seat: Seat }
  | { type: "pass"; seat: Seat }
  | { type: "pause" }
  | { type: "resume" };

export interface LegalActions {
  readonly canDraw: boolean;
  readonly discards: readonly Tile[];
  readonly canTsumo: boolean;
  readonly riichiDiscards: readonly Tile[];
  readonly canPon: boolean;
  readonly chiOptions: readonly [Tile, Tile][];
  readonly ankanTiles: readonly Tile[];
  readonly kakanTiles: readonly Tile[];
  readonly canMinkan: boolean;
  readonly canRon: boolean;
  readonly canPass: boolean;
}

const NO_ACTIONS: LegalActions = {
  canDraw: false, discards: [], canTsumo: false, riichiDiscards: [], canPon: false,
  chiOptions: [], ankanTiles: [], kakanTiles: [], canMinkan: false, canRon: false, canPass: false,
};

// --- 小ヘルパ ---

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const WINDS: readonly Honor[] = ["z1", "z2", "z3", "z4"];

const next = (seat: Seat): Seat => (((seat + 1) % 4) as Seat);
const seatWindOf = (seat: Seat, dealer: Seat): Honor => WINDS[(seat - dealer + 4) % 4];

const distinctSorted = (tiles: readonly Tile[]): Tile[] => sortTiles([...new Set(tiles)]);

const setPlayerHand = (
  players: readonly PlayerState[],
  seat: Seat,
  hand: Hand,
): PlayerState[] => players.map((p) => (p.seat === seat ? { ...p, hand } : p));

/** 鳴かれた牌を放銃者の河から除く（牌の保存則を保つ）。 */
const removeLastDiscard = (hand: Hand): Hand => ({
  ...hand,
  discards: hand.discards.slice(0, -1),
});

/** あがり牌候補に対するチー構成牌の候補（数牌のみ）。 */
const chiCandidatePairs = (tile: Tile): [Tile, Tile][] => {
  if (suitOf(tile) === "z") return [];
  const s = suitOf(tile);
  const r = rankOf(tile);
  const mk = (a: number, b: number): [Tile, Tile] => [`${s}${a}` as Tile, `${s}${b}` as Tile];
  const out: [Tile, Tile][] = [];
  if (r - 2 >= 1) out.push(mk(r - 2, r - 1));
  if (r - 1 >= 1 && r + 1 <= 9) out.push(mk(r - 1, r + 1));
  if (r + 2 <= 9) out.push(mk(r + 1, r + 2));
  return out;
};

const chiOptionsFor = (hand: Hand, tile: Tile): [Tile, Tile][] =>
  chiCandidatePairs(tile).filter((pair) => canCallChi(hand, tile, pair));

/** ロン可能か（フリテン・待ち・役を確認）。 */
const canRonTile = (state: GameState, seat: Seat, tile: Tile): boolean => {
  const player = state.players[seat];
  const hand = player.hand;
  if (hand.drawn !== null) return false; // 鳴き応答中は drawn なし
  if (state.riichiFuriten[seat]) return false;
  if (hand.discards.some((d) => d.tile === tile)) return false; // 自河フリテン
  if (!handWaits(hand).includes(tile)) return false;
  const ctx = {
    hand,
    winningTile: tile,
    isTsumo: false,
    seatWind: player.seatWind,
    roundWind: state.roundWind,
    doraIndicators: state.wall.doraIndicators,
  };
  return evaluateYaku(ctx).hasYaku;
};

// --- 初期化 ---

export const createInitialState = (seed: number, opts?: { dealer?: Seat }): GameState => {
  const built = buildWall(seed);
  const { hands, wall } = deal(built);
  const dealer: Seat = opts?.dealer ?? ((Math.floor(createRng(seed)() * 4) % 4) as Seat);
  const players: PlayerState[] = SEATS.map((seat) => ({
    seat,
    hand: createHand(hands[seat]),
    points: 25000,
    seatWind: seatWindOf(seat, dealer),
  }));
  return {
    seed,
    players,
    wall,
    dealer,
    roundWind: "z1",
    phase: { kind: "awaiting-draw", seat: dealer, rinshan: false },
    riichiSticks: 0,
    lastDiscard: null,
    paused: false,
    riichiFuriten: [false, false, false, false],
    result: null,
  };
};

// --- セレクタ ---

export const currentSeat = (state: GameState): Seat | null => {
  const p = state.phase;
  if (p.kind === "awaiting-draw" || p.kind === "awaiting-discard") return p.seat;
  return null;
};

export const isPlayersTurn = (state: GameState, seat: Seat): boolean => currentSeat(state) === seat;

export const doraTiles = (state: GameState): Tile[] => currentDora(state.wall);

// --- 合法手 ---

const discardPhaseActions = (state: GameState, seat: Seat): LegalActions => {
  const player = state.players[seat];
  const hand = player.hand;
  const pool = concealedWithDrawn(hand);
  const allTiles = distinctSorted(pool);
  // リーチ済みはツモ切り（drawn）のみ
  const discards = hand.riichi && hand.drawn ? [hand.drawn] : allTiles;

  let canTsumo = false;
  if (hand.drawn !== null && handShanten(hand) === -1) {
    canTsumo = evaluateYaku({
      hand,
      winningTile: hand.drawn,
      isTsumo: true,
      seatWind: player.seatWind,
      roundWind: state.roundWind,
      doraIndicators: state.wall.doraIndicators,
    }).hasYaku;
  }

  const riichiDiscards: Tile[] = [];
  if (
    isMenzen(hand) && !hand.riichi && hand.drawn !== null &&
    player.points >= 1000 && remainingDraws(state.wall) >= 4
  ) {
    for (const t of allTiles) {
      if (handShanten(discardTileFromHand(hand, t)) === 0) riichiDiscards.push(t);
    }
  }

  const ankanTiles: Tile[] = [];
  const kakanTiles: Tile[] = [];
  if (!hand.riichi && remainingDraws(state.wall) > 0 && state.wall.rinshanDrawn < RINSHAN_MAX) {
    for (const t of allTiles) {
      if (canCallAnkan(hand, t)) ankanTiles.push(t);
      if (canCallKakan(hand, t)) kakanTiles.push(t);
    }
  }

  return {
    ...NO_ACTIONS,
    discards,
    canTsumo,
    riichiDiscards,
    ankanTiles,
    kakanTiles,
  };
};

export const legalActions = (state: GameState, seat: Seat): LegalActions => {
  if (state.paused || state.phase.kind === "ended") return NO_ACTIONS;
  if (state.phase.kind === "awaiting-draw") {
    return state.phase.seat === seat ? { ...NO_ACTIONS, canDraw: true } : NO_ACTIONS;
  }
  if (state.phase.kind === "awaiting-discard") {
    return state.phase.seat === seat ? discardPhaseActions(state, seat) : NO_ACTIONS;
  }
  // awaiting-claims
  const window = state.phase.window;
  const offer = window.eligible.find((o) => o.seat === seat);
  if (!offer || window.responses.some((r) => r.seat === seat)) return NO_ACTIONS;
  return {
    ...NO_ACTIONS,
    canPon: offer.canPon,
    canMinkan: offer.canMinkan,
    chiOptions: offer.chiOptions,
    canRon: offer.canRon,
    canPass: true,
  };
};

// --- 和了・流局の適用 ---

const applyWin = (
  state: GameState,
  winnerSeat: Seat,
  isTsumo: boolean,
  winningTile: Tile,
): GameState => {
  const winner = state.players[winnerSeat];
  const y = evaluateYaku({
    hand: winner.hand,
    winningTile,
    isTsumo,
    seatWind: winner.seatWind,
    roundWind: state.roundWind,
    doraIndicators: state.wall.doraIndicators,
  });
  const sr = scoreFromYaku(y, { isDealer: winnerSeat === state.dealer, riichiSticks: state.riichiSticks });

  const newPoints = state.players.map((p) => p.points);
  if (sr.payment.type === "ron") {
    const loser = state.lastDiscard!.seat;
    newPoints[winnerSeat] += sr.total;
    newPoints[loser] -= sr.total;
  } else if (sr.payment.type === "tsumo-dealer") {
    for (const s of SEATS) if (s !== winnerSeat) newPoints[s] -= sr.payment.each;
    newPoints[winnerSeat] += sr.payment.each * 3;
  } else {
    for (const s of SEATS) {
      if (s === winnerSeat) continue;
      newPoints[s] -= s === state.dealer ? sr.payment.dealer : sr.payment.nonDealer;
    }
    newPoints[winnerSeat] += sr.total;
  }
  newPoints[winnerSeat] += sr.riichiStickPoints; // 供託回収

  const pointDeltas = newPoints.map((pt, i) => pt - state.players[i].points);
  const players = state.players.map((p, i) => ({ ...p, points: newPoints[i] }));
  const result: GameResult = {
    kind: "win",
    winners: [{ seat: winnerSeat, isTsumo, yaku: y.yaku, han: y.totalHan, fu: y.fu, limitName: sr.limitName, score: sr }],
    loserSeat: isTsumo ? null : state.lastDiscard!.seat,
    pointDeltas,
    riichiSticksCollected: state.riichiSticks,
  };
  return { ...state, players, riichiSticks: 0, phase: { kind: "ended", result }, result };
};

const TENPAI_PAYMENT: Readonly<Record<number, { winEach: number; loseEach: number }>> = {
  1: { winEach: 3000, loseEach: 1000 },
  2: { winEach: 1500, loseEach: 1500 },
  3: { winEach: 1000, loseEach: 3000 },
};

const applyRyuukyoku = (state: GameState): GameState => {
  const tenpaiSeats = SEATS.filter((s) => handShanten(state.players[s].hand) === 0);
  const t = tenpaiSeats.length;
  const pointDeltas = [0, 0, 0, 0];
  if (t !== 0 && t !== 4) {
    const { winEach, loseEach } = TENPAI_PAYMENT[t];
    for (const s of SEATS) pointDeltas[s] = tenpaiSeats.includes(s) ? winEach : -loseEach;
  }
  const players = state.players.map((p, i) => ({ ...p, points: p.points + pointDeltas[i] }));
  const result: GameResult = { kind: "ryuukyoku", tenpaiSeats, pointDeltas };
  return { ...state, players, phase: { kind: "ended", result }, result };
};

// --- 進行・鳴き解決 ---

const advance = (
  state: GameState,
  discardSeat: Seat,
  riichiFuriten: readonly boolean[],
): GameState => {
  if (isExhausted(state.wall)) return applyRyuukyoku({ ...state, riichiFuriten });
  return { ...state, riichiFuriten, phase: { kind: "awaiting-draw", seat: next(discardSeat), rinshan: false } };
};

const openClaimWindow = (state: GameState, discardSeat: Seat, tile: Tile): GameState => {
  const eligible: ClaimOffer[] = [];
  for (const seat of SEATS) {
    if (seat === discardSeat) continue;
    const hand = state.players[seat].hand;
    const canRon = canRonTile(state, seat, tile);
    const canPon = canCallPon(hand, tile);
    const canMinkan = canCallMinkan(hand, tile);
    const chiOptions = seat === next(discardSeat) ? chiOptionsFor(hand, tile) : [];
    if (canRon || canPon || canMinkan || chiOptions.length > 0) {
      eligible.push({ seat, canRon, canPon, canMinkan, chiOptions });
    }
  }
  if (eligible.length === 0) return advance(state, discardSeat, state.riichiFuriten);
  return {
    ...state,
    phase: { kind: "awaiting-claims", window: { discardSeat, discardTile: tile, eligible, responses: [] } },
  };
};

/** ロンを見逃したリーチ者を恒久フリテンにする。 */
const markRiichiFuriten = (state: GameState, window: ClaimWindow): boolean[] => {
  const rf = [...state.riichiFuriten];
  for (const r of window.responses) {
    if (r.choice.kind !== "pass") continue;
    const offer = window.eligible.find((o) => o.seat === r.seat);
    if (offer?.canRon && state.players[r.seat].hand.riichi) rf[r.seat] = true;
  }
  return rf;
};

const applyMeldClaim = (
  state: GameState,
  window: ClaimWindow,
  response: ClaimResponse,
  riichiFuriten: readonly boolean[],
): GameState => {
  const seat = response.seat;
  const tile = window.discardTile;
  const discarderHand = removeLastDiscard(state.players[window.discardSeat].hand);
  let hand: Hand;
  let phase: Phase;
  if (response.choice.kind === "chi") {
    hand = callChi(state.players[seat].hand, tile, window.discardSeat, response.choice.tiles);
    phase = { kind: "awaiting-discard", seat };
  } else if (response.choice.kind === "minkan") {
    hand = callMinkan(state.players[seat].hand, tile, window.discardSeat);
    phase = { kind: "awaiting-draw", seat, rinshan: true };
  } else {
    // pon
    hand = callPon(state.players[seat].hand, tile, window.discardSeat);
    phase = { kind: "awaiting-discard", seat };
  }
  const players = state.players.map((p) => {
    if (p.seat === window.discardSeat) return { ...p, hand: discarderHand };
    if (p.seat === seat) return { ...p, hand };
    return p;
  });
  return { ...state, players, riichiFuriten, phase };
};

const resolveClaims = (state: GameState, window: ClaimWindow): GameState => {
  const riichiFuriten = markRiichiFuriten(state, window);
  const rons = window.responses.filter((r) => r.choice.kind === "ron");
  if (rons.length > 0) {
    const dist = (s: Seat) => (s - window.discardSeat + 4) % 4;
    const winnerSeat = rons.reduce((best, r) => (dist(r.seat) < dist(best.seat) ? r : best)).seat;
    return applyWin(state, winnerSeat, false, window.discardTile);
  }
  const meld = window.responses.find((r) => r.choice.kind === "pon" || r.choice.kind === "minkan");
  if (meld) return applyMeldClaim(state, window, meld, riichiFuriten);
  const chi = window.responses.find((r) => r.choice.kind === "chi");
  if (chi) return applyMeldClaim(state, window, chi, riichiFuriten);
  return advance(state, window.discardSeat, riichiFuriten);
};

// --- アクション処理 ---

const doDraw = (state: GameState): GameState => {
  if (state.phase.kind !== "awaiting-draw") return state;
  const { seat, rinshan } = state.phase;
  if (state.players[seat].hand.drawn !== null) return state;
  const res = rinshan ? drawRinshan(state.wall) : drawFromWall(state.wall);
  const hand = drawTile(state.players[seat].hand, res.tile);
  return { ...state, wall: res.wall, players: setPlayerHand(state.players, seat, hand), phase: { kind: "awaiting-discard", seat } };
};

const doDiscard = (
  state: GameState,
  action: Extract<GameAction, { type: "discard" }>,
): GameState => {
  if (state.phase.kind !== "awaiting-discard" || state.phase.seat !== action.seat) return state;
  const seat = action.seat;
  const la = legalActions(state, seat);
  if (!la.discards.includes(action.tile)) return state;
  const wantRiichi = action.riichi === true;
  if (wantRiichi && !la.riichiDiscards.includes(action.tile)) return state;

  const hand = discardTileFromHand(state.players[seat].hand, action.tile, { riichi: wantRiichi });
  let players = setPlayerHand(state.players, seat, hand);
  let riichiSticks = state.riichiSticks;
  if (wantRiichi) {
    players = players.map((p) => (p.seat === seat ? { ...p, points: p.points - 1000 } : p));
    riichiSticks += 1;
  }
  const next0 = { ...state, players, riichiSticks, lastDiscard: { seat, tile: action.tile } };
  return openClaimWindow(next0, seat, action.tile);
};

const doSelfKan = (
  state: GameState,
  action: Extract<GameAction, { type: "ankan" | "kakan" }>,
): GameState => {
  if (state.phase.kind !== "awaiting-discard" || state.phase.seat !== action.seat) return state;
  const seat = action.seat;
  const la = legalActions(state, seat);
  const allowed = action.type === "ankan" ? la.ankanTiles : la.kakanTiles;
  if (!allowed.includes(action.tile)) return state;
  const hand = action.type === "ankan"
    ? callAnkan(state.players[seat].hand, action.tile)
    : callKakan(state.players[seat].hand, action.tile);
  return { ...state, players: setPlayerHand(state.players, seat, hand), phase: { kind: "awaiting-draw", seat, rinshan: true } };
};

const doTsumo = (state: GameState, action: Extract<GameAction, { type: "tsumo" }>): GameState => {
  if (state.phase.kind !== "awaiting-discard" || state.phase.seat !== action.seat) return state;
  if (!legalActions(state, action.seat).canTsumo) return state;
  const winningTile = state.players[action.seat].hand.drawn;
  if (winningTile === null) return state;
  return applyWin(state, action.seat, true, winningTile);
};

const offeredChoice = (
  offer: ClaimOffer,
  action: Extract<GameAction, { type: "pon" | "chi" | "minkan" | "ron" | "pass" }>,
): ClaimChoice | null => {
  switch (action.type) {
    case "pass": return { kind: "pass" };
    case "ron": return offer.canRon ? { kind: "ron" } : null;
    case "pon": return offer.canPon ? { kind: "pon" } : null;
    case "minkan": return offer.canMinkan ? { kind: "minkan" } : null;
    case "chi": {
      const pair = sortTiles(action.tiles).join(",");
      const ok = offer.chiOptions.some((o) => sortTiles(o).join(",") === pair);
      return ok ? { kind: "chi", tiles: sortTiles(action.tiles) as [Tile, Tile] } : null;
    }
  }
};

const doClaim = (
  state: GameState,
  action: Extract<GameAction, { type: "pon" | "chi" | "minkan" | "ron" | "pass" }>,
): GameState => {
  if (state.phase.kind !== "awaiting-claims") return state;
  const window = state.phase.window;
  const offer = window.eligible.find((o) => o.seat === action.seat);
  if (!offer || window.responses.some((r) => r.seat === action.seat)) return state;
  const choice = offeredChoice(offer, action);
  if (choice === null) return state;
  const responses = [...window.responses, { seat: action.seat, choice }];
  const newWindow: ClaimWindow = { ...window, responses };
  if (responses.length < window.eligible.length) {
    return { ...state, phase: { kind: "awaiting-claims", window: newWindow } };
  }
  return resolveClaims(state, newWindow);
};

// --- reducer ---

export const reducer = (state: GameState, action: GameAction): GameState => {
  if (action.type === "init") return createInitialState(action.seed, { dealer: action.dealer });
  if (state.phase.kind === "ended") return state;
  if (action.type === "pause") return state.paused ? state : { ...state, paused: true };
  if (action.type === "resume") return state.paused ? { ...state, paused: false } : state;
  if (state.paused) return state;

  switch (action.type) {
    case "draw": return doDraw(state);
    case "discard": return doDiscard(state, action);
    case "ankan":
    case "kakan": return doSelfKan(state, action);
    case "tsumo": return doTsumo(state, action);
    case "pon":
    case "chi":
    case "minkan":
    case "ron":
    case "pass": return doClaim(state, action);
  }
};

/** アクションが現在の状態に対して有効か（state を変えるか）。UI/テスト補助。 */
export const validate = (state: GameState, action: GameAction): boolean =>
  reducer(state, action) !== state;
