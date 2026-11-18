export const copy = {
  operatorDescription: "Operator",
  createOperator: (typed: string): string => `Create operator “${typed}”`,
  createOperatorDescription: "A new AI for this room",
} as const;
