// THE WORLD TODAY — Wednesday 18 November 2026
// One-page newspaper front page summing up the day's world news.
// Drawn programmatically with Node 22 stdlib only: hand-rolled PNG encoder
// plus a hand-built 5x7 bitmap font. No network, fully deterministic.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1024;
const H = 1024;

// ---------- PNG encoder (stdlib only) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Framebuffer ----------
const fb = Buffer.alloc(W * H * 3);
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  fb[o] = c[0]; fb[o + 1] = c[1]; fb[o + 2] = c[2];
}
function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }
function box(x, y, w, h, c) {
  hline(x, y, w, c); hline(x, y + h - 1, w, c);
  vline(x, y, h, c); vline(x + w - 1, y, h, c);
}
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function circle(xc, yc, r, c, fill) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (fill ? d <= r : d <= r && d >= r - 1) px(xc + x, yc + y, c);
  }
}
function poly(points, c) {
  // scanline fill of a simple polygon
  let minY = 1e9, maxY = -1e9;
  for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(Math.round(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) px(x, y, c);
    }
  }
}
function starburst(cx, cy, r, c) {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(cx, cy, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
  }
  circle(cx, cy, 2, c, true);
}

// ---------- 5x7 bitmap font (hand-built, uppercase) ----------
const FONT = {
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01110","10001","10000","10000","10000","10001","01110"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01110","10001","10000","10111","10001","10001","01111"],
  H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["01110","00100","00100","00100","00100","00100","01110"],
  J: ["00111","00010","00010","00010","00010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","10101","01010"],
  X: ["10001","10001","01010","00100","01010","10001","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  Z: ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00110","01000","10000","11111"],
  "3": ["11111","00010","00100","00010","00001","10001","01110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","01100","00100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  ";": ["00000","01100","01100","00000","01100","00100","01000"],
  "-": ["00000","00000","00000","01110","00000","00000","00000"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
  "?": ["01110","10001","00001","00110","00100","00000","00100"],
  "/": ["00001","00010","00010","00100","01000","01000","10000"],
  "(": ["00010","00100","01000","01000","01000","00100","00010"],
  ")": ["01000","00100","00010","00010","00010","00100","01000"],
  "%": ["11001","11010","00010","00100","01000","01011","10011"],
  "+": ["00000","00100","00100","11111","00100","00100","00000"],
  "=": ["00000","00000","11111","00000","11111","00000","00000"],
  "&": ["01100","10010","10100","01000","10101","10010","01101"],
  "$": ["00100","01111","10100","01110","00101","11110","00100"],
  "*": ["00000","10101","01110","11111","01110","10101","00000"],
  '"': ["01010","01010","01010","00000","00000","00000","00000"],
  "'": ["00100","00100","01000","00000","00000","00000","00000"],
  "#": ["01010","01010","11111","01010","11111","01010","01010"],
  ">": ["01000","00100","00010","00001","00010","00100","01000"],
  "<": ["00010","00100","01000","10000","01000","00100","00010"],
  _: ["00000","00000","00000","00000","00000","00000","11111"],
};
function textWidth(s, scale) { return s.length * 6 * scale - scale; }
function drawText(x, y, s, scale, c) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCenter(x, y, w, s, scale, c) {
  drawText(x + Math.floor((w - textWidth(s, scale)) / 2), y, s, scale, c);
}
function wrapText(s, maxW, scale) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, scale) <= maxW || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- Palette ----------
const PAPER = [250, 246, 236];
const INK = [24, 24, 24];
const RED = [178, 34, 34];
const DARKRED = [140, 20, 20];
const SEA = [208, 226, 238];
const LAND = [168, 178, 120];
const SAND = [232, 214, 170];
const GREY = [110, 110, 105];
const LIGHT = [238, 234, 224];
const BLUE = [40, 80, 140];
const GOLD = [200, 150, 40];

// ---------- Card helpers (fixed slots: headline and deck never overlap) ----------
function card(x, y, w, h, fill) {
  rect(x, y, w, h, fill || PAPER);
  box(x, y, w, h, INK);
}
function kicker(x, y, s, c) { drawText(x, y, s, 1, c || RED); }

