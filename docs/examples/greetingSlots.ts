import { type SlotKey, slot } from "@openwork/kit";

export interface GreetingValue {
  text: string;
}

/** The slot the greeting plugin opens. Other plugins import only this file. */
export const greetingLine: SlotKey<GreetingValue> = slot("greeting.line");
