import type { ReactElement } from "react";
import { dismiss, type Product, useCtx, useNotices } from "@openwork/kit";
import { devicePorts, useRoom } from "@openwork/store";
import { type Base, Feedback, isBase, ThemeProvider } from "@openwork/ui";
import type { Regions } from "./Frame.tsx";
import { ShellRoutes } from "./Pages.tsx";
import { roomIdOf } from "./route.ts";
import { RouterContext, type Router, useRoute } from "./router.ts";

function Notices(): ReactElement {
  return <Feedback notices={useNotices()} onDismiss={dismiss} />;
}

/** The base of the open conversation: its background when that names a theme, else none (the device's own applies). */
function useOpenBase(roomId: string | undefined): Base | undefined {
  const { store } = devicePorts(useCtx().ports);
  const background = useRoom(store, roomId ?? "")?.background;
  return isBase(background) ? background : undefined;
}

function Themed({ regions, roomId }: { regions: Regions; roomId: string | undefined }): ReactElement {
  return (
    <ThemeProvider base={useOpenBase(roomId)}>
      <ShellRoutes regions={regions} />
      <Notices />
    </ThemeProvider>
  );
}

function Routed({ product, router, regions }: ShellAppProps): ReactElement {
  const roomId = roomIdOf(useRoute());
  return (
    <product.Root roomId={roomId} navigate={router.navigate}>
      <Themed regions={regions} roomId={roomId} />
    </product.Root>
  );
}

export interface ShellAppProps {
  product: Product;
  router: Router;
  regions: Regions;
}

/** What the app mounts: the composed product with its routes, the theme of the open conversation, and the stack of notices. */
export function ShellApp(props: ShellAppProps): ReactElement {
  return (
    <RouterContext.Provider value={props.router}>
      <Routed {...props} />
    </RouterContext.Provider>
  );
}