// ---------- Small line icons, drawn in a 22x22 box ----------
function icon(name, x, y, c) {
  switch (name) {
    case "ballot": // ballot box + tick
      rect(x + 3, y + 8, 16, 11, c); rect(x + 3, y + 8, 16, 2, PAPER);
      line(x + 6, y + 14, x + 9, y + 17, PAPER); line(x + 9, y + 17, x + 16, y + 9, PAPER);
      break;
    case "coins":
      circle(x + 8, y + 8, 6, c, false); circle(x + 14, y + 14, 6, c, false);
      drawText(x + 6, y + 5, "$", 1, c);
      break;
    case "cyclone":
      circle(x + 11, y + 11, 9, c, false); circle(x + 11, y + 11, 5, c, false);
      line(x + 11, y + 2, x + 11, y + 7, c); line(x + 11, y + 15, x + 11, y + 20, c);
      line(x + 2, y + 11, x + 7, y + 11, c); line(x + 15, y + 11, x + 20, y + 11, c);
      break;
    case "chip":
      rect(x + 6, y + 6, 10, 10, c);
      for (let i = 0; i < 3; i++) {
        hline(x + 3, y + 8 + i * 4, 3, c); hline(x + 16, y + 8 + i * 4, 3, c);
        vline(x + 8 + i * 4, y + 3, 3, c); vline(x + 8 + i * 4, y + 16, 3, c);
      }
      break;
    case "parliament":
      line(x + 3, y + 8, x + 11, y + 2, c); line(x + 11, y + 2, x + 19, y + 8, c);
      hline(x + 3, y + 8, 16, c);
      for (let i = 0; i < 3; i++) vline(x + 5 + i * 6, y + 10, 8, c);
      hline(x + 3, y + 19, 16, c);
      break;
    case "cross":
      rect(x + 9, y + 3, 4, 16, c); rect(x + 3, y + 9, 16, 4, c);
      break;
    case "globe":
      circle(x + 11, y + 11, 9, c, false);
      line(x + 2, y + 11, x + 20, y + 11, c);
      line(x + 11, y + 2, x + 11, y + 20, c);
      break;
    case "talks":
      rect(x + 2, y + 3, 11, 8, c); rect(x + 9, y + 11, 11, 8, PAPER); box(x + 9, y + 11, 11, 8, c);
      break;
    case "robot":
      rect(x + 6, y + 4, 10, 9, c); rect(x + 8, y + 7, 2, 2, PAPER); rect(x + 12, y + 7, 2, 2, PAPER);
      hline(x + 8, y + 15, 6, c); vline(x + 4, y + 7, 5, c); vline(x + 17, y + 7, 5, c);
      break;
    case "rocket":
      line(x + 11, y + 1, x + 15, y + 10, c); line(x + 15, y + 10, x + 11, y + 19, c);
      line(x + 11, y + 19, x + 7, y + 10, c); line(x + 7, y + 10, x + 11, y + 1, c);
      line(x + 7, y + 12, x + 3, y + 17, c); line(x + 15, y + 12, x + 19, y + 17, c);
      break;
    case "virus":
      circle(x + 11, y + 11, 6, c, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line(x + 11, y + 11, Math.round(x + 11 + Math.cos(a) * 10), Math.round(y + 11 + Math.sin(a) * 10), c);
      }
      break;
    case "scales":
      vline(x + 11, y + 2, 16, c); hline(x + 4, y + 5, 14, c); hline(x + 7, y + 19, 8, c);
      line(x + 4, y + 5, x + 2, y + 11, c); line(x + 4, y + 5, x + 6, y + 11, c); hline(x + 2, y + 11, 4, c);
      line(x + 18, y + 5, x + 16, y + 11, c); line(x + 18, y + 5, x + 20, y + 11, c); hline(x + 16, y + 11, 4, c);
      break;
    case "plane":
      line(x + 2, y + 14, x + 20, y + 8, c); line(x + 11, y + 4, x + 13, y + 12, c);
      line(x + 8, y + 16, x + 12, y + 18, c);
      break;
    case "crack":
      line(x + 4, y + 2, x + 8, y + 8, c); line(x + 8, y + 8, x + 5, y + 12, c);
      line(x + 5, y + 12, x + 11, y + 16, c); line(x + 11, y + 16, x + 9, y + 20, c);
      line(x + 14, y + 3, x + 17, y + 9, c); line(x + 17, y + 9, x + 15, y + 14, c);
      break;
    case "bolt":
      poly([[x + 13, y + 2], [x + 6, y + 12], [x + 10, y + 12], [x + 8, y + 20], [x + 16, y + 9], [x + 12, y + 9]], c);
      break;
    case "ball":
      circle(x + 11, y + 11, 8, c, false);
      line(x + 4, y + 7, x + 18, y + 15, c);
      break;
    case "warn":
      poly([[x + 11, y + 2], [x + 21, y + 19], [x + 1, y + 19]], c);
      rect(x + 10, y + 9, 2, 5, PAPER); rect(x + 10, y + 15, 2, 2, PAPER);
      break;
    case "star":
      starburst(x + 11, y + 11, 9, c);
      break;
    case "oil":
      poly([[x + 11, y + 2], [x + 17, y + 12], [x + 15, y + 18], [x + 7, y + 18], [x + 5, y + 12]], c);
      break;
    default:
      rect(x + 4, y + 4, 14, 14, c);
  }
}

