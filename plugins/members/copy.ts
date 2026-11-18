export const copy = {
  assistantName: "Assistant",
  assistantDescription: "Your AI in this room",
  personDescription: "Add to this room",
  joined: (name: string): string => `${name} joined`,
} as const;
