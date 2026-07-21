/**
 * Minimal, dependency-free model adapters for the Stage 3 multi-agent proof.
 *
 * Providers:
 * - ollama: local Ollama server (default, http://localhost:11434)
 * - openai: OpenAI-compatible endpoint (optional, for remote providers)
 */

export interface ModelAdapter {
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  send(system: string, user: string): Promise<string>;
}

export interface ProviderConfig {
  name: string;
  provider: "ollama" | "openai";
  model: string;
  /** Ollama defaults to http://localhost:11434. OpenAI requires this. */
  baseURL?: string;
  /** Required only for openai provider. */
  apiKey?: string;
}

function cleanBaseURL(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/$/, "");
}

export class OllamaAdapter implements ModelAdapter {
  readonly provider = "ollama";
  readonly name: string;
  readonly model: string;
  private readonly baseURL: string;

  constructor(config: { name: string; model: string; baseURL?: string }) {
    this.name = config.name;
    this.model = config.model;
    this.baseURL = cleanBaseURL(config.baseURL) ?? "http://localhost:11434";
  }

  async send(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      error?: string;
    };
    if (data.error) {
      throw new Error(`Ollama model error: ${data.error}`);
    }
    const content = data.message?.content;
    if (typeof content !== "string") {
      throw new Error("Ollama returned empty or malformed content");
    }
    return content;
  }
}

export class OpenAICompatibleAdapter implements ModelAdapter {
  readonly provider = "openai";
  readonly name: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(config: {
    name: string;
    model: string;
    baseURL: string;
    apiKey?: string;
  }) {
    this.name = config.name;
    this.model = config.model;
    this.baseURL = cleanBaseURL(config.baseURL)!;
    this.apiKey = config.apiKey ?? "";
  }

  async send(system: string, user: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
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

export function createAdapter(config: ProviderConfig): ModelAdapter {
  if (config.provider === "ollama") {
    return new OllamaAdapter(config);
  }
  if (config.provider === "openai") {
    if (!config.baseURL) {
      throw new Error(
        `openai provider requires baseURL for adapter '${config.name}'`,
      );
    }
    return new OpenAICompatibleAdapter({
      name: config.name,
      model: config.model,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }
  throw new Error(
    `Unknown provider '${(config as { provider: string }).provider}' for adapter '${config.name}'`,
  );
}

export interface StubResponseMap {
  agentA: string;
  agentB: string;
  agentC: string;
  agentD: string;
}

export class StubAdapter implements ModelAdapter {
  readonly provider = "stub";
  readonly name: string;
  readonly model = "stub";
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
      throw new Error(
        `Stub ${this.name}: unrecognized prompt prefix: ${user.slice(0, 60)}`,
      );
    }
    this.callCount += 1;
    return this.responses[key];
  }
}