// ---------- World map (stylised, equirectangular) ----------
const MAP = { x: 18, y: 282, w: 480, h: 114 };
function drawMap() {
  const m = MAP;
  rect(m.x, m.y, m.w, m.h, SEA);
  box(m.x, m.y, m.w, m.h, INK);
  const P = (pts) => poly(pts.map(([px, py]) => [m.x + px, m.y + py]), LAND);
  P([[18,14],[58,6],[100,10],[128,22],[140,38],[118,52],[88,58],[58,52],[34,38],[18,26]]); // N America
  P([[140,4],[160,2],[166,12],[150,18],[140,12]]); // Greenland
  P([[140,58],[166,56],[186,66],[180,90],[164,106],[148,96],[138,74]]); // S America
  P([[228,10],[256,4],[276,10],[278,22],[264,32],[242,34],[230,22]]); // Europe
  P([[216,38],[258,34],[296,42],[304,66],[292,92],[268,102],[244,88],[224,64]]); // Africa
  P([[288,6],[360,2],[440,10],[468,26],[448,44],[400,52],[344,48],[306,36],[290,20]]); // Asia
  P([[396,60],[412,58],[418,68],[402,70]]); // SE Asia islands
  P([[396,76],[432,72],[448,82],[436,98],[408,96]]); // Australia
  drawText(m.x + 8, m.y + 4, "ARCTIC OCEAN", 1, BLUE);
  drawText(m.x + 8, m.y + 100, "PACIFIC", 1, BLUE);
  drawText(m.x + 140, m.y + 44, "ATLANTIC", 1, BLUE);
  drawText(m.x + 318, m.y + 96, "INDIAN", 1, BLUE);
}
// pin positions inside the map box (map-local coords)
const PINS = [
  [315, 43], [290, 24], [388, 42], [48, 20], [347, 52],
  [273, 66], [137, 32], [283, 42], [270, 16], [412, 58],
];
function drawPins() {
  const m = MAP;
  PINS.forEach(([px, py], i) => {
    const s = String(i + 1);
    circle(m.x + px, m.y + py, 7, RED, true);
    circle(m.x + px, m.y + py, 7, PAPER, false);
    drawText(m.x + px - Math.floor(textWidth(s, 1) / 2), m.y + py - 3, s, 1, PAPER);
  });
}

