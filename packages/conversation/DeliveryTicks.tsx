import type { ReactElement } from "react";
import type { MessageState } from "@openwork/store";
import { HStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { copy } from "./copy.ts";

// One tick: saved on this device. Two neutral ticks: the server has it. Two red ticks: it could not be delivered.
export function DeliveryTicks({ state }: { state: MessageState }): ReactElement {
  if (state === "failed") {
    return (
      <Tooltip content={copy.notDelivered}>
        <HStack as="span" tabIndex={0} aria-label={copy.notDelivered}><Icon icon="checkDouble" size="xsm" color="error" label={copy.notDelivered} /></HStack>
      </Tooltip>
    );
  }
  return state === "sending"
    ? <Icon icon="check" size="xsm" color="inherit" label={copy.saved} />
    : <Icon icon="checkDouble" size="xsm" color="inherit" label={copy.received} />;
}
