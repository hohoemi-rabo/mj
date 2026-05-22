// 牌 → 画像パスの解決を1箇所に集約する（REQUIREMENTS §5.5 / docs/10）。
// UI は必ずこの関数経由で牌画像を参照し、将来 別素材（例: 麻雀豆腐）へ差し替えるときは
// ここだけ変更すればよい。素材本体は public/tiles/*.svg（scripts/generate-tiles.mjs で生成）。

import type { Tile } from "@/lib/mahjong/tiles";

/** 牌画像の配置ベースパス（public 配下）。 */
export const TILE_BASE_PATH = "/tiles";

/** 牌 → SVG画像パス。 */
export const tileImagePath = (tile: Tile): string => `${TILE_BASE_PATH}/${tile}.svg`;

/** 裏面のSVG画像パス。 */
export const TILE_BACK_PATH = `${TILE_BASE_PATH}/back.svg`;
