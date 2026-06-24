"use client";

// 牌1枚のレンダラ（docs/14）。SVG（viewBox 0 0 60 80・3:4）を素の <img> で描画。
// 表示専用にも tap 可能（自手牌）にも使う。faceDown のときは tile を一切描画しない（情報漏洩防止）。

import { type Tile as TileType, tileName } from "@/lib/mahjong/tiles";
import { TILE_BACK_PATH, tileImagePath } from "@/lib/tileAsset";
import { cn } from "@/lib/cn";

export type TileSize = "sm" | "md" | "lg";
export type TileHighlight = "none" | "tenpai-keep" | "riichi" | "wait";

export interface TileProps {
  tile?: TileType; // faceDown 時は不要
  faceDown?: boolean;
  size?: TileSize;
  selectable?: boolean; // tap 可能（合法手）
  disabled?: boolean; // 合法手でない自手牌（薄く）
  highlight?: TileHighlight; // お助け表示
  rotated?: boolean; // リーチ宣言牌（横向き）
  onClick?: () => void;
  ariaLabel?: string; // 既定 tileName(tile)
  className?: string;
}

// 3:4 を厳守。自手牌(lg)は ≥60px でタップ域確保。
const SIZE_CLASSES: Record<TileSize, string> = {
  sm: "w-[30px] h-[40px]",
  md: "w-[45px] h-[60px]",
  lg: "w-[60px] h-[80px]",
};

// 色のみに頼らず ring + 太さで区別（color-not-only）。
const HIGHLIGHT_CLASSES: Record<TileHighlight, string> = {
  none: "",
  "tenpai-keep": "ring-4 ring-blue-500 ring-offset-1",
  riichi: "ring-4 ring-primary ring-offset-1",
  wait: "ring-4 ring-amber-500 ring-offset-1",
};

export function Tile({
  tile,
  faceDown = false,
  size = "md",
  selectable = false,
  disabled = false,
  highlight = "none",
  rotated = false,
  onClick,
  ariaLabel,
  className,
}: TileProps) {
  const src = faceDown ? TILE_BACK_PATH : tile ? tileImagePath(tile) : TILE_BACK_PATH;
  const label = faceDown ? "" : (ariaLabel ?? (tile ? tileName(tile) : ""));

  const img = (
    // 牌は固定寸法の静的SVG。next/image の最適化は不要（むしろ過剰）なので素の img を使う。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      draggable={false}
      className={cn(
        "block select-none rounded-md",
        SIZE_CLASSES[size],
        rotated && "rotate-90",
        disabled && "opacity-50",
        HIGHLIGHT_CLASSES[highlight],
        !selectable && className,
      )}
    />
  );

  if (!selectable) return img;

  // tap 可能なときは 60px タップ域・focus ring・aria-label を持つ <button> でラップ。
  // 牌同士を詰めるため padding は付けない（min-h-tap/min-w-tap で 60px タップ域は確保）。
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-tap min-w-tap items-center justify-center rounded-lg",
        "transition-transform hover:-translate-y-1 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary",
        disabled && "cursor-not-allowed hover:translate-y-0 active:scale-100",
        className,
      )}
    >
      {img}
    </button>
  );
}
