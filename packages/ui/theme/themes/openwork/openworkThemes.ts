/**
 * The one built-in theme: Astryx has no light teal-on-warm-white palette, so this is ours. Any other theme is
 * registered by the app that wants it (see ../registry.ts `registerTheme`).
 */
import { defineBrandTheme } from "./brand.ts";

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
