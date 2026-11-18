import type { ReactElement } from "react";
import { installDom } from "@openwork/ui/testing";
import { contribute, definePlugin, type Observable, type Plugin, type Ports, type RowModel } from "@openwork/kit";
import { memoryPorts, rig } from "@openwork/store/testing";
installDom();

import { circleEmpty, circleRowMenu, circleSource, circleTab } from "@openwork/kit";
export { flush, mount } from "@openwork/ui/testing";

/** A source whose rows the test sets by hand; until `set` is called it has said nothing, which is loading. */
export function fakeSource(): {
  observable: Observable<RowModel[]>;
  set(rows: RowModel[]): void;
} {
  const listeners = new Set<(rows: RowModel[]) => void>();
  let latest: RowModel[] | undefined;
  return {
    observable: {
      subscribe(listener) {
        listeners.add(listener);
        if (latest) listener(latest);
        return () => void listeners.delete(listener);
      },
    },
    set(rows) {
      latest = rows;
      listeners.forEach((listener) => listener(rows));
    },
  };
}

export const row = (
  id: string,
  title: string,
  activityAt: number,
  extra: Partial<RowModel> = {},
): RowModel => ({ id, title, activityAt, preview: `about ${title}`, ...extra });

export interface Contributions {
  sources?: { id: string; observable: Observable<RowModel[]> }[];
  tabs?: { id: string; label: string; filter: (row: RowModel) => boolean }[];
  menu?: {
    id: string;
    label: string;
    danger?: boolean;
    run: (row: RowModel) => void;
  }[];
  empty?: { id: string; text: string }[];
}

export function fakePlugin(
  { sources = [], tabs = [], menu = [], empty = [] }: Contributions,
): Plugin {
  return definePlugin({
    id: "fake",
    version: "1.0.0",
    contributes: [
      ...sources.map((source, order) =>
        contribute(circleSource, {
          id: source.id,
          order,
          rows: () => source.observable,
        })
      ),
      ...tabs.map((tab, order) => contribute(circleTab, { ...tab, order })),
      ...menu.map((item, order) =>
        contribute(circleRowMenu, {
          id: item.id,
          order,
          label: item.label,
          icon: null,
          danger: item.danger,
          run: item.run,
        })
      ),
      ...empty.map((item, order) =>
        contribute(circleEmpty, {
          id: item.id,
          order,
          render: () => <p>{item.text}</p>,
        })
      ),
    ],
  });
}

export function host(
  plugins: readonly Plugin[],
  ports: Ports,
  element: ReactElement,
  extra: {
    roomId?: string;
    commands?: Record<string, () => unknown>;
    navigate?: (path: string) => void;
  } = {},
): ReactElement {
  return rig(plugins, { ...memoryPorts(), ...ports }, extra).view(element);
}
