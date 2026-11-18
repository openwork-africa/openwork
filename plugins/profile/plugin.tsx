import { contribute, definePlugin } from "@openwork/kit";
import { panelCover, panelSection } from "@openwork/plugin-panel/slots";
import { ProfileCover, ProfileSection } from "./ProfileSection.tsx";

/** The contact panel's first part: the cover above the scroll, then the picture, the name and the description of the room. */
export const profilePlugin = definePlugin({
  id: "profile",
  version: "0.1.0",
  requires: { panel: "^0.1" },
  contributes: [
    contribute(panelCover, { id: "profile", order: 10, render: () => <ProfileCover /> }),
    contribute(panelSection, { id: "profile", order: 10, render: () => <ProfileSection /> }),
  ],
});
