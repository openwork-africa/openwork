import type { ReactElement } from "react";
import { useCtx } from "@openwork/kit";
import { useRoom } from "@openwork/store";
import { ContactCover } from "./ContactCover.tsx";
import { ContactHeroBody } from "./ContactHero.tsx";
import { usePorts } from "./usePorts.ts";

function useShownRoom() {
  const { roomId } = useCtx();
  const { store } = usePorts();
  const room = useRoom(store, roomId ?? "");
  return room && !room.deleted ? room : null;
}

export function ProfileCover(): ReactElement | null {
  const room = useShownRoom();
  return room && <ContactCover roomId={room.id} background={room.background} />;
}

export function ProfileSection(): ReactElement | null {
  const room = useShownRoom();
  return room && <ContactHeroBody room={room} />;
}
