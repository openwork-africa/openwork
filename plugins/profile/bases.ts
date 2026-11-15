import { type Base, BASES } from "@openwork/ui";

const LEADING: readonly Base[] = ["white", "midnight", "nightshade", "ember"];
const LABELS: Partial<Record<Base, string>> = { white: "Worklyn", y2k: "Y2K" };

export const THEMES: readonly Base[] = [...LEADING, ...BASES.filter((base) => !LEADING.includes(base))];

export const baseLabel = (base: Base): string => LABELS[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
