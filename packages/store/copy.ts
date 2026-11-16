export const copy = {
  syncFailed: "Could not sync your changes. Please try again.",
  offline: "You're offline. Your changes are saved on this device and will go through when you're back.",
  offlineNow: "No connection right now.",
  serverRefused: (status: number) => `The server answered ${status}.`,
  noRoom: (id: string) => `There is no room ${id} on this device.`,
  missingPorts: "The product was composed without the device ports.",
} as const;
