#!/usr/bin/env node
/**
 * CLI entry point for the Stage 3/4 multi-agent proof.
 *
 * Usage:
 *   # Default: use built-in Ollama model list, verify availability, run proof
 *   ollama serve
 *   node dist/proof/run.js
 *
 *   # Custom model list via JSON config
 *   node dist/proof/run.js --config proof.config.json
 *
 *   # Single Ollama model
 *   node dist/proof/run.js --provider ollama --model qwen3:latest
 *
 *   # Stub dry-run (no model calls)
 *   node dist/proof/run.js --stub
 *
 * Config file shape (JSON):
 *   {
 *     "models": [
 *       { "name": "qwen3", "provider": "ollama", "model": "qwen3:latest" },
 *       { "name": "kimi", "provider": "ollama", "model": "kimi-k2" }
 *     ]
 *   }
 */

import { readFileSync, existsSync } from "node:fs";
import { runProof, runExpandedProof } from "./harness.js";
import { createAdapter, StubAdapter } from "./model-adapter.js";
import type { ProviderConfig, ModelAdapter } from "./model-adapter.js";

const DEFAULT_CONFIG: { models: ProviderConfig[] } = {
  models: [
    { name: "qwen3", provider: "ollama", model: "qwen3:latest" },
    { name: "kimi", provider: "ollama", model: "kimi-k2" },
    { name: "glm", provider: "ollama", model: "glm4" },
    { name: "minimax", provider: "ollama", model: "minimax-m1" },
  ],
};

const OLLAMA_BASE_URL = "http://localhost:11434";

function parseArgs(): {
  configPath?: string;
  provider?: string;
  model?: string;
  stub?: boolean;
  outputDir?: string;
  expanded?: boolean;
  rounds?: number;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--config" && args[i + 1]) {
      result.configPath = args[i + 1];
      i++;
    } else if (arg === "--provider" && args[i + 1]) {
      result.provider = args[i + 1];
      i++;
    } else if (arg === "--model" && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (arg === "--output" && args[i + 1]) {
      result.outputDir = args[i + 1];
      i++;
    } else if (arg === "--expanded") {
      result.expanded = true;
    } else if (arg === "--rounds" && args[i + 1]) {
      const n = Number(args[i + 1]);
      result.rounds = isNaN(n) ? undefined : n;
      i++;
    } else if (arg === "--stub") {
      result.stub = true;
    }
  }
  return result;
}

function loadConfig(args: ReturnType<typeof parseArgs>): { models: ProviderConfig[] } {
  if (args.provider && args.model) {
    return {
      models: [
        {
          name: args.model,
          provider: args.provider as "ollama" | "openai",
          model: args.model,
        },
      ],
    };
  }
  if (args.configPath) {
    const raw = readFileSync(args.configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.models)) {
      throw new Error("Config file must contain a 'models' array");
    }
    return parsed;
  }
  const cwdDefault = "proof.config.json";
  if (existsSync(cwdDefault)) {
    const raw = readFileSync(cwdDefault, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.models)) {
      throw new Error("Config file must contain a 'models' array");
    }
    return parsed;
  }
  return DEFAULT_CONFIG;
}

async function checkOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function listOllamaModels(): Promise<Set<string>> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: "GET" });
    if (!res.ok) return new Set();
    const data = (await res.json()) as {
      models?: Array<{ model?: string; name?: string }>;
    };
    return new Set(
      (data.models ?? [])
        .map((m) => m.model ?? m.name ?? "")
        .filter((m): m is string => Boolean(m)),
    );
  } catch {
    return new Set();
  }
}