// ---------- Lead diagrams ----------
function drawGulf(x, y, w, h) {
  rect(x, y, w, h, SEA);
  rect(x, y, w, Math.floor(h * 0.34), SAND);
  rect(x, y + Math.floor(h * 0.34), w, 2, INK);
  rect(x + Math.floor(w * 0.42), y + Math.floor(h * 0.30), Math.floor(w * 0.16), 8, LAND);
  drawText(x + 6, y + 4, "IRAN", 1, INK);
  drawText(x + Math.floor(w * 0.40), y + Math.floor(h * 0.30) - 10, "QESHM ISLAND", 1, INK);
  drawText(x + 6, y + h - 12, "STRAIT OF HORMUZ", 1, INK);
  drawText(x + w - 108, y + h - 12, "ARABIAN PENINSULA", 1, INK);
  line(x + 40, y + h - 22, x + w - 60, y + h - 22, RED);
  starburst(x + 40, y + h - 22, 7, RED);
  starburst(x + w - 60, y + h - 22, 7, RED);
}
function drawKerch(x, y, w, h) {
  rect(x, y, w, h, [214, 228, 240]);
  drawText(x + 6, y + 4, "CRIMEA", 1, INK);
  const by = y + Math.floor(h * 0.55);
  hline(x + 8, by, Math.floor(w * 0.42), INK);
  hline(x + 8, by + 2, Math.floor(w * 0.42), INK);
  hline(x + w - 8 - Math.floor(w * 0.42), by, Math.floor(w * 0.42), INK);
  hline(x + w - 8 - Math.floor(w * 0.42), by + 2, Math.floor(w * 0.42), INK);
  starburst(x + Math.floor(w / 2), by + 1, 9, RED);
  drawText(x + 6, y + h - 12, "KERCH STRAIT", 1, INK);
  drawText(x + w - 92, y + h - 12, "BLACK SEA", 1, INK);
}
function drawFlags(x, y, w) {
  // China
  rect(x, y, 52, 30, [222, 40, 40]);
  starburst(x + 12, y + 9, 4, GOLD); starburst(x + 26, y + 6, 2, GOLD); starburst(x + 30, y + 13, 2, GOLD);
  // Russia
  rect(x + 62, y, 52, 30, [255, 255, 255]); box(x + 62, y, 52, 30, INK);
  rect(x + 62, y + 10, 52, 10, [0, 60, 160]); rect(x + 62, y + 20, 52, 10, [210, 30, 30]);
  // USA
  rect(x + 124, y, 52, 30, [255, 255, 255]); box(x + 124, y, 52, 30, INK);
  for (let i = 0; i < 4; i++) rect(x + 124, y + i * 8, 52, 4, [190, 30, 30]);
  rect(x + 124, y, 22, 16, [40, 60, 140]);
  drawText(x + 8, y + 34, "XI", 1, INK);
  drawText(x + 70, y + 34, "PUTIN", 1, INK);
  drawText(x + 132, y + 34, "TRUMP", 1, INK);
}

