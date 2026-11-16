import { type ReactElement, useMemo, useState } from "react";
import { addressAction, addressAddressee, type Addressee, type AddresseeValue, type Placed, type SlotContext, useCtx, useSlot } from "@openwork/kit";
import type { Room } from "@openwork/store";
import { Avatar } from "@openwork/ui";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Typeahead } from "@astryxdesign/core/Typeahead";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";
import { copy } from "./copy.ts";

type Suggestion = SearchableItem<{ description?: string }>;

const suggestionOf = (pick: Addressee): Suggestion => ({ id: pick.id, label: pick.label, auxiliaryData: { description: pick.description } });

function renderSuggestion(item: Suggestion): ReactElement {
  return (
    <HStack gap={2} vAlign="center">
      <Avatar name={item.label} size="sm" />
      <VStack>
        <Text type="label" as="div">{item.label}</Text>
        {item.auxiliaryData?.description && <Text type="supporting" as="div">{item.auxiliaryData.description}</Text>}
      </VStack>
    </HStack>
  );
}

/** Looks for someone in every `address.addressee` contribution; the pick is added by the one that offered it. */
function AddSomeone({ providers, ctx }: { providers: readonly (AddresseeValue & Placed)[]; ctx: SlotContext }): ReactElement {
  const [offered] = useState(() => new Map<string, AddresseeValue>());
  const source = useMemo(() => {
    const itemsFor = async (typed: string): Promise<Suggestion[]> => {
      const answers = await Promise.all(providers.map(async (provider) => ({ provider, found: await provider.suggest(typed, ctx) })));
      return answers.flatMap(({ provider, found }) => found.map((pick) => (offered.set(pick.id, provider), suggestionOf(pick))));
    };
    return { search: itemsFor, bootstrap: () => itemsFor("") };
  }, [providers, ctx, offered]);
  return (
    <Typeahead<Suggestion>
      label={copy.searchAddressee}
      isLabelHidden
      placeholder={copy.addSomeone}
      size="sm"
      width="100%"
      hasClear={false}
      hasAutoFocus
      hasEntriesOnFocus
      searchSource={source}
      value={null}
      onChange={(item) => item && void offered.get(item.id)?.add({ id: item.id, label: item.label, description: item.auxiliaryData?.description }, ctx)}
      renderItem={renderSuggestion}
    />
  );
}

/**
 * The room's name and the `address.action` buttons. When `address.addressee`
 * has contributions the name opens an editing bar to add someone; with none, the name is plain text and there is no picker.
 */
export function AddressBar({ room }: { room: Room }): ReactElement {
  const ctx = useCtx();
  const [isEditing, setEditing] = useState(false);
  const actions = useSlot(addressAction, ctx);
  const addressees = useSlot(addressAddressee, ctx);
  const canAdd = addressees.length > 0;
  const mode = isEditing && canAdd ? "edit" : "preview";

  return (
    <VStack width="100%" className="address-field">
      <Card variant="muted" padding={1} className="enter" key={mode}>
        <HStack gap={1} vAlign="center" wrap={mode === "preview" ? "nowrap" : "wrap"}>
          {mode === "edit"
            ? (
              <>
                <IconButton
                  label={copy.back}
                  tooltip={copy.back}
                  icon={<Icon icon="chevronLeft" />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                />
                <StackItem size="fill">
                  <AddSomeone providers={addressees} ctx={ctx} />
                </StackItem>
              </>
            )
            : (
              <>
                <StackItem size="fill">
                  {canAdd
                    ? <Button label={room.name} variant="ghost" tooltip={copy.editAddress} onClick={() => setEditing(true)} />
                    : (
                      <HStack paddingInline={3} paddingBlock={1.5}>
                        <Text type="label" weight="semibold" maxLines={1}>{room.name}</Text>
                      </HStack>
                    )}
                </StackItem>
                {actions.map((action) => (
                  <IconButton
                    key={action.id}
                    label={action.label}
                    tooltip={action.label}
                    icon={action.icon}
                    variant="ghost"
                    size="sm"
                    onClick={() => action.run(ctx)}
                  />
                ))}
              </>
            )}
        </HStack>
      </Card>
    </VStack>
  );
}
