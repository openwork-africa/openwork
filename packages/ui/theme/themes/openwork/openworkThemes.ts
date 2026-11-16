/**
 * The four Openwork themes. Astryx has no light teal-on-warm-white, pure black, purple or orange dark palette,
 * so these are ours; every other theme is an Astryx one (see ../registry.ts).
 */
import { type Accent, defineBrandTheme, raise } from "./brand.ts";

export const whiteTheme = defineBrandTheme("white", { accent: "#1397c1", onAccent: "#001f29", muted: "#bee9ff", text: "#004d65" }, {
  body: "#f8f7f5",
  surface: "#ffffff",
  card: "#f4f4f4",
  popover: "#ffffff",
  muted: "#eaeaea",
  border: "#c0c0c0",
  borderEmphasized: "#707070",
  textPrimary: "#000000",
  textSecondary: "#404040",
  textDisabled: "#8a8a8a",
});

function darkTheme(name: string, canvas: string, accent: Accent, secondary: string, border: string, outline: string) {
  return defineBrandTheme(name, accent, {
    body: canvas,
    surface: raise(canvas, 5),
    card: raise(canvas, 9),
    popover: raise(canvas, 9),
    muted: raise(canvas, 9),
    border,
    borderEmphasized: outline,
    textPrimary: "#dfe3e7",
    textSecondary: secondary,
    textDisabled: raise(canvas, 40),
  });
}

export const midnightTheme = darkTheme(
  "midnight",
  "#000000",
  { accent: "#ffffff", onAccent: "#000000", muted: "#004d65", text: "#bee9ff" },
  "#c0c8cd",
  "#40484c",
  "#8a9297",
);
export const nightshadeTheme = darkTheme(
  "nightshade",
  "#180b29",
  { accent: "#c084fc", onAccent: "#180b29", muted: "#4c1d95", text: "#ede9fe" },
  "#d6d0e4",
  "#403458",
  "#968caa",
);
export const emberTheme = darkTheme(
  "ember",
  "#210f07",
  { accent: "#fb923c", onAccent: "#210f07", muted: "#78350f", text: "#fef3c7" },
  "#cdc0b2",
  "#543e2c",
  "#a08e7c",
);