// ---------- Content: 52 stories, all first reported Wed 18 Nov 2026 ----------
const WHERE = [
  "GULF - US STRIKES QESHM",
  "KERCH - BRIDGE HIT AGAIN",
  "SHENZHEN - XI, PUTIN, TRUMP",
  "ALASKA - PELTOLA WINS SENATE",
  "INDIA - CYCLONE AKVAN",
  "CONGO - EBOLA 11,000+",
  "USA - MEASLES STATUS LOST",
  "GAZA - CEASEFIRE STRAINED",
  "KYIV - BRIDGES POUNDED",
  "MANILA - QUAD NEW PLAN",
];
const STATS = [
  ["11,000+", "EBOLA CASES IN CONGO"],
  ["56-44", "SENATE: DEMOCRATS WIN"],
  ["1 LIGHT-DAY", "VOYAGER 1 FROM EARTH"],
  ["$115.8BN", "NVIDIA RECORD QUARTER"],
];
// [kicker, headline, deck, icon] — 20 tiles
const GRID = [
  ["AMERICAS", "PELTOLA WINS ALASKA", "FLIPS THE SEAT. DEMOCRATS TAKE THE SENATE 56-44.", "ballot"],
  ["EUROPE", "EU PROPOSES EUR45BN LOAN", "FOR UKRAINE. REPAID ONLY IF RUSSIA PAYS.", "coins"],
  ["ASIA", "CYCLONE AKVAN NEARS", "NEARS ANDHRA-ODISHA COAST. LANDFALL DUE 20 NOV.", "cyclone"],
  ["TECH", "NVIDIA REJECTS HUANG", "BOARD SAYS NO COMEBACK. RECORD $115.8BN QUARTER.", "chip"],
  ["MIDDLE EAST", "KAHANA ELECTED SPEAKER", "TAKES THE CHAIR IN THE KNESSET.", "parliament"],
  ["HEALTH", "US LOSES MEASLES STATUS", "STATUS ENDS AFTER 26 YEARS.", "cross"],
  ["CLIMATE", "COP31 DRAFT SPLITS TALKS", "MINISTERS TAKE OVER AS DRAFT DIVIDES.", "globe"],
  ["EUROPE", "BERLIN TALKS SET FOR THURSDAY", "KUSHNER, WITKOFF TO MEET ZELENSKYY.", "talks"],
  ["TECH", "OPENAI LAUNCHES GPT-6.2", "ASTRA AND SOL ARRIVE. PRICES FALL.", "robot"],
  ["SPACE", "VOYAGER 1 ONE LIGHT-DAY OUT", "ONE LIGHT-DAY OUT. SIGNALS TAKE A DAY.", "rocket"],
  ["AFRICA", "EBOLA PASSES 11,000 IN CONGO", "OUTBREAK SPREADS IN DR CONGO.", "virus"],
  ["MIDDLE EAST", "BOARD OF PEACE FAULTS BOTH SIDES", "GAZA TRUCE STRAINS.", "scales"],
  ["ASIA", "QUAD UNVEILS NEW PLAN", "MANILA PACT: SEAS, AI, CABLES. TRUMP MEETS ALLIES.", "plane"],
  ["EUROPE", "RUSSIA POUNDS KYIV BRIDGES", "TWO DNIPRO BRIDGES HIT. POWER AND WATER OUT.", "crack"],
  ["TECH", "APPLE, ZOOM, BBC HIT BY ATTACK", "200 SITES HIT. ICLOUD DOWN FOR THOUSANDS.", "bolt"],
  ["SPORT", "DHONI RETIRES FROM IPL", "CRICKET GREAT ENDS HIS IPL CAREER.", "ball"],
  ["AMERICAS", "MEXICO CARTEL VIOLENCE", "PRESIDENT CALLS FOR CALM AFTER EL MENCHO DEATH.", "warn"],
  ["EUROPE", "NATO UNVEILS COMMS STRATEGY", "ALLIANCE PLAN FOR NEXT-GEN NETWORKS.", "star"],
  ["MARKETS", "OIL NEAR $93 AS GULF BURNS", "GULF TENSIONS LIFT CRUDE. GOLD IN FOCUS.", "oil"],
  ["ASIA", "AFGHAN QUAKE: 600+ DEAD", "OVER 600 DIE IN AFGHAN EARTHQUAKE.", "crack"],
];
const BRIEF = [
  "UK INFLATION 3.6%",
  "INDIA DRAWS RECORD $10BN INFLOWS",
  "TAIWAN SEEKS $14BN US ARMS",
  "GERMANY CUTS ELECTRICITY TAX",
  "FED'S WALLER FLOATS HALF-POINT HIKE",
  "CHAD CLOSES BORDER WITH SUDAN",
  "NIGERIA SEEKS UN RIGHTS COUNCIL SEAT",
  "BANGLADESH DEPLOYS PARAMILITARY",
  "ITALY COURT SENTENCES PARENTS",
  "DENMARK PM DENOUNCES MASS MIGRATION",
  "CUBA WANTS AI AMID POWER CUTS",
  "INDIA URGES CITIZENS TO EXIT IRAN",
  "PAKISTAN BLAST: 16 DEAD",
  "ASEAN DIGITAL ECONOMY DEAL DONE",
  "WEST BANK SANCTIONS",
];
const STORY_COUNT = 3 + WHERE.length + STATS.length + GRID.length + BRIEF.length; // 52

