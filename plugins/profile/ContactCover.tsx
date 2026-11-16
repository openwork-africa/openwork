import { type ReactElement, type ReactNode, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { Palette } from "lucide-react";
import { useBase } from "@openwork/ui";
import { useDevicePorts, useFileUrl } from "@openwork/store";
import { BackgroundPicker } from "./BackgroundPicker.tsx";
import { copy } from "./copy.ts";
import { backgroundOf, coverUrlOf } from "./images.ts";

/** The one cover: the chosen theme's picture or an uploaded one, with the button that changes it. */
export function ContactCover({ roomId, background, children }: { roomId: string; background?: string; children?: ReactNode }): ReactElement {
  const theme = useBase();
  const { files } = useDevicePorts();
  const [picking, setPicking] = useState(false);
  const uploaded = useFileUrl(files, background);
  const url = coverUrlOf(background, theme, uploaded);
  return (
    <HStack className="profile-cover contact-cover-top" style={{ backgroundImage: `url(${url})` }}>
      {children}
      <Button label={copy.changeBackground} variant="secondary" size="sm" icon={<Icon icon={Palette} size="sm" />} onClick={() => setPicking(true)} />
      {picking && <BackgroundPicker roomId={roomId} current={backgroundOf(background, theme)} onClose={() => setPicking(false)} />}
    </HStack>
  );
}