function buildAdapters(config: { models: ProviderConfig[] }, forceStub: boolean): ModelAdapter[] {
  if (forceStub || config.models.length === 0) {
    console.error("No models configured or --stub requested. Running stub dry-run.");
    return [
      new StubAdapter("Stub", {
        agentA: JSON.stringify({
          task: {
            type: "task",
            title: "Implement SaaS dashboard authentication",
            goal: "Add secure OAuth-based login and session management for the dashboard.",
            status: "active",
            next: "Wire OAuth callback handler and session store.",
            author: "agent:A",
          },
          decision: {
            type: "decision",
            title: "Use OAuth 2.0 with PKCE",
            decision: "Adopt OAuth 2.0 authorization code flow with PKCE for dashboard login.",
            status: "accepted",
            author: "agent:A",
          },
          handoff: {
            type: "handoff",
            title: "Initial auth handoff",
            from: "agent:A",
            to: "agent:B",
            context: "Authentication scope and decision are documented.",
            state: "Task created, decision accepted, no code written yet.",
            next: "Implement OAuth callback handler and session middleware.",
            author: "agent:A",
          },
        }),
        agentB: JSON.stringify({
          understanding: {
            current_goal: "Add secure OAuth-based login and session management for the dashboard.",
            latest_decision: "Adopt OAuth 2.0 authorization code flow with PKCE for dashboard login.",
            active_task: "Implement SaaS dashboard authentication",
            next_action: "Wire OAuth callback handler and session store.",
          },
          update: {
            record_id: "rec_task_PLACEHOLDER",
            expected_revision: 1,
            patch: { next: "Implement session middleware tests." },
            reason: "Progress the active task by clarifying the next step.",
          },
        }),
        agentC: JSON.stringify({
          update: {
            record_id: "rec_task_PLACEHOLDER",
            expected_revision: 1,
            patch: { next: "Start implementing password login instead." },
            reason: "Outdated context suggests this is still the next step.",
          },
        }),
        agentD: JSON.stringify({
          current_state: "The authentication task is active and a decision to use OAuth 2.0 with PKCE is accepted.",
          completed_work: "Agent B updated the active task after Agent A seeded the project.",
          rejected_stale_work: "Agent C attempted an outdated update but it was rejected by optimistic concurrency.",
          next_implementation_step: "Wire OAuth callback handler and session store.",
        }),
      }),
    ];
  }
  return config.models.map(createAdapter);
}

async function main() {
  const args = parseArgs();

  if (!args.stub) {
    const running = await checkOllamaRunning();
    if (!running) {
      console.error("Ollama does not appear to be running at http://localhost:11434.");
      console.error("Start it with: ollama serve");
      process.exit(1);
    }
    console.log("Ollama is running.");
  }

  const config = loadConfig(args);
  let adapters = buildAdapters(config, args.stub ?? false);

  const skippedModels: Array<{ name: string; provider: string; model: string; reason: string }> = [];

  if (!args.stub) {
    const availableModels = await listOllamaModels();
    const availableAdapters: typeof adapters = [];
    for (const adapter of adapters) {
      if (adapter.provider === "ollama" && !availableModels.has(adapter.model)) {
        console.warn(`Model ${adapter.model} is not available locally. It will be skipped.`);
        skippedModels.push({
          name: adapter.name,
          provider: adapter.provider,
          model: adapter.model,
          reason: `Model ${adapter.model} not found in Ollama`,
        });
      } else {
        availableAdapters.push(adapter);
      }
    }
    adapters = availableAdapters;
  }

  const outputDir = args.outputDir ?? "proof-results";

  if (args.expanded) {
    const report = await runExpandedProof({ adapters, skippedModels, rounds: args.rounds, outputDir });
    const availableCount = report.models.filter((m) => m.available).length;
    console.log(`Expanded proof complete. ${availableCount}/${report.models.length} model(s) evaluated.`);
    console.log(`Artifacts: ${outputDir}/`);
  } else {
    const report = await runProof({ adapters, skippedModels, outputDir });
    const availableCount = report.models.filter((m) => m.available).length;
    console.log(`Proof complete. ${availableCount}/${report.models.length} model(s) evaluated.`);
    console.log(`Artifacts: ${outputDir}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
