/**
 * Minimal, dependency-free model adapters for the Stage 3 multi-agent proof.
 *
 * Providers:
 * - ollama: local Ollama server (default, http://localhost:11434)
 * - openai: OpenAI-compatible endpoint (optional, for remote providers)
 * - antigravity-cli: local Antigravity CLI (agy)
 */

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

// Capture the real HOME at module load time. The proof harness may change
// process.env.HOME later to isolate the Zentext store, but the Antigravity CLI
// needs the user's actual home directory to find its authenticated session.
const ORIGINAL_HOME = process.env.HOME ?? "/tmp";

export interface ModelAdapter {
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  send(system: string, user: string): Promise<string>;
}

export interface ProviderConfig {
  name: string;
  provider: "ollama" | "openai" | "antigravity" | "antigravity-cli";
  model: string;
  /** Ollama defaults to http://localhost:11434. OpenAI requires this. */
  baseURL?: string;
  /** Required only for openai or antigravity providers. */
  apiKey?: string;
  /** Required only for antigravity-cli provider. */
  command?: string;
  /** Required only for antigravity-cli provider. */
  args?: string[];
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
  readonly provider: "openai" | "antigravity" = "openai";
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

export class AntigravityAdapter extends OpenAICompatibleAdapter {
  readonly provider = "antigravity";

  constructor(config: { name: string; model: string; apiKey?: string }) {
    super({
      name: config.name,
      model: config.model,
      baseURL: "https://api.antigravity.services/openai",
      apiKey: config.apiKey,
    });
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
  if (config.provider === "antigravity") {
    return new AntigravityAdapter({
      name: config.name,
      model: config.model,
      apiKey: config.apiKey,
    });
  }
  if (config.provider === "antigravity-cli") {
    return new AntigravityCliAdapter({
      name: config.name,
      model: config.model,
      command: config.command,
      args: config.args,
    });
  }
  throw new Error(
    `Unknown provider '${(config as { provider: string }).provider}' for adapter '${config.name}'`,
  );
}

export interface AntigravityCliConfig {
  name: string;
  model: string;
  /** Path to the agy binary. Defaults to "agy" (resolved via PATH). */
  command?: string;
  /** Additional CLI arguments to pass before the prompt. */
  args?: string[];
  /**
   * Optional spawn implementation. Allows tests to mock the CLI without making
   * real network calls or depending on the installed `agy` binary.
   */
  runner?: (
    command: string,
    args: string[],
    options: SpawnOptions,
  ) => ChildProcess;
  /** Internal override for test speed. Defaults to 10 minutes. */
  timeoutMs?: number;
}

/** Delimiters used to combine system and user prompts into one agy --print argument. */
const SYSTEM_DELIMITER = "--- ZENTEXT_SYSTEM ---";
const USER_DELIMITER = "--- ZENTEXT_USER ---";

export function combinePrompts(system: string, user: string): string {
  return `${SYSTEM_DELIMITER}\n${system.trim()}\n${USER_DELIMITER}\n${user.trim()}`;
}

export class AntigravityCliAdapter implements ModelAdapter {
  readonly provider = "antigravity-cli";
  readonly name: string;
  readonly model: string;
  private readonly command: string;
  private readonly extraArgs: string[];
  private readonly runner: (
    command: string,
    args: string[],
    options: SpawnOptions,
  ) => ChildProcess;
  private readonly timeoutMs: number;

  constructor(config: AntigravityCliConfig) {
    this.name = config.name;
    this.model = config.model;
    this.command = config.command ?? "agy";
    this.extraArgs = config.args ?? [];
    this.runner = config.runner ?? spawn;
    this.timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;
  }

  async send(system: string, user: string): Promise<string> {
    const prompt = combinePrompts(system, user);
    const args = [
      ...this.extraArgs,
      "--model",
      this.model,
      "--dangerously-skip-permissions",
      "--print",
      prompt,
    ];

    return new Promise((resolve, reject) => {
      let settled = false;
      const child = this.runner(this.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, HOME: ORIGINAL_HOME },
      });

      let stdout = "";
      let stderr = "";
      child.stdout!.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr!.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGTERM");
        reject(new Error("Antigravity CLI timed out after 10 minutes"));
      }, this.timeoutMs);

      const finish = (
        outcome: { ok: true; value: string } | { ok: false; error: Error },
      ) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        if (outcome.ok) {
          resolve(outcome.value);
        } else {
          reject(outcome.error);
        }
      };

      child.on("error", (err) => {
        finish({
          ok: false,
          error: new Error(`Antigravity CLI spawn error: ${err.message}`),
        });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          finish({
            ok: false,
            error: new Error(
              `Antigravity CLI exited ${code}. stderr: ${stderr.slice(0, 500)}`,
            ),
          });
          return;
        }
        if (stderr && stderr.toLowerCase().includes("quota")) {
          finish({
            ok: false,
            error: new Error(`Antigravity quota error: ${stderr.trim()}`),
          });
          return;
        }
        const output = stdout.trim();
        if (!output) {
          finish({
            ok: false,
            error: new Error(
              `Antigravity CLI returned empty stdout. stderr: ${stderr.slice(0, 500)}`,
            ),
          });
          return;
        }
        finish({ ok: true, value: output });
      });
    });
  }
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
