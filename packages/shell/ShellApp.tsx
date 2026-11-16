import type { ReactElement } from "react";
import { type Product, useNotices } from "@openwork/kit";
import { Feedback, ThemeProvider } from "@openwork/ui";
import type { Regions } from "./Frame.tsx";
import { ShellRoutes } from "./Pages.tsx";
import { roomIdOf } from "./route.ts";
import { RouterContext, type Router, useRoute } from "./router.ts";

function Notices({ product }: { product: Product }): ReactElement {
  return <Feedback notices={useNotices(product.notices)} onDismiss={product.notices.dismiss} />;
}

function Routed({ product, router, regions }: ShellAppProps): ReactElement {
  const roomId = roomIdOf(useRoute());
  return (
    <product.Root roomId={roomId} navigate={router.navigate}>
      <ShellRoutes regions={regions} />
    </product.Root>
  );
}

export interface ShellAppProps {
  product: Product;
  router: Router;
  regions: Regions;
}

/** What the app mounts: the theme, the composed product with its routes, and the stack of notices. */
export function ShellApp(props: ShellAppProps): ReactElement {
  return (
    <ThemeProvider>
      <RouterContext.Provider value={props.router}>
        <Routed {...props} />
        <Notices product={props.product} />
      </RouterContext.Provider>
    </ThemeProvider>
  );
}
