import type { ReactNode } from "react";
import { type RenderValue, slot, type SlotContext, type SlotKey } from "@openwork/kit";

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

/** The slots the conversation list opens: where its rows come from, its filter tabs, each row's menu and its empty state. */
export const circleSource: SlotKey<SourceValue> = slot("circle.source");
export const circleTab: SlotKey<TabFilterValue> = slot("circle.tab");
export const circleRowMenu: SlotKey<RowMenuValue> = slot("circle.rowMenu");
export const circleEmpty: SlotKey<RenderValue> = slot("circle.empty");
