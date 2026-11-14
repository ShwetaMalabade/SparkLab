// src/three/lab/textures.ts: canvas-drawn textures for the lab (signs, periodic table poster, whiteboard).
// Drawn in the browser, so nothing is downloaded (offline-safe). Cached per key.
import { CanvasTexture, SRGBColorSpace } from "three";

const cache = new Map<string, CanvasTexture>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** A room sign: big title, optional small line under it. */
export function signTexture(title: string, sub: string, accent: string) {
  return make(`sign:${title}:${sub}:${accent}`, 1024, 256, (g) => {
    g.fillStyle = "#1b2440";
    g.beginPath();
    g.roundRect(8, 8, 1008, 240, 40);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = accent;
    g.stroke();
    g.fillStyle = "#F8FAFC";
    g.font = "bold 104px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(title, 512, sub ? 106 : 128);
    if (sub) {
      g.fillStyle = accent;
      g.font = "600 52px system-ui, sans-serif";
      g.fillText(sub, 512, 198);
    }
  });
}

const PT: [string, number, number, string][] = [
  // [symbol, period(row 0-based), group(col 0-based), family colour]
  ["H", 0, 0, "#93C5FD"], ["He", 0, 17, "#C4B5FD"],
  ["Li", 1, 0, "#FCA5A5"], ["Be", 1, 1, "#FDBA74"], ["B", 1, 12, "#86EFAC"], ["C", 1, 13, "#93C5FD"], ["N", 1, 14, "#93C5FD"], ["O", 1, 15, "#93C5FD"], ["F", 1, 16, "#FDE68A"], ["Ne", 1, 17, "#C4B5FD"],
  ["Na", 2, 0, "#FCA5A5"], ["Mg", 2, 1, "#FDBA74"], ["Al", 2, 12, "#D1D5DB"], ["Si", 2, 13, "#86EFAC"], ["P", 2, 14, "#93C5FD"], ["S", 2, 15, "#93C5FD"], ["Cl", 2, 16, "#FDE68A"], ["Ar", 2, 17, "#C4B5FD"],
  ["K", 3, 0, "#FCA5A5"], ["Ca", 3, 1, "#FDBA74"], ["Fe", 3, 7, "#F9A8D4"], ["Cu", 3, 10, "#F9A8D4"], ["Zn", 3, 11, "#F9A8D4"], ["Br", 3, 16, "#FDE68A"], ["Kr", 3, 17, "#C4B5FD"],
  ["Ag", 4, 10, "#F9A8D4"], ["I", 4, 16, "#FDE68A"], ["Ba", 5, 1, "#FDBA74"], ["Pb", 5, 13, "#D1D5DB"],
];

export function periodicTexture() {
  return make("periodic", 1024, 600, (g) => {
    g.fillStyle = "#F8FAFC";
    g.fillRect(0, 0, 1024, 600);
    g.fillStyle = "#1E293B";
    g.font = "bold 46px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("Periodic Table of the Elements", 512, 58);
    const cw = 52, ch = 66, x0 = 44, y0 = 96;
    // Faint empty cells for the full table shape.
    for (let r = 0; r < 6; r++)
      for (let col = 0; col < 18; col++) {
        const real = r === 0 ? col === 0 || col === 17 : r < 3 ? col < 2 || col > 11 : true;
        if (!real) continue;
        g.fillStyle = "#E2E8F0";
        g.fillRect(x0 + col * (cw + 2), y0 + r * (ch + 2), cw, ch);
      }
    g.font = "bold 26px system-ui, sans-serif";
    for (const [sym, r, col, color] of PT) {
      g.fillStyle = color;
      g.fillRect(x0 + col * (cw + 2), y0 + r * (ch + 2), cw, ch);
      g.fillStyle = "#0F172A";
      g.fillText(sym, x0 + col * (cw + 2) + cw / 2, y0 + r * (ch + 2) + ch / 2 + 9);
    }
  });
}

export function whiteboardTexture(lines: string[]) {
  return make(`wb:${lines.join("|")}`, 1024, 512, (g) => {
    g.fillStyle = "#FDFDFD";
    g.fillRect(0, 0, 1024, 512);
    g.textAlign = "left";
    lines.forEach((l, i) => {
      g.fillStyle = i === 0 ? "#1D4ED8" : "#334155";
      g.font = `${i === 0 ? "bold 64px" : "48px"} "Comic Sans MS", system-ui, sans-serif`;
      g.fillText(l, 56, 100 + i * 96);
    });
  });
}

/** A simple poster: coloured header band + a few lines. */
export function posterTexture(title: string, lines: string[], band: string) {
  return make(`poster:${title}`, 512, 700, (g) => {
    g.fillStyle = "#FFFBEB";
    g.fillRect(0, 0, 512, 700);
    g.fillStyle = band;
    g.fillRect(0, 0, 512, 150);
    g.fillStyle = "#FFFFFF";
    g.font = "bold 54px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(title, 256, 96);
    g.fillStyle = "#1F2937";
    g.font = "38px system-ui, sans-serif";
    lines.forEach((l, i) => g.fillText(l, 256, 240 + i * 80));
  });
}
