/**
 * Openwork brand foundations, shared by every Openwork theme. Typography, shape and motion live here once;
 * a theme only states its colours. The neutral icon set is reused by every theme.
 */
import { type DefinedTheme, defineTheme } from "@astryxdesign/core/theme";
import { neutralIconRegistry } from "../neutral/icons.tsx";

const SANS_FALLBACKS = '"Work Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const brandFoundations = {
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: "Worklyn Sans", fallbacks: SANS_FALLBACKS },
    heading: { family: "Worklyn Sans", fallbacks: SANS_FALLBACKS, weights: { 3: "bold", 4: "bold" } },
    code: { family: "SF Mono", fallbacks: '"Fira Code", ui-monospace, monospace' },
  },
  radius: { base: 6, multiplier: 1 },
  motion: { fast: 150, medium: 320, ratio: 0.75 },
  icons: neutralIconRegistry,
} as const;

/**
 * App-wide shape decisions, as theme tokens. Chat surfaces (the composer, its drawer, message bubbles) read
 * `--radius-chat`, which Astryx derives as base × 7 — a pill at our base. We want the standard rounded square
 * every other control has, so it follows `--radius-element`. Change it here and every chat component follows.
 */
export const appTokens = { "--radius-chat": "var(--radius-element)" } as const;

/**
 * App-wide decisions about Astryx's own parts, made the way Astryx offers (a theme's `components`), never in a stylesheet.
 * The chat's scroll-to-bottom button keeps its place above the composer even while it is hidden: a control's height and a
 * step under it. Raised by most of its height it rests over the foot of the messages, where the list keeps clear space,
 * and the room it holds above the composer is halved.
 */
export const appComponents = {
  "chat-layout-scroll-button": { base: { marginBlockStart: "calc(var(--spacing-5) * -1)" } },
  // A message's filled bubble, as the conversation design draws it (Paper, "Conversation · messages"): close around its
  // words (a step above and below, three at the sides) and only slightly rounded. Its corners are the same small radius
  // the bubbles of one run close up to, so a run reads as one column of bubbles.
  "chat-message-bubble": {
    "variant:filled": { paddingBlock: "var(--spacing-2)", paddingInline: "var(--spacing-3)", borderRadius: "var(--radius-inner)" },
    // What you sent is the theme's primary colour shaded a little towards its text, with the page colour as the words (chat.css), so it reads in light and dark.
    "variant:filled+sender:user": {
      backgroundColor: "color-mix(in srgb, var(--color-accent) 82%, var(--color-text-primary))",
      color: "var(--color-background-surface)",
    },
  },
  // Astryx wraps tooltip text onto multiple lines up to its 300px default; ours stay a single line,
  // truncated with an ellipsis once a tip runs past this width rather than wrapping.
  "tooltip": { base: { whiteSpace: "nowrap", maxWidth: "calc(var(--spacing-12) * 16)", overflow: "hidden", textOverflow: "ellipsis" } },
} as const;

/**
 * The app's proportions, taken from the design ("Patient castle" in Paper, 1684px wide). Every wide surface is a
 * share of the screen, so it grows with it; each has a floor, in 48px steps (one tile), so a narrow screen never
 * squashes it. Controls — tiles, avatars, buttons — are not here: they stay one size at any width.
 * css/rail.css derives the rail from spacing tokens, so no width is typed there either.
 */
const DESIGN = { width: 1684, list: 387, panel: 448, boardColumn: 300, boardAdd: 220, dayo: 680 } as const;

/** `px` as the design's share of the screen, never below `steps` tiles. */
const grows = (px: number, steps: number) => `max(calc(var(--spacing-12) * ${steps}), calc(100vw * ${(px / DESIGN.width).toFixed(4)}))`;

/**
 * A reply (the quote and the bubble under it) is one set width, on your side and on theirs: a share of the thread's
 * column (360 of its 800, as the design has it), never below `floorTiles` tiles, and never wider than the room there is,
 * so on a phone it follows the screen. A message that quotes nothing keeps its own width.
 */
