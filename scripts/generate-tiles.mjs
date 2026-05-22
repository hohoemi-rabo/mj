// 麻雀牌のSVG素材を生成する（REQUIREMENTS §5.5 / docs/10）。
// 様式: 数字つき伝統柄。伝統図柄（萬=漢数字+萬 / 筒=丸 / 索=竹）に左上へスーツ色の
// アラビア数字バッジを添える。字牌は大きな漢字。シニア向けに高コントラスト・大きめ。
// 出力: public/tiles/{m1..m9,p1..p9,s1..s9,z1..z7,back}.svg（35ファイル）。
// 実行: node scripts/generate-tiles.mjs（npm run gen:tiles）。

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "tiles");

const BG = "#FBF7EC";
const BORDER = "#333";
const INK = "#1a1a1a";
const FONT = "'BIZ UDPGothic','Hiragino Sans','Yu Gothic','Noto Sans CJK JP',sans-serif";

const SUIT_COLOR = { m: "#c0202a", p: "#1565c0", s: "#2e7d32" };
const PIN_HOLE = BG;
const PIN_STROKE = "#0d3b66";
const SOU_STROKE = "#1b5e20";

const KANJI_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONOR = {
  z1: { char: "東", color: INK },
  z2: { char: "南", color: INK },
  z3: { char: "西", color: INK },
  z4: { char: "北", color: INK },
  z5: { char: "白", color: "#1565c0" },
  z6: { char: "發", color: "#1b8a3e" },
  z7: { char: "中", color: "#c0202a" },
};

// count(1-9) → 図柄の配置 [cx, cy, r]
const LAYOUTS = {
  1: [[30, 44, 11]],
  2: [[30, 30, 8], [30, 58, 8]],
  3: [[17, 28, 7.5], [30, 44, 7.5], [43, 60, 7.5]],
  4: [[20, 30, 8], [40, 30, 8], [20, 58, 8], [40, 58, 8]],
  5: [[20, 28, 7.5], [40, 28, 7.5], [30, 44, 7.5], [20, 60, 7.5], [40, 60, 7.5]],
  6: [[20, 28, 7.5], [40, 28, 7.5], [20, 44, 7.5], [40, 44, 7.5], [20, 60, 7.5], [40, 60, 7.5]],
  7: [[16, 24, 6.5], [30, 24, 6.5], [44, 24, 6.5], [21, 45, 7], [39, 45, 7], [21, 62, 7], [39, 62, 7]],
  8: [[20, 24, 6.5], [40, 24, 6.5], [20, 37, 6.5], [40, 37, 6.5], [20, 50, 6.5], [40, 50, 6.5], [20, 63, 6.5], [40, 63, 6.5]],
  9: [[16, 28, 6.5], [30, 28, 6.5], [44, 28, 6.5], [16, 46, 6.5], [30, 46, 6.5], [44, 46, 6.5], [16, 64, 6.5], [30, 64, 6.5], [44, 64, 6.5]],
};

const r1 = (n) => Number(n.toFixed(1));

const frame = (bg = BG) =>
  `<rect x="1" y="1" width="58" height="78" rx="6" ry="6" fill="${bg}" stroke="${BORDER}" stroke-width="2"/>`;

const numberBadge = (n, color) =>
  `<text x="10" y="18" font-family="${FONT}" font-size="15" font-weight="700" fill="${color}" text-anchor="middle">${n}</text>`;

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80">${inner}</svg>\n`;

const pinDot = ([cx, cy, r]) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SUIT_COLOR.p}" stroke="${PIN_STROKE}" stroke-width="1.2"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.42)}" fill="${PIN_HOLE}"/>`;

const bamboo = ([cx, cy, r]) => {
  const w = r1(r * 1.0);
  const h = r1(r * 2.2);
  const x = r1(cx - w / 2);
  const y = r1(cy - h / 2);
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r1(w / 2)}" fill="${SUIT_COLOR.s}" stroke="${SOU_STROKE}" stroke-width="1"/>` +
    `<line x1="${x}" y1="${r1(cy - h / 6)}" x2="${r1(x + w)}" y2="${r1(cy - h / 6)}" stroke="${SOU_STROKE}" stroke-width="1"/>` +
    `<line x1="${x}" y1="${r1(cy + h / 6)}" x2="${r1(x + w)}" y2="${r1(cy + h / 6)}" stroke="${SOU_STROKE}" stroke-width="1"/>`
  );
};

const manTile = (n) =>
  svg(
    frame() +
      `<text x="32" y="42" font-family="${FONT}" font-size="30" font-weight="700" fill="${INK}" text-anchor="middle">${KANJI_NUM[n]}</text>` +
      `<text x="32" y="71" font-family="${FONT}" font-size="24" font-weight="700" fill="${SUIT_COLOR.m}" text-anchor="middle">萬</text>` +
      numberBadge(n, SUIT_COLOR.m),
  );

const pinTile = (n) =>
  svg(frame() + LAYOUTS[n].map(pinDot).join("") + numberBadge(n, SUIT_COLOR.p));

const souTile = (n) =>
  svg(frame() + LAYOUTS[n].map(bamboo).join("") + numberBadge(n, SUIT_COLOR.s));

const honorTile = (id) => {
  const { char, color } = HONOR[id];
  return svg(
    frame() +
      `<text x="30" y="55" font-family="${FONT}" font-size="40" font-weight="700" fill="${color}" text-anchor="middle">${char}</text>`,
  );
};

const backTile = () =>
  svg(
    `<rect x="1" y="1" width="58" height="78" rx="6" ry="6" fill="#234a63" stroke="${BORDER}" stroke-width="2"/>` +
      `<rect x="6" y="6" width="48" height="68" rx="4" ry="4" fill="none" stroke="#cfe0ec" stroke-width="1.5"/>` +
      `<rect x="20" y="30" width="20" height="20" rx="2" transform="rotate(45 30 40)" fill="none" stroke="#cfe0ec" stroke-width="2"/>` +
      `<circle cx="30" cy="40" r="3" fill="#cfe0ec"/>`,
  );

const files = {};
for (let n = 1; n <= 9; n++) {
  files[`m${n}`] = manTile(n);
  files[`p${n}`] = pinTile(n);
  files[`s${n}`] = souTile(n);
}
for (let z = 1; z <= 7; z++) files[`z${z}`] = honorTile(`z${z}`);
files.back = backTile();

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, `${name}.svg`), content, "utf8");
  count++;
}
console.log(`generated ${count} tiles → ${OUT_DIR}`);
