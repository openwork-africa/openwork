import type { ComponentType, ReactNode } from "react";
import type { SlotContext } from "./context.ts";
import { type SlotKey, slot } from "./keys.ts";

export interface Observable<T> {
  subscribe(listener: (value: T) => void): () => void;
}

export interface RowModel {
  id: string;
  title: string;
  preview?: string;
  activityAt: number;
  unread?: number;
  picture?: string;
}

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
  preload?: () => void;
}

export interface RailValue {
  icon: ReactNode;
  label: string;
  href: string;
  badge?: ReactNode;
}

export interface ShortcutValue {
  keys: string;
  label: string;
  run: (ctx: SlotContext) => void;
}

export interface SourceValue {
  rows: (ctx: SlotContext) => Observable<RowModel[]>;
}

export interface TabFilterValue {
  label: string;
  filter: (row: RowModel) => boolean;
}

export interface RowMenuValue {
  label: string;
  icon: ReactNode;
  run: (row: RowModel, ctx: SlotContext) => void;
  danger?: boolean;
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

export interface PanelTabValue {
  value: string;
  label: string;
  icon: ReactNode;
  render: Render;
}

export interface SettingsRowValue {
  label: string;
  render: Render;
}

export const shellPage: SlotKey<PageValue> = slot("shell.page");
export const shellRail: SlotKey<RailValue> = slot("shell.rail");
export const shellShortcut: SlotKey<ShortcutValue> = slot("shell.shortcut");
export const shellOverlay: SlotKey<RenderValue> = slot("shell.overlay");
export const circleSource: SlotKey<SourceValue> = slot("circle.source");
export const circleTab: SlotKey<TabFilterValue> = slot("circle.tab");
export const circleRowMenu: SlotKey<RowMenuValue> = slot("circle.rowMenu");
export const circleEmpty: SlotKey<RenderValue> = slot("circle.empty");
export const addressAddressee: SlotKey<AddresseeValue> = slot("address.addressee");
export const addressAction: SlotKey<ActionValue> = slot("address.action");
export const composerAddMenu: SlotKey<AddMenuValue> = slot("composer.addMenu");
export const composerTray: SlotKey<TrayValue> = slot("composer.tray");
export const composerAction: SlotKey<ComposerActionValue> = slot("composer.action");
export const composerBeforeSend: SlotKey<BeforeSendValue> = slot("composer.beforeSend");
export const trailBody: SlotKey<TrailBodyValue> = slot("trail.body");
export const trailExtra: SlotKey<TrailExtraValue> = slot("trail.extra");
export const trailAction: SlotKey<TrailActionValue> = slot("trail.action");
export const windowEmpty: SlotKey<RenderValue> = slot("window.empty");
export const windowBanner: SlotKey<RenderValue> = slot("window.banner");
export const panelTab: SlotKey<PanelTabValue> = slot("panel.tab");
export const panelSection: SlotKey<RenderValue> = slot("panel.section");
export const settingsRow: SlotKey<SettingsRowValue> = slot("settings.row");

export const frameSlots: readonly SlotKey<unknown>[] = [
  shellPage,
  shellRail,
  shellShortcut,
  shellOverlay,
  circleSource,
  circleTab,
  circleRowMenu,
  circleEmpty,
  addressAddressee,
  addressAction,
  composerAddMenu,
  composerTray,
  composerAction,
  composerBeforeSend,
  trailBody,
  trailExtra,
  trailAction,
  windowEmpty,
  windowBanner,
  panelTab,
  panelSection,
  settingsRow,
];

export const frameSlotIds: ReadonlySet<string> = new Set(frameSlots.map((key) => key.id));