export const REPLY_WIDTH = { share: 0.45, floorTiles: 6 } as const;
const TILE_PX = 48;
/** The width a reply is drawn at, in pixels, for a thread column of `threadPx` with `roomPx` free for the message.
 * It restates the --shell-reply-width formula below only so a test can check the rule; the CSS is what draws it. */
export const replyWidthPx = (threadPx: number, roomPx: number): number =>
  Math.min(roomPx, Math.max(TILE_PX * REPLY_WIDTH.floorTiles, threadPx * REPLY_WIDTH.share));

export const shellTokens = {
  "--shell-list-width": grows(DESIGN.list, 6),
  "--shell-panel-width": grows(DESIGN.panel, 7),
  "--shell-board-column-width": grows(DESIGN.boardColumn, 5),
  "--shell-board-add-width": grows(DESIGN.boardAdd, 4),
  "--shell-dayo-width": `min(92vw, ${grows(DESIGN.dayo, 9)})`,
  // The column a conversation's messages and composer keep: Astryx's spacious chat layout caps it here, and the address bar follows.
  "--shell-thread-width": "50rem",
  // What a message shows that is not words (a photo, a voice note): one width for all of them.
  "--shell-media-width": "calc(var(--spacing-12) * 5)",
  // A reply's set width (REPLY_WIDTH, replyWidthPx): the quote and its bubble both take it.
  "--shell-reply-width": `min(100%, max(calc(var(--spacing-12) * ${REPLY_WIDTH.floorTiles}), calc(var(--shell-thread-width) * ${REPLY_WIDTH.share})))`,
} as const;

/** Any theme, with the app-wide decisions above; it keeps everything else the theme says. */
/**
 * Secondary text as a share of the theme's own primary text over its page colour. Some Astryx themes ship a
 * secondary colour below the 4.5:1 a reader needs on their own surfaces; this keeps their hue and makes it legible,
 * in light and in dark.
 */
export const legibleSecondaryText = (primaryShare: number) => ({
  "--color-text-secondary": `color-mix(in srgb, var(--color-text-primary) ${primaryShare}%, var(--color-background-body))`,
});

export const withAppTokens = (theme: DefinedTheme, tokens: Record<string, string> = {}): DefinedTheme =>
  defineTheme({ name: theme.name, extends: theme, tokens: { ...appTokens, ...tokens }, localTokens: shellTokens, components: appComponents });

type Surfaces = {
  body: string;
  surface: string;
  card: string;
  popover: string;
  muted: string;
  border: string;
  borderEmphasized: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
};

/** The four accent colours an Openwork theme states exactly (Astryx would derive them, but our brand colours are fixed). */
export type Accent = { accent: string; onAccent: string; muted: string; text: string };

export function defineBrandTheme(
  name: string,
  accent: Accent,
  s: Surfaces,
  extra: Record<string, string> = {},
) {
  return defineTheme({
    name,
    ...brandFoundations,
    color: { neutralStyle: "neutral" },
    localTokens: shellTokens,
    components: appComponents,
    tokens: {
      ...appTokens,
      "--color-accent": accent.accent,
      "--color-on-accent": accent.onAccent,
      "--color-accent-muted": accent.muted,
      "--color-text-accent": accent.text,
      "--color-icon-accent": accent.text,
      "--color-background-body": s.body,
      "--color-background-surface": s.surface,
      "--color-background-card": s.card,
      "--color-background-popover": s.popover,
      "--color-background-muted": s.muted,
      "--color-border": s.border,
      "--color-border-emphasized": s.borderEmphasized,
      "--color-text-primary": s.textPrimary,
      "--color-text-secondary": s.textSecondary,
      "--color-text-disabled": s.textDisabled,
      ...extra,
    },
  });
}

/** Dark surfaces stepped up from one canvas colour, the way the app always has. */
export const raise = (canvas: string, pct: number) => `color-mix(in srgb, ${canvas} ${100 - pct}%, white)`;
