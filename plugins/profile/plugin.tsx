import { contribute, definePlugin, panelSection } from "@openwork/kit";
import { ProfileSection } from "./ProfileSection.tsx";

/** The contact panel's first section: the cover, the picture, the name and the description of the room. */
export const profilePlugin = definePlugin({
  id: "profile",
  version: "0.1.0",
  contributes: [contribute(panelSection, { id: "profile", order: 10, render: () => <ProfileSection /> })],
});