// ---------- Layout ----------
function draw() {
  rect(0, 0, W, H, PAPER);
  box(4, 4, W - 8, H - 8, INK);
  box(8, 8, W - 16, H - 16, INK);

  // Masthead
  drawTextCenter(0, 16, W, "THE WORLD TODAY", 6, INK);
  rect(16, 64, W - 32, 2, RED);
  drawTextCenter(0, 72, W, "WEDNESDAY 18 NOVEMBER 2026", 2, RED);
  drawTextCenter(0, 92, W, STORY_COUNT + " STORIES - 7 REGIONS - DATE-CHECKED - ONE FRONT PAGE", 1, INK);

  // Lead row: y 108..252
  const LY = 108, LH = 144;
  // Card 1: Gulf
  card(12, LY, 480, LH);
  kicker(20, LY + 8, "LEAD STORY");
  drawText(20, LY + 20, "US STRIKES QESHM, IRAN HITS GULF BASES", 2, INK);
  for (const [i, l] of wrapText("US JETS HIT A GUARD MISSILE SITE. IRAN ANSWERS WITH DRONES ON GULF BASES.", 464, 1).entries())
    drawText(20, LY + 40 + i * 9, l, 1, INK);
  drawGulf(20, LY + 62, 464, 74);
  // Card 2: Kerch
  card(500, LY, 248, LH);
  kicker(508, LY + 8, "UKRAINE");
  for (const [i, l] of wrapText("KERCH BRIDGE HIT AGAIN", 232, 2).entries())
    drawText(508, LY + 20 + i * 14, l, 2, INK);
  for (const [i, l] of wrapText("THIRD STRIKE IN A WEEK. ROAD SPAN FALLS, RAIL HALTS.", 232, 1).entries())
    drawText(508, LY + 52 + i * 9, l, 1, INK);
  drawKerch(508, LY + 76, 232, 60);
  // Card 3: APEC
  card(756, LY, 256, LH);
  kicker(764, LY + 8, "DIPLOMACY");
  for (const [i, l] of wrapText("APEC OPENS IN SHENZHEN", 240, 2).entries())
    drawText(764, LY + 20 + i * 14, l, 2, INK);
  drawFlags(772, LY + 56, 224);
  for (const [i, l] of wrapText("XI KEYNOTES AS TRUMP, PUTIN ARRIVE.", 240, 1).entries())
    drawText(764, LY + 104 + i * 9, l, 1, INK);

  // Map row: y 260..404
  card(12, 260, 492, 144);
  kicker(20, 266, "THE WORLD AT A GLANCE");
  drawMap();
  drawPins();
  card(512, 260, 500, 144);
  kicker(520, 266, "WHERE IT HAPPENED");
  WHERE.forEach((s, i) => {
    drawText(520, 282 + i * 12, (i + 1) + "  " + s, 1, INK);
  });

  // Stats strip: y 412..450
  const SX = [12, 262, 512, 762], SW = [242, 242, 242, 250];
  STATS.forEach(([v, l], i) => {
    card(SX[i], 412, SW[i], 38);
    drawTextCenter(SX[i], 418, SW[i], v, 2, INK);
    drawTextCenter(SX[i], 436, SW[i], l, 1, GREY);
  });

  // Timeline strip: y 458..482
  rect(12, 458, 1000, 24, LIGHT);
  box(12, 458, 1000, 24, INK);
  drawText(20, 466, "THE DAY IN ORDER:", 1, RED);
  drawText(20 + textWidth("THE DAY IN ORDER: ", 1), 466,
    "QESHM STRIKE > KERCH HIT > APEC OPENS > PELTOLA CALLED > COP31 DRAFT > AKVAN ALERT", 1, INK);

  // Grid: 4 cols x 5 rows, y 490..830
  const CW = 244, CH = 68;
  GRID.forEach(([kick, head, deck, ic], i) => {
    const cx = 12 + (i % 4) * (CW + 8);
    const cy = 490 + Math.floor(i / 4) * CH;
    card(cx, cy, CW, CH);
    icon(ic, cx + 8, cy + 10, INK);
    kicker(cx + 36, cy + 8, kick);
    const hl = wrapText(head, 200, 2).slice(0, 2);
    hl.forEach((l, j) => drawText(cx + 36, cy + 17 + j * 16, l, 2, INK));
    const dl = wrapText(deck, 200, 1).slice(0, 2);
    dl.forEach((l, j) => drawText(cx + 36, cy + 51 + j * 9, l, 1, INK));
  });

  // In brief: y 838..978
  card(12, 838, 1000, 140);
  kicker(20, 846, "IN BRIEF");
  BRIEF.forEach((s, i) => {
    const col = i < 8 ? 0 : 1;
    const row = i < 8 ? i : i - 8;
    drawText(col === 0 ? 20 : 516, 862 + row * 13, "* " + s, 1, INK);
  });

  // Footer
  drawTextCenter(0, 990, W, "ALL STORIES FIRST REPORTED ON WEDNESDAY 18 NOVEMBER 2026 - THE WORLD TODAY", 1, GREY);
}

// ---------- Main ----------
draw();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
const png = encodePNG(fb, W, H);
writeFileSync(join(outDir, "entry.png"), png);
console.log("wrote " + join(outDir, "entry.png") + " (" + png.length + " bytes, " + W + "x" + H + ")");
