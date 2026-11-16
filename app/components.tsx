import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@openwork/ui/css";
import { createElement, type ReactElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Circle } from "@openwork/circle";
import { AddressBar, ConversationComposer, ConversationTrail } from "@openwork/conversation";
import { ContactCover, ContactHeroBody } from "@openwork/plugin-profile";
import { Feedback, ThemeProvider } from "@openwork/ui";
import { bootShell } from "@openwork/shell";
import { devicePorts, ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore, MemoryTransport, useTrail } from "@openwork/store";
import { useCtx } from "@openwork/kit";
import { openPlugins } from "./product.ts";

const clock = new ManualClock(Date.parse("2026-05-14T09:30:00Z"));
const store = new MemoryDeviceStore(clock);
const files = new MemoryFileStore();
const transport = new MemoryTransport();
const room = await store.createRoom("Maya · Orders");
await store.send(room.id, "Hi Maya, the new sizes are ready. I’ve attached the updated order list.");
clock.tick(90_000);
await store.send(room.id, "Great, thanks! Can you include the blue aprons as well?");
clock.tick(120_000);
await store.send(room.id, "Of course. I’ll update the order and confirm the delivery date.");
await store.setRoomDescription(room.id, "Regular customer since 2023. Prefers delivery on weekdays.");
const showcaseRoom = { ...room, description: "Regular customer since 2023. Prefers delivery on weekdays." };

const shell = bootShell({
  plugins: openPlugins,
  ports: { store, files, transport, clock },
  connectivity: manualConnectivity(false),
});

function Standalone({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className="showcase-standalone">
      <shell.product.Root roomId={room.id} navigate={() => {}}>
        <ThemeProvider base="white">{children}</ThemeProvider>
      </shell.product.Root>
    </div>
  );
}

function TrailPiece(): ReactElement {
  const ctx = useCtx();
  const { store: deviceStore } = devicePorts(ctx.ports);
  const trail = useTrail(deviceStore, room.id) ?? [];
  const items = trail.slice(1, 2);
  const onRetry = (messageId: string) => void deviceStore.retry(messageId);
  return <ConversationTrail items={items} ctx={ctx} onRetry={onRetry} />;
}

function Showcase(): ReactElement {
  useEffect(() => () => shell.stop(), []);
  return (
    <main className="showcase">
      <header className="showcase-head">
        <p className="showcase-eyebrow">Openwork · Open source parts</p>
        <h1>Keep the work and the people together.</h1>
        <p>Find a person, pick up the talk, and get on with the work. Each part has its place.</p>
      </header>
      <section className="showcase-components" aria-label="Standalone Openwork components">
        <article className="showcase-item showcase-circle">
          <div className="showcase-copy">
            <h2>Your people, close at hand</h2>
            <p>Find a name. Pick up the thread.</p>
          </div>
          <div className="showcase-art circle-art">
            <Standalone>
              <Circle roomId={room.id} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-address">
          <div className="showcase-copy">
            <h2>Know who is here</h2>
            <p>Keep each chat tied to the person and the work.</p>
          </div>
          <div className="showcase-art address-art">
            <Standalone>
              <AddressBar room={showcaseRoom} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-cover">
          <div className="showcase-copy">
            <h2>Make each chat feel known</h2>
            <p>Set a cover that fits the person.</p>
          </div>
          <div className="showcase-art cover-art">
            <Standalone>
              <ContactCover roomId={room.id} background={showcaseRoom.background} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-trail">
          <div className="showcase-copy">
            <h2>The whole talk, in order</h2>
            <p>Each note stays beside the next.</p>
          </div>
          <div className="showcase-art trail-art">
            <Standalone>
              <TrailPiece />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-hero">
          <div className="showcase-copy">
            <h2>Keep the right things near</h2>
            <p>A name and a short note give each chat its place.</p>
          </div>
          <div className="showcase-art hero-art">
            <Standalone>
              <ContactHeroBody room={showcaseRoom} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-composer">
          <div className="showcase-copy">
            <h2>Words when you need them</h2>
            <p>Write a note and send it when it is ready.</p>
          </div>
          <div className="showcase-art composer-art">
            <Standalone>
              <ConversationComposer roomId={room.id} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-feedback">
          <div className="showcase-copy">
            <h2>See when your work is saved</h2>
            <p>A short note shows when your work is saved.</p>
          </div>
          <div className="showcase-art feedback-art">
            <Feedback
              notices={[{ id: "saved", text: "Changes saved", status: "success" }]}
              onDismiss={() => {}}
            />
          </div>
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById("showcase")!).render(createElement(Showcase));
