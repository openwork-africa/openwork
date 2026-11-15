import { HttpError, NetworkError } from "./errors.ts";
import type { Transport } from "./ports.ts";
import type { Answer, PullAnswer } from "./types.ts";
import { pushBodyWire } from "./wire.ts";

async function failure(response: Response): Promise<HttpError> {
  const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
  return new HttpError(response.status, body?.message);
}

/** The Openwork server's sync API over fetch. `baseUrl` defaults to the page's own origin. */
export class HttpTransport implements Transport {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(baseUrl = "", fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetcher;
  }

  async #request(path: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, init);
    } catch (error) {
      throw new NetworkError(error);
    }
    return response;
  }

  async #json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.#request(path, init);
    if (!response.ok) throw await failure(response);
    return await response.json() as T;
  }

  async push(changes: Parameters<Transport["push"]>[0]): Promise<Answer[]> {
    const body = JSON.stringify(pushBodyWire({ changes }));
    const { answers } = await this.#json<{ answers: Answer[] }>("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return answers;
  }

  pull(since: number): Promise<PullAnswer> {
    return this.#json<PullAnswer>(`/api/pull?since=${since}`);
  }

  async putFile(id: string, bytes: Blob): Promise<void> {
    const response = await this.#request(`/api/files/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": bytes.type || "application/octet-stream" },
      body: bytes,
    });
    if (!response.ok) throw await failure(response);
  }

  async getFile(id: string): Promise<Blob | undefined> {
    const response = await this.#request(`/api/files/${encodeURIComponent(id)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw await failure(response);
    return await response.blob();
  }

  async health(): Promise<boolean> {
    try {
      return (await this.#request("/healthz")).ok;
    } catch {
      return false;
    }
  }
}
