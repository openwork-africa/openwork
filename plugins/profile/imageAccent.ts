/** Extracts a readable accent from a thumbnail of an uploaded image. */
export async function imageAccent(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 64 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const bins = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 220) continue;
      const rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
      const max = Math.max(...rgb), min = Math.min(...rgb);
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (saturation < 0.24 || max < 0.18) continue;
      const key = rgb.reduce((value, channel) => value * 8 + Math.round(channel * 7), 0);
      bins.set(key, (bins.get(key) ?? 0) + 1 + saturation);
    }
    const winner = [...bins].sort((a, b) => b[1] - a[1])[0]?.[0];
    const rgb = winner === undefined ? [0.2, 0.36, 0.5] : [winner >> 6 & 7, winner >> 3 & 7, winner & 7].map((n) => n / 7);
    const adjusted = readable(rgb);
    return `#${adjusted.map((n) => Math.round(n * 255).toString(16).padStart(2, "0")).join("")}`;
  } finally {
    bitmap.close();
  }
}

function readable(rgb: number[]): number[] {
  const contrast = (color: number[]): number => {
    const luminance = color.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return (luminance + 0.05) / 0.05;
  };
  if (contrast(rgb) >= 4.5) return rgb;
  const [h, s, l] = hsl(rgb);
  for (let i = 1; i <= 100; i++) {
    for (const lightness of [l - i / 100, l + i / 100]) {
      const candidate = rgbOf(h, s, Math.max(0, Math.min(1, lightness)));
      if (contrast(candidate) >= 4.5) return candidate;
    }
  }
  return [0.2, 0.36, 0.5];
}

function hsl([r, g, b]: number[]): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
}

function rgbOf(h: number, s: number, l: number): number[] {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const part = Math.floor(h / 60);
  const base = part === 0 ? [c, x, 0] : part === 1 ? [x, c, 0] : part === 2 ? [0, c, x] : part === 3 ? [0, x, c] : part === 4 ? [x, 0, c] : [c, 0, x];
  return base.map((n) => n + m);
}
