import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@openwork/ui/css";
import { createElement, type ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Circle } from "@openwork/circle";
import { AddressBar, ConversationComposer, ConversationTrail } from "@openwork/conversation";
import { ContactCover, ContactHeroBody } from "@openwork/plugin-profile";
import { BrandLockup, Feedback, type FeedbackNotice, ThemeProvider } from "@openwork/ui";
import { bootShell } from "@openwork/shell";
import { devicePorts, ManualClock, manualConnectivity, MemoryDeviceStore, MemoryFileStore, MemoryTransport, useTrail } from "@openwork/store";
import { useCtx } from "@openwork/kit";
import { openPlugins } from "./product.ts";

const clock = new ManualClock(Date.parse("2026-05-14T09:30:00Z"));
const store = new MemoryDeviceStore(clock);
const files = new MemoryFileStore();
const transport = new MemoryTransport();
const room = await store.createRoom("Maya");
await store.send(room.id, "The order is ready.");
await store.setRoomDescription(room.id, "Weekday delivery.");
const showcaseRoom = { ...room, description: "Weekday delivery." };

const shell = bootShell({
  plugins: openPlugins,
  ports: { store, files, transport, clock },
  connectivity: manualConnectivity(false),
});

function Standalone({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className="showcase-standalone">
      <shell.product.Root roomId={room.id} navigate={() => {}}>
        <ThemeProvider base="white" accent="#245a43">{children}</ThemeProvider>
      </shell.product.Root>
    </div>
  );
}

function TrailPiece(): ReactElement {
  const ctx = useCtx();
  const { store: deviceStore } = devicePorts(ctx.ports);
  const trail = useTrail(deviceStore, room.id) ?? [];
  const items = trail.slice(0, 1);
  const onRetry = (messageId: string) => void deviceStore.retry(messageId);
  return <ConversationTrail items={items} ctx={ctx} onRetry={onRetry} />;
}

function Showcase(): ReactElement {
  const [notices, setNotices] = useState<FeedbackNotice[]>([
    { id: "saved", text: "Message saved", status: "success" },
    { id: "changed", text: "Room name changed", status: "success" },
  ]);
  const shownNotices = notices.map((notice) =>
    notice.id === "changed" && notice.text === "Room name changed"
      ? {
        ...notice,
        action: {
          label: "Undo",
          run: () => setNotices((current) => current.map((item) => item.id === "changed" ? { ...item, text: "Room name restored" } : item)),
        },
      }
      : notice
  );
  useEffect(() => () => shell.stop(), []);
  return (
    <main className="showcase">
      <section className="showcase-components" aria-label="Standalone Openwork components">
        <article className="showcase-item showcase-circle">
          <div className="showcase-copy">
            <h2>Circle</h2>
            <p>Meet the people behind the work</p>
          </div>
          <div className="showcase-art circle-art">
            <Standalone>
              <Circle roomId={room.id} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-cover">
          <div className="showcase-copy">
          <h2>aesthetically pleasing</h2>
            <p>Give every conversation a place of its own</p>
          </div>
          <div className="showcase-art cover-art">
            <Standalone>
              <ContactCover roomId={room.id} background="matcha" />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-conversation">
          <div className="showcase-copy">
            <h2>Notes to self</h2>
            <p>Write to yourself and keep each note with the work</p>
          </div>
          <div className="showcase-art conversation-art">
            <Standalone>
              <div className="conversation-stack">
                <AddressBar room={showcaseRoom} />
                <TrailPiece />
              </div>
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-hero">
          <div className="showcase-copy">
            <h2>Keep the useful things near</h2>
            <p>Keep a name and a useful note close</p>
          </div>
          <div className="showcase-art hero-art">
            <Standalone>
              <ContactHeroBody room={showcaseRoom} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-composer">
          <div className="showcase-copy">
            <h2>Send a message</h2>
            <p>Put a thought into words and send it</p>
          </div>
          <div className="showcase-art composer-art">
            <Standalone>
              <ConversationComposer roomId={room.id} />
            </Standalone>
          </div>
        </article>
        <article className="showcase-item showcase-feedback">
          <div className="showcase-copy">
            <h2>See what has changed</h2>
            <p>See what changed, then undo it if needed</p>
          </div>
          <div className="showcase-art feedback-art">
            <Feedback
              notices={shownNotices}
              onDismiss={(id) => setNotices((current) => current.filter((notice) => notice.id !== id))}
            />
          </div>
        </article>
        <article className="showcase-item showcase-sovereignty">
          <div className="showcase-copy">
            <h2>A road to digital sovereignty</h2>
            <p>The end of big tech.</p>
          </div>
        </article>
        <article className="showcase-item showcase-brand">
          <BrandLockup />
          <p>Where intentional work gets done.</p>
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById("showcase")!).render(createElement(Showcase));
