export interface PepestoClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class PepestoApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly body: string;

  constructor(status: number, endpoint: string, body: string) {
    const excerpt = body.length > 500 ? `${body.slice(0, 500)}…` : body;
    super(`Pepesto API ${status} on ${endpoint}: ${excerpt}`);
    this.name = "PepestoApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

export class PepestoClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PepestoClientOptions = {}) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://s.pepesto.com/api").replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error(
        "PEPESTO_API_KEY is not set. See the README (\"Getting an API key\") for how to " +
          "obtain one.",
      );
    }
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new PepestoApiError(res.status, path, text);
    }
    if (!text) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}
