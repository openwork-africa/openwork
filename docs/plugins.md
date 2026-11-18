# Writing a plugin

A plugin is a plain object made with `definePlugin` from `@openwork/kit`. It does not draw the app. It puts data into the **slots** the frame (or another
plugin) opens, and the frame draws that data.

```ts
export const shout = definePlugin({
  id: "shout", // unique in the product
  version: "0.1.0", // semver
  requires: {}, // other plugins this one builds on, with a version range
  slots: [], // slots this plugin opens for others
  contributes: [], // what it puts into slots
  provides: [], // commands and services it implements
  setup(ctx) {}, // optional: runs once at boot; may return a teardown
});
```

Add it to the list in `app/product.ts` and it is part of the app. Remove it from the list and the app is as it was.

## Slots and `contribute`

A slot is a typed key. The frame declares its slots in `@openwork/kit` (`trailBody`, `trailAction`, `trailExtra`, `composerAction`, `windowEmpty`, `shellPage`,
`shellRegion` and more). The conversation list and the contact panel open their own: `circleSource`, `circleTab`, `circleRowMenu` and `circleEmpty` come from
`@openwork/plugin-circle/slots`, and `panelCover`, `panelSection` and `panelTab` from `@openwork/plugin-panel/slots`. A plugin that fills them lists that plugin in
`requires` (the profile requires the panel; without it the profile is skipped with a notice and the rest boots). The room commands `createRoomCommand` and
`deleteRoomCommand` come from `@openwork/plugin-rooms/services`. To fill one, call `contribute(slot, value)`. Every value carries three
fields of its own beside what the slot asks for:

- `id`: unique inside the slot. A duplicate is a boot error that names both plugins.
- `order`: the host sorts by it, low first. Ties keep the order of the plugin list.
- `when(ctx)`: optional. The item is left out while it returns `false`.

Values may use `ctx`, the slot context: `roomId`, `navigate`, `notify`, `ports`, `commands` and `service(key)`.

### Empty states

A `windowEmpty` contribution draws the card shown in a conversation with nothing said in it. Draw it with `EmptyState` from `@openwork/ui` (`art`, `title`,
`description`, optional `action` and `label`): it is the one empty-state card the app uses everywhere, centred in the window and never scrolling, so a
contribution extends that card instead of laying out its own.

### The conversation list and the contact panel are plugins

The base of the product is the conversation window. The list (`circle`) and the contact panel (`panel`) are plugins that put their island into `shellRegion`
(`shell.region`): `{ region: "circle" | "panel", load }`, where `load` is a dynamic `import()` so the island is its own chunk. The frame draws a pane only when
a plugin fills its region, so with neither the window stands alone. `app/product.ts` lists all five (`rooms`, `text`, `profile`, `circle`, `panel`);
`app/bare.ts` lists `rooms` and `text` only. `deno task test:bundle` builds both and checks the bare bundle holds no circle or panel code.

## Commands and services

`provides` is how a plugin gives something to others. `provideCommand("rooms.create", handler)` makes a command: any slot value can run it as
`ctx.commands["rooms.create"](...args)`; the handler receives the context first. `provide(service("voice"), value)` makes a typed service that others read with
`ctx.service(key)`, which is `undefined` when nobody provides it.

## `requires`

`requires: { greeting: "^1" }` says this plugin builds on the plugin with id `greeting`, in a version range. If it is missing or the version does not match, the
plugin is skipped, an error notice names it and what it needs, and the rest of the app boots. Plugins never import one another, with one exception: a plugin may
import another plugin's `slots.ts` or `services.ts`, and only when it lists that plugin in `requires`.

## A toy plugin

`shout` adds a "Shout" item to every message's menu (`trail.action`). It sends an uppercased copy of the message.

```tsx
import { Icon } from "@astryxdesign/core/Icon";
import { Megaphone } from "lucide-react";
import { contribute, definePlugin, trailAction } from "@openwork/kit";
import { devicePorts } from "@openwork/store";

export const shout = definePlugin({
  id: "shout",
  version: "0.1.0",
  contributes: [
    contribute(trailAction, {
      id: "shout",
      order: 50,
      label: "Shout",
      icon: <Icon icon={Megaphone} />,
      appliesTo: (message) => message.content.trim() !== "",
      run: (message, ctx) => void devicePorts(ctx.ports).store.send(message.roomId, message.content.toUpperCase()),
    }),
  ],
});
```

Put `shout` in the list in `app/product.ts`. The source is `docs/examples/shout.tsx` and its test, which runs the real product with this plugin, is
`docs/examples/examples.test.tsx`.

## A plugin on a plugin

A plugin can open a slot of its own. It makes a typed key, lists it in `slots`, and draws what other plugins put in it. The key lives in a small `slots.ts`, the
only file other plugins may import.

```ts
// slots.ts
export const greetingLine: SlotKey<{ text: string }> = slot("greeting.line");
```

```tsx
// greeting.tsx: opens `greeting.line` and draws it under each message (`trail.extra`)
function Greetings() {
  const lines = useSlot(greetingLine, useCtx());
  return <>{lines.map((line) => <Text key={line.id} type="supporting" as="p">{line.text}</Text>)}</>;
}

export const greeting = definePlugin({
  id: "greeting",
  version: "1.0.0",
  slots: [greetingLine],
  contributes: [contribute(trailExtra, { id: "greetings", order: 50, render: () => <Greetings /> })],
});
```

A second plugin fills the slot, and says it needs the first:

```ts
// polite.tsx
export const polite = definePlugin({
  id: "polite",
  version: "0.1.0",
  requires: { greeting: "^1" },
  contributes: [contribute(greetingLine, { id: "polite", order: 10, text: "Thank you for your message." })],
});
```

With both in the list, each message shows the line. With `greeting` alone the slot is empty and nothing is drawn. With `polite` alone it is skipped with a
notice and the app boots. Sources are in `docs/examples/` (`greeting.tsx`, `slots.ts`, `polite.tsx`) and the tests that prove all three cases are in
`docs/examples/examples.test.tsx`.

## Testing a plugin

Test it in the real frame: compose the product with your plugin on in-memory ports and assert structure and data, not pixels. `app/harness.tsx` does this
(`bootProduct(plugins)`), and `docs/examples/examples.test.tsx` is the model.
