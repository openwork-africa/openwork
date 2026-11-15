import type { ReactElement } from "react";
import { useCtx } from "@openwork/kit";
import { useRoom } from "@openwork/store";
import { ContactHero } from "./ContactHero.tsx";
import { usePorts } from "./usePorts.ts";

export function ProfileSection(): ReactElement | null {
  const { roomId } = useCtx();
  const { store } = usePorts();
  const room = useRoom(store, roomId ?? "");
  return room && !room.deleted ? <ContactHero room={room} /> : null;
}
