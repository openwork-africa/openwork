import type { ReactElement } from "react";
import { type Product, useCtx, useNotices } from "@openwork/kit";
import { devicePorts, useRoom } from "@openwork/store";
import { type Base, Feedback, isBase, type ThemeEntry, ThemeProvider } from "@openwork/ui";
import type { Regions } from "./Frame.tsx";
import { ShellRoutes } from "./Pages.tsx";
import { roomIdOf } from "./route.ts";
import { type Router, RouterContext, useRoute } from "./router.ts";
import { DrawerContext, type DrawerState } from "./drawer.ts";

function Notices({ product }: { product: Product }): ReactElement {
  return <Feedback notices={useNotices(product.notices)} onDismiss={product.notices.dismiss} />;
}

/** The base of the open conversation: its background when that names a theme, else none (the device's own applies). */
function useOpenBase(roomId: string | undefined): Base | undefined {
  const { store } = devicePorts(useCtx().ports);
  const background = useRoom(store, roomId ?? "")?.background;
  return isBase(background) ? background : undefined;
}

function Themed({ product, regions, roomId, theme }: { product: Product; regions: Regions; roomId: string | undefined; theme?: ThemeEntry }): ReactElement {
  const { store } = devicePorts(useCtx().ports);
  const room = useRoom(store, roomId ?? "");
  return (
    <ThemeProvider base={useOpenBase(roomId)} theme={theme} accent={!isBase(room?.background) ? room?.accent : undefined}>
      <ShellRoutes regions={regions} />
      <Notices product={product} />
    </ThemeProvider>
  );
}

function Routed({ product, router, regions, theme }: ShellAppProps): ReactElement {
  const roomId = roomIdOf(useRoute());
  return (
    <product.Root roomId={roomId} navigate={router.navigate} replace={router.replace}>
      <Themed product={product} regions={regions} roomId={roomId} theme={theme} />
    </product.Root>
  );
}

export interface ShellAppProps {
  product: Product;
  router: Router;
  regions: Regions;
  drawer: DrawerState;
  /** The product's own theme, shown where no conversation sets one; the device's base applies when absent. */
  theme?: ThemeEntry;
}

/** What the app mounts: the composed product with its routes, the theme of the open conversation, and the stack of notices. */
export function ShellApp(props: ShellAppProps): ReactElement {
  return (
    <RouterContext.Provider value={props.router}>
      <DrawerContext.Provider value={props.drawer}>
        <Routed {...props} />
      </DrawerContext.Provider>
    </RouterContext.Provider>
  );
}
