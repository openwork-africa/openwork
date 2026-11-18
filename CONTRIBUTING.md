# Contributing to Openwork

Openwork is a **frame** (`packages/*`) plus **plugins** (`plugins/*`). A plugin contributes data (a label, an icon, an order, a handler) to a named slot, and
the frame draws it. The frame owns the design; a plugin only fills it in.

## Rules

### Code

- Function components only. Full camelCase names. No dead code. Very few comments. Files under 300 lines.
- Astryx only: no raw `<div>` or `<span>` for layout, no hex colours, no `px` values. Use components and tokens (`var(--color-*)`, `var(--spacing-*)`,
  `var(--radius-*)`). Run `npx @astryxdesign/cli component <Name>` before using a component you have not used.
- **Lift, don't redesign.** Keep the Astryx components, props, class names and copy of the code you move.
- User-facing copy lives in one `copy.ts` per package.
- Every package has its own `deno.json` with `name`, `version` and `exports`. Names are `@openwork/<name>`; plugins are `@openwork/plugin-<id>`.

### Dependency direction

- `kit` and `ui` depend on nothing in this repo. `store` depends on `kit`. `shell` and the window depend on `kit`, `ui` and `store`. Plugins depend on the
  frame and on libraries.
- `packages/*` never import `plugins/*` or `app/`.
- A plugin never imports another plugin. It may import another plugin's `slots.ts` or `services.ts` only, and only when it declares that plugin in `requires`.
- Nothing in this repo imports a closed or hosted product.

### Tests

- `deno test` beside the code (`*.test.ts`, `*.test.tsx`). Mostly integration: a host with real plugins and in-memory ports. Assert structure (role, label,
  order of items in a slot) and data. Never pixels.
- Run `deno task test`, `deno task lint`, `deno task check` and `deno task fitness` before you push. All must pass.

### Fitness

`tools/fitness.test.ts` fails CI when a rule above is broken: dependency direction, cross-plugin imports, file length, raw `<div>`/`<span>`, hex and `px`
values, and package manifests.

## Review checklist

Every pull request is reviewed against these seven points:

1. **Naming** of files, folders and code.
2. **Markup** of each slot host matches the code it was lifted from.
3. **No cross-plugin reach**: nothing imported from another plugin except its `slots.ts` or `services.ts`, and only with `requires`.
4. **Copy** is unchanged unless the pull request says so.
5. **Tests at the seam**: the host with real plugins, asserting structure and data.
6. **Fitness** is green.
7. **Removability**: taking a plugin out of the composition file is the whole uninstall, and the rest still boots.
