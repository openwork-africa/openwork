export const copy = {
  duplicatePlugin: (id: string) => `Two plugins are both called "${id}". The second one is left out.`,
  missingPlugin: (id: string, needs: string, range: string) => `"${id}" is off: it needs "${needs}" ${range}, which is not installed.`,
  mismatchedPlugin: (id: string, needs: string, range: string, found: string) => `"${id}" is off: it needs "${needs}" ${range}, but ${found} is installed.`,
  circularPlugins: (ids: string) => `These plugins need each other, so they are off: ${ids}.`,
  unknownSlot: (id: string, slot: string) => `"${id}" is off for "${slot}": no plugin opens that slot.`,
  duplicateContribution: (slot: string, id: string, first: string, second: string) =>
    `"${first}" and "${second}" both put "${id}" in "${slot}". The second one is left out.`,
  duplicateService: (service: string, first: string, second: string) => `"${first}" and "${second}" both provide "${service}". The second one is left out.`,
  unknownOverride: (target: string) => `Nothing to override at "${target}".`,
  setupFailed: (id: string) => `"${id}" could not start. Please try again.`,
} as const;
