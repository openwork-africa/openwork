import { HttpError, NetworkError } from "./errors.ts";
import type { Author } from "./types.ts";

/** A message of a room as the server's AI route takes it. Nothing about the person or the device. */
export interface AiMessage {
  id: string;
  authorId: Author;
  content: string;
  createdAt: number;
}

export type AiReply =
  | { status: "reply"; text: string }
  | { status: "none" }
  /** The server has no AI plugin. */
  | { status: "unavailable" }
  /** A reply for this room is already on its way. */
  | { status: "busy" };

export interface AiStatus {
  configured: boolean;
  /** The ids of the rooms a reply is pending in. */
  pending: string[];
}

export interface AiClient {
  reply(roomId: string, messages: AiMessage[]): Promise<AiReply>;
  status(): Promise<AiStatus>;
}

/** The AI of a server with none: it never answers and nothing is pending. */
export const noAiClient: AiClient = {
  reply: () => Promise.resolve({ status: "unavailable" }),
  status: () => Promise.resolve({ configured: false, pending: [] }),
};

/** The server's `/api/ai/reply` and `/api/ai/status` over fetch. `baseUrl` defaults to the page's own origin. */
export class HttpAiClient implements AiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(baseUrl = "", fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetcher;
  }

  async #request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.#fetch(`${this.#baseUrl}${path}`, init);
    } catch (error) {
      throw new NetworkError(error);
    }
  }

  async reply(roomId: string, messages: AiMessage[]): Promise<AiReply> {
    const response = await this.#request("/api/ai/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, messages }),
    });
    if (response.status === 404) return { status: "unavailable" };
    if (response.status === 409) return { status: "busy" };
    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
      throw new HttpError(response.status, body?.message);
    }
    return await response.json() as AiReply;
  }

  async status(): Promise<AiStatus> {
    const response = await this.#request("/api/ai/status");
    if (response.status === 404) return { configured: false, pending: [] };
    if (!response.ok) throw new HttpError(response.status);
    return await response.json() as AiStatus;
  }
}
