import type { ReactElement } from "react";
import { useCtx } from "@openwork/kit";
import { useDevicePorts, useRoom } from "@openwork/store";
import { ContactCover } from "./ContactCover.tsx";
import { ContactHeroBody } from "./ContactHero.tsx";
import { IslandBody } from "@openwork/ui";

function useShownRoom() {
  const { roomId } = useCtx();
  const { store } = useDevicePorts();
  const room = useRoom(store, roomId ?? "");
  return room === undefined ? undefined : room && !room.deleted ? room : null;
}

export function ProfileCover(): ReactElement | null {
  const room = useShownRoom();
  return room ? <ContactCover roomId={room.id} background={room.background} /> : null;
}

export function ProfileSection(): ReactElement | null {
  const room = useShownRoom();
  return (
    <IslandBody isLoading={room === undefined} isEmpty={!room} loading={null} empty={null}>
      {room && <ContactHeroBody room={room} />}
    </IslandBody>
  );
}
