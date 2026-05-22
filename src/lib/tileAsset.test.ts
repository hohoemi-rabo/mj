import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_TILES } from "@/lib/mahjong/tiles";
import { TILE_BACK_PATH, TILE_BASE_PATH, tileImagePath } from "@/lib/tileAsset";

const publicPath = (webPath: string): string =>
  join(process.cwd(), "public", webPath.replace(/^\//, ""));

describe("tileImagePath", () => {
  it("全34種で /tiles/<tile>.svg を返す", () => {
    for (const t of ALL_TILES) {
      expect(tileImagePath(t)).toBe(`${TILE_BASE_PATH}/${t}.svg`);
    }
  });
  it("裏面パス", () => {
    expect(TILE_BACK_PATH).toBe("/tiles/back.svg");
  });
});

describe("素材ファイルの実在（完了条件）", () => {
  it("34種＋裏面＝35ファイルが public/tiles に存在", () => {
    const paths = [...ALL_TILES.map(tileImagePath), TILE_BACK_PATH];
    expect(paths).toHaveLength(35);
    for (const p of paths) {
      expect(existsSync(publicPath(p)), `missing ${p}`).toBe(true);
    }
  });

  it("各SVGが仕様の viewBox 0 0 60 80 を持つ", () => {
    for (const p of [...ALL_TILES.map(tileImagePath), TILE_BACK_PATH]) {
      const svg = readFileSync(publicPath(p), "utf8");
      expect(svg, `bad viewBox in ${p}`).toContain('viewBox="0 0 60 80"');
      expect(svg.startsWith("<svg"), `not an svg: ${p}`).toBe(true);
    }
  });
});
