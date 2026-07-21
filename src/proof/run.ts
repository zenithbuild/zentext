#!/usr/bin/env node
/**
 * CLI entry point for the Stage 3 multi-agent proof.
 *
 * Usage:
 *   GLM_API_KEY=... KIMI_API_KEY=... MINIMAX_API_KEY=... QWEN_API_KEY=... node dist/proof/run.js
 *
 * If no API keys are provided, the harness runs in stub mode as a dry-run.
 */

import { runProof } from "./harness.js";
import { OpenAICompatibleAdapter, StubAdapter } from "./model-adapter.js";

function env(key: string): string | undefined {
  return process.env[key];
}

function buildAdapters() {
  const adapters = [];

  if (env("GLM_API_KEY")) {
    adapters.push(
      new OpenAICompatibleAdapter({
        name: "GLM",
        apiKey: env("GLM_API_KEY")!,
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        model: "glm-4-flash",
        jsonMode: true,
      }),
    );
  }

  if (env("KIMI_API_KEY")) {
    adapters.push(
      new OpenAICompatibleAdapter({
        name: "Kimi",
        apiKey: env("KIMI_API_KEY")!,
        baseURL: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
        jsonMode: true,
      }),
    );
  }

  if (env("MINIMAX_API_KEY")) {
    adapters.push(
      new OpenAICompatibleAdapter({
        name: "MiniMax",
        apiKey: env("MINIMAX_API_KEY")!,
        baseURL: "https://api.minimax.chat/v1",
        model: "abab6.5-chat",
        jsonMode: true,
      }),
    );
  }

  if (env("QWEN_API_KEY")) {
    adapters.push(
      new OpenAICompatibleAdapter({
        name: "Qwen",
        apiKey: env("QWEN_API_KEY")!,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-turbo",
        jsonMode: true,
      }),
    );
  }

  if (adapters.length === 0) {
    console.error("No API keys found. Running stub dry-run.");
    adapters.push(
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
    );
  }

  return adapters;
}

async function main() {
  const adapters = buildAdapters();
  const report = await runProof({ adapters, reportPath: "tests/field-tests/stage-3-multi-agent-proof/stage-3-proof-report.md" });
  console.log(report.verdict);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
