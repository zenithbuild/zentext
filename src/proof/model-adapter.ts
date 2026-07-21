/**
 * Minimal model adapters for the Stage 3 multi-agent proof.
 *
 * No new dependencies: uses global fetch.
 */

export interface ModelAdapter {
  readonly name: string;
  send(system: string, user: string): Promise<string>;
}

export interface OpenAICompatibleConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  /** If true, request JSON mode when the provider supports it. */
  jsonMode?: boolean;
}

export class OpenAICompatibleAdapter implements ModelAdapter {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly jsonMode: boolean;

  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL.replace(/\/$/, "");
    this.model = config.model;
    this.jsonMode = config.jsonMode ?? false;
  }

  async send(system: string, user: string): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    if (this.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.name} API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(`${this.name} returned empty or malformed content`);
    }
    return content;
  }
}

export interface StubResponseMap {
  agentA: string;
  agentB: string;
  agentC: string;
  agentD: string;
}

export class StubAdapter implements ModelAdapter {
  readonly name: string;
  private readonly responses: StubResponseMap;
  private callCount = 0;

  constructor(name: string, responses: StubResponseMap) {
    this.name = name;
    this.responses = responses;
  }

  async send(_system: string, user: string): Promise<string> {
    const key = user.startsWith("Agent A:")
      ? "agentA"
      : user.startsWith("Agent B:")
        ? "agentB"
        : user.startsWith("Agent C:")
          ? "agentC"
          : user.startsWith("Agent D:")
            ? "agentD"
            : undefined;
    if (!key) {
      throw new Error(`Stub ${this.name}: unrecognized prompt prefix: ${user.slice(0, 60)}`);
    }
    this.callCount += 1;
    return this.responses[key];
  }
}
