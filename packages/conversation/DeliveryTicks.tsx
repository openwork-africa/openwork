import type { ReactElement } from "react";
import type { MessageAnswer, MessageState } from "@openwork/store";
import { HStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { copy } from "./copy.ts";
import { friendlyDeliveryError } from "./deliveryError.ts";

// One tick: saved on this device. Two neutral ticks: the server has it. Two accent ticks: the assistant has taken it.
// Two red ticks: it could not be delivered, or the assistant failed before taking it.
export function DeliveryTicks({ state, reason, answer }: { state: MessageState; reason?: string; answer?: MessageAnswer }): ReactElement {
  const failure = state === "failed" ? reason : typeof answer === "object" ? answer.failed : undefined;
  if (state === "failed" || failure !== undefined) {
    const why = friendlyDeliveryError(failure);
    return (
      <Tooltip content={why}>
        <HStack as="span" tabIndex={0} aria-label={why}>
          <Icon icon="checkDouble" size="xsm" color="error" label={why} />
        </HStack>
      </Tooltip>
    );
  }
  if (answer === "taken") return <Icon icon="checkDouble" size="xsm" color="accent" label={copy.accepted} />;
  return state === "sending"
    ? <Icon icon="check" size="xsm" color="inherit" label={copy.saved} />
    : <Icon icon="checkDouble" size="xsm" color="inherit" label={copy.received} />;
}
