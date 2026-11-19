import type { ComponentType, ReactNode } from "react";
import type { SlotContext } from "./context.ts";
import { slot, type SlotKey } from "./keys.ts";

export interface MessageView {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: number;
  kind?: string;
  state?: "sending" | "sent" | "failed";
}

export interface Draft {
  text: string;
  [field: string]: unknown;
}

export interface Addressee {
  id: string;
  label: string;
  description?: string;
}

type Render = (ctx: SlotContext) => ReactNode;

export interface PageValue {
  path: string;
  load: () => Promise<{ default: ComponentType }>;
}

export interface RegionValue {
  region: "circle" | "window" | "panel";
  /** The island's component, loaded when the frame first draws it. */
  load: () => Promise<{ default: ComponentType<{ roomId?: string }> }>;
}

export interface AddresseeValue {
  suggest: (query: string, ctx: SlotContext) => Addressee[] | Promise<Addressee[]>;
  add: (pick: Addressee, ctx: SlotContext) => void | Promise<void>;
}

export interface ActionValue {
  label: string;
  icon: ReactNode;
  run: (ctx: SlotContext) => void;
}

export interface AddMenuValue {
  label: string;
  description?: string;
  icon: ReactNode;
  opens?: string;
  run?: (ctx: SlotContext) => void;
}

/** A notice drawn just above the composer: what it says and the one thing it offers to do. */
export interface ComposerNoticeValue {
  label: string;
  description?: string;
  actionLabel: string;
  onAction: (ctx: SlotContext) => void;
  icon?: ReactNode;
}

export interface TrayValue {
  render: (ctx: SlotContext, close: () => void) => ReactNode;
}

export interface ComposerActionValue extends ActionValue {
  placement: "start" | "end";
}

export interface BeforeSendValue {
  handle: (draft: Draft, ctx: SlotContext, next: (draft: Draft) => Promise<Draft | null>) => Promise<Draft | null>;
}

export interface TrailBodyValue {
  kind: string;
  matches: (message: MessageView) => boolean;
  render: (message: MessageView, ctx: SlotContext) => ReactNode;
  /** A system line, drawn centered with its time and no bubble, menu or ticks (a member joining, a transcript mark). */
  systemLine?: true;
}

export interface TrailExtraValue {
  render: (message: MessageView, ctx: SlotContext) => ReactNode;
}

export interface TrailActionValue {
  label: string;
  icon: ReactNode;
  appliesTo?: (message: MessageView) => boolean;
  run: (message: MessageView, ctx: SlotContext) => void;
}

export interface RenderValue {
  render: Render;
}

export const shellPage: SlotKey<PageValue> = slot("shell.page");
export const shellRegion: SlotKey<RegionValue> = slot("shell.region");
export const addressAddressee: SlotKey<AddresseeValue> = slot("address.addressee");
export const addressAction: SlotKey<ActionValue> = slot("address.action");
export const composerAddMenu: SlotKey<AddMenuValue> = slot("composer.addMenu");
export const composerNotice: SlotKey<ComposerNoticeValue> = slot("composer.notice");
export const composerTray: SlotKey<TrayValue> = slot("composer.tray");
export const composerAction: SlotKey<ComposerActionValue> = slot("composer.action");
export const composerBeforeSend: SlotKey<BeforeSendValue> = slot("composer.beforeSend");
export const trailBody: SlotKey<TrailBodyValue> = slot("trail.body");
export const trailExtra: SlotKey<TrailExtraValue> = slot("trail.extra");
export const trailAction: SlotKey<TrailActionValue> = slot("trail.action");
export const windowEmpty: SlotKey<RenderValue> = slot("window.empty");
export const windowBanner: SlotKey<RenderValue> = slot("window.banner");

export const frameSlots: readonly SlotKey<unknown>[] = [
  shellPage,
  shellRegion,
  addressAddressee,
  addressAction,
  composerAddMenu,
  composerNotice,
  composerTray,
  composerAction,
  composerBeforeSend,
  trailBody,
  trailExtra,
  trailAction,
  windowEmpty,
  windowBanner,
];

export const frameSlotIds: ReadonlySet<string> = new Set(frameSlots.map((key) => key.id));
