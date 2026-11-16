import { Component, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { copy } from "./copy.ts";

type Fallback = ReactNode | ((error: Error, retry: () => void) => ReactNode);

interface Props {
  /** The section it guards, as a person would call it ("circle"); reported with the error. */
  name: string;
  /** What shows instead of the section: `null` to drop it quietly. Default: a "couldn't show" note with Try again. */
  fallback?: Fallback;
  /** When this changes (a route, the open chat), a failed section tries again. */
  resetKey?: unknown;
  children: ReactNode;
}

/**
 * Keeps a failure inside the section it happened in: that section shows its fallback, everything around it
 * carries on. It only renders — every caught error is reported once, by the root's onCaughtError.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidUpdate(previous: Props): void {
    if (this.state.error && !Object.is(previous.resetKey, this.props.resetKey)) this.retry();
  }

  retry = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    const { fallback, name, children } = this.props;
    if (!error) return children;
    if (typeof fallback === "function") return fallback(error, this.retry);
    if (fallback !== undefined) return fallback;
    return <SectionError name={name} retry={this.retry} />;
  }
}

export function SectionError({ name, retry }: { name: string; retry: () => void }): ReactNode {
  return (
    <Banner
      status="error"
      container="card"
      title={copy.couldNotShow(name)}
      endContent={<Button label={copy.tryAgain} size="sm" onClick={retry} />}
    />
  );
}
