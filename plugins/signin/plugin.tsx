import { composerAddMenu, composerNotice, contribute, definePlugin } from "@openwork/kit";
import { LogIn } from "lucide-react";
import { Icon } from "@astryxdesign/core/Icon";
import { copy } from "./copy.ts";

export interface SignInNotice {
  title: string;
  description?: string;
  actionLabel: string;
}

export interface SignInOptions {
  /** Whether the person is signed in. Signed in, the plugin contributes nothing. */
  signedIn: boolean;
  /** What the product does to start signing in. */
  onSignIn: () => void;
  /** The text of the notice above the composer; the product supplies the words. */
  notice: SignInNotice;
}

/** For guests: a "Sign in" row in the composer's + menu and a notice above the composer, both calling `onSignIn`. */
export function signIn({ signedIn, onSignIn, notice }: SignInOptions) {
  return definePlugin({
    id: "signin",
    version: "0.1.0",
    contributes: signedIn ? [] : [
      contribute(composerAddMenu, {
        id: "signin",
        order: 100,
        label: copy.signIn,
        description: copy.signInDescription,
        icon: <Icon icon={LogIn} />,
        run: () => onSignIn(),
      }),
      contribute(composerNotice, {
        id: "signin",
        order: 10,
        label: notice.title,
        description: notice.description,
        actionLabel: notice.actionLabel,
        onAction: () => onSignIn(),
      }),
    ],
  });
}
