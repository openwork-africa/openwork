// The picture for anything without one: a square drawing hashed from its name, so the same name always draws the same
// picture and a new name draws a new one. Each is one of five African motifs (kente cloth, Ndebele wall painting, a
// savanna sunset, bògòlanfini mudcloth, adire indigo), solid colour to every edge so it fills the avatar's circle.
// The colours are the drawing's own, not the theme's: the picture is an <img>, where tokens don't resolve.

const SIZE = 64;

// Cloth and earth: ochre, terracotta, kente gold, indigo, forest, crimson, teal, plum, sunset orange.
const BRIGHT = ["#e0a526", "#c4532d", "#f2b705", "#1f3a93", "#1e7b4a", "#b5262e", "#1f8a8a", "#6b2d6b", "#f07b2b"];
const INK = "#1b1b1b";
const CREAM = "#f4e4c1";

/** FNV-1a: the name's 32-bit hash. */
export function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: every choice a drawing makes, in order, from its name's hash. */
function picker(seed: number) {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  // Distinct colours, so no two neighbouring parts of a drawing are the same.
  const colours = (count: number): string[] => {
    const left = [...BRIGHT];
    return Array.from({ length: count }, () => left.splice(int(0, left.length - 1), 1)[0]);
  };
  return { int, colours };
}

type Pick = ReturnType<typeof picker>;

const rect = (x: number, y: number, w: number, h: number, fill: string): string => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/** Kente: woven bands, every other one a run of blocks, with thin dark threads between them. */
function kente(p: Pick): string {
  const [base, a, b, c] = p.colours(4);
  const rows = p.int(4, 6);
  const height = SIZE / rows;
  const blocks = p.int(3, 5);
  let out = rect(0, 0, SIZE, SIZE, base);
  for (let row = 0; row < rows; row++) {
    const y = row * height;
    if (row % 2 === 1) {
      const width = SIZE / blocks;
      for (let i = 0; i < blocks; i++) out += rect(i * width, y, width, height, i % 2 ? a : b);
      out += rect(0, y + height / 2 - 1, SIZE, 2, c);
    } else {
      out += rect(0, y + height / 2 - 1.5, SIZE, 3, a);
    }
    out += rect(0, y, SIZE, 1.2, INK);
  }
  return out;
}

/** Ndebele: a two-colour wall under bold chevrons and a diamond, each colour fenced in thick black. */
function ndebele(p: Pick): string {
  const [left, right, a, b] = p.colours(4);
  const top = p.int(6, 14);
  let out = rect(0, 0, SIZE, SIZE, left) + rect(SIZE / 2, 0, SIZE / 2, SIZE, right);
  for (let i = 0; i < 3; i++) {
    const y = top + i * 18;
    const points = `-4,${y} 32,${y + 14} 68,${y}`;
    out += `<polyline points="${points}" fill="none" stroke="${INK}" stroke-width="9"/>`;
    out += `<polyline points="${points}" fill="none" stroke="${i % 2 ? a : CREAM}" stroke-width="4.5"/>`;
  }
  const r = p.int(9, 13);
  out += `<polygon points="32,${32 - r} ${32 + r},32 32,${32 + r} ${32 - r},32" fill="${b}" stroke="${INK}" stroke-width="3"/>`;
  return out;
}

/** A savanna sunset: a big sun over the hills and a flat-topped acacia against it. */
function savanna(p: Pick): string {
  const [sky, hill, far] = p.colours(3);
  const sunX = p.int(22, 42);
  const sunY = p.int(20, 30);
  const sunR = p.int(10, 14);
  const ridge = p.int(38, 44);
  const treeX = p.int(0, 1) ? p.int(14, 20) : p.int(44, 50);
  let out = rect(0, 0, SIZE, SIZE, sky);
  out += `<circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${CREAM}"/>`;
  out += `<path d="M0 ${ridge} Q20 ${ridge - 8} 40 ${ridge - 2} T64 ${ridge - 4} V64 H0Z" fill="${far}"/>`;
  out += `<path d="M0 ${ridge + 10} Q24 ${ridge + 2} 64 ${ridge + 8} V64 H0Z" fill="${hill}"/>`;
  // The acacia: a trunk forking into a wide flat crown.
  out += `<path d="M${treeX - 1.5} ${ridge + 8} L${treeX - 1} ${ridge - 6} L${treeX - 6} ${ridge - 12} L${treeX - 4.5} ${ridge - 13} L${treeX} ${ridge - 8} L${
    treeX + 5
  } ${ridge - 13} L${treeX + 6.5} ${ridge - 12} L${treeX + 1} ${ridge - 6} L${treeX + 1.5} ${ridge + 8}Z" fill="${INK}"/>`;
  out += `<ellipse cx="${treeX}" cy="${ridge - 15}" rx="${p.int(11, 14)}" ry="3.5" fill="${INK}"/>`;
  return out;
}

/** Bògòlanfini: rows of cream zigzags, dots and crosses painted on dark mud-dyed cloth. */
function mudcloth(p: Pick): string {
  const [ground] = p.colours(1);
  // The bright ground under a dark wash: mud-dyed, still with its colour.
  let out = rect(0, 0, SIZE, SIZE, ground) + rect(0, 0, SIZE, SIZE, `${INK}99`);
  const rows = 5;
  const height = SIZE / rows;
  const stroke = `fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  for (let row = 0; row < rows; row++) {
    const mid = row * height + height / 2;
    const motif = p.int(0, 2);
    if (motif === 0) {
      const points = Array.from({ length: 9 }, (_, i) => `${i * 8},${mid + (i % 2 ? -3.5 : 3.5)}`).join(" ");
      out += `<polyline points="${points}" ${stroke}/>`;
    } else if (motif === 1) {
      for (let x = 4; x < SIZE; x += 8) out += `<circle cx="${x}" cy="${mid}" r="1.8" fill="${CREAM}"/>`;
    } else {
      for (let x = 6; x < SIZE; x += 12) out += `<path d="M${x - 3} ${mid}H${x + 3}M${x} ${mid - 3}V${mid + 3}" ${stroke}/>`;
    }
  }
  return out;
}

/** Adire: indigo-dyed cloth tied into rings, four to a square. */
function adire(p: Pick): string {
  const [ink] = p.colours(1);
  const ground = p.int(0, 1) ? "#1f3a93" : "#16264f";
  let out = rect(0, 0, SIZE, SIZE, ground);
  for (const cx of [16, 48]) {
    for (const cy of [16, 48]) {
      out += `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${CREAM}" stroke-width="2.5"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="3" fill="${CREAM}"/>`;
    }
  }
  out += `<path d="M32 0V64M0 32H64" stroke="${CREAM}" stroke-width="1.2" stroke-dasharray="2 3"/>`;
  return out;
}

const MOTIFS = [kente, ndebele, savanna, mudcloth, adire];

/** The drawing for a name, as SVG markup. Names that differ only in case or surrounding space draw the same. */
export function identiconSvg(name: string): string {
  const hash = hashOf(name.trim().toLowerCase());
  const motif = MOTIFS[hash % MOTIFS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="geometricPrecision">${motif(picker(hash))}</svg>`;
}

const drawn = new Map<string, string>();

/** The drawing for a name as an image URL, for an avatar's `src`. Drawn once per name. */
export function identiconOf(name: string): string {
  let url = drawn.get(name);
  if (url === undefined) {
    url = `data:image/svg+xml;utf8,${encodeURIComponent(identiconSvg(name))}`;
    drawn.set(name, url);
  }
  return url;
}
