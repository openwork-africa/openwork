import type { ReactElement } from "react";
import { Avatar as AxAvatar } from "@astryxdesign/core/Avatar";
import { HStack } from "@astryxdesign/core/Stack";
import { identiconOf } from "./identicon.ts";

/** Astryx's named avatar sizes (20, 24, 36, 48 and 128px), and 96px for the picture at the top of a panel: the only sizes the app uses. */
export type AvatarSize = "xsm" | "sm" | "md" | "lg" | "xl" | 96;

/**
 * Anyone's avatar: their picture, else a drawing hashed from their name (identicon.ts). `selected` marks it as the current one with the
 * app's inset accent ring. With `onClick` it's a button named by `label`, otherwise it's
 * decoration beside a name. `art` is drawn instead (the AI's sprite). `status` sits in the corner (Astryx's status slot).
 */
export function Avatar(
  { name, imageUrl, size = "lg", shape = "circle", selected = false, label, onClick, art, status, ring = false }: {
    id?: string;
    name: string;
    imageUrl?: string;
    size?: AvatarSize;
    shape?: "circle" | "rounded";
    selected?: boolean;
    label?: string;
    onClick?: () => void;
    /** Drawn instead of the picture and initials. */
    art?: ReactElement;
    /** Corner content: a status dot. */
    status?: ReactElement;
    /** A border around the whole avatar, in place of a status dot. */
    ring?: boolean;
  },
): ReactElement {
  const frame = { className: "avatar-frame", "data-shape": shape, "data-selected": selected || undefined, "data-ring": ring || undefined };
  if (art) {
    const face = <HStack as="span" className="avatar-art" data-size={size} hAlign="center" vAlign="center">{art}</HStack>;
    // A bare button: the drawn face is the whole control, with no button chrome of Astryx's around it.
    return (
      <HStack as="span" {...frame}>
        {onClick ? <button type="button" aria-label={label} onClick={onClick}>{face}</button> : face}
        {status && <HStack as="span" className="avatar-status">{status}</HStack>}
      </HStack>
    );
  }
  return (
    <HStack as="span" {...frame}>
      <AxAvatar name={name} src={imageUrl || identiconOf(name)} size={size} shape={shape} alt={label} tooltip={false} onClick={onClick} status={status} />
    </HStack>
  );
}
