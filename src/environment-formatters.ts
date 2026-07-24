import type { ContinuationView } from "./continuation.js";
import { TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS } from "./continuation-prompt.js";
import { assertSafeExternalInput, redactForOutput } from "./safety.js";

export const ENVIRONMENT_FORMATTER_VERSION = "1.0";
export const ENVIRONMENT_FORMATTER_IDS = [
  "generic",
  "codex",
  "claude-code",
  "ollama-host",
] as const;

export type EnvironmentFormatterId = (typeof ENVIRONMENT_FORMATTER_IDS)[number];

export interface EnvironmentFormatterDescriptor {
  id: EnvironmentFormatterId;
  version: typeof ENVIRONMENT_FORMATTER_VERSION;
  label: string;
  description: string;
  guidance: readonly string[];
}

export interface EnvironmentFormatterOptions {
  compact?: boolean;
  includeInstructions?: boolean;
}

const ALIASES = {
  claude: "claude-code",
  ollama: "ollama-host",
} as const satisfies Record<string, EnvironmentFormatterId>;

const FORMATTERS: Record<EnvironmentFormatterId, EnvironmentFormatterDescriptor> = {
  generic: {
    id: "generic",
    version: ENVIRONMENT_FORMATTER_VERSION,
    label: "Generic local tool or harness",
    description:
      "Provider-neutral baseline for any environment that can consume structured text.",
    guidance: [
      "Read the validated canonical state below through an available local Zentext interface.",
      "Explain the recovered state before changing files, then begin from the exact next action.",
      "Record progress through a revision-safe Zentext write surface after completing work.",
    ],
  },
  codex: {
    id: "codex",
    version: ENVIRONMENT_FORMATTER_VERSION,
    label: "Codex project environment",
    description:
      "Presentation guidance for a Codex project skill or local RPC command.",
    guidance: [
      "Prefer the project-local Zentext memory skill or NDJSON RPC instead of parsing terminal prose.",
      "Do not rely on another Codex task, hidden context, or prior conversation history.",
      "Explain the recovered state before editing and record one revision-safe progress update afterward.",
    ],
  },
  "claude-code": {
    id: "claude-code",
    version: ENVIRONMENT_FORMATTER_VERSION,
    label: "Claude Code project environment",
    description:
      "Presentation guidance for a Claude Code project command, hook, or local adapter.",
    guidance: [
      "Invoke Zentext from the current project through a local command or adapter; conversation history is not canonical memory.",
      "Explain the recovered state before editing and do not repeat completed work.",
      "Use a validated SDK or RPC write after completing the exact next action.",
    ],
  },
  "ollama-host": {
    id: "ollama-host",
    version: ENVIRONMENT_FORMATTER_VERSION,
    label: "Ollama host application",
    description:
      "Presentation guidance for the local harness that supplies validated state to an Ollama model.",
    guidance: [
      "The host application must validate Zentext state before sending it to the model.",
      "Do not assume the Ollama runtime itself can inspect the project or persist progress.",
      "The host must mediate any revision-safe write and reject stale continuation state.",
    ],
  },
};

export class UnsupportedEnvironmentFormatterError extends Error {
  readonly code = "UNSUPPORTED_ENVIRONMENT_FORMATTER";
  readonly supported = [...ENVIRONMENT_FORMATTER_IDS];
  readonly aliases = { ...ALIASES };

  constructor(readonly requested: string) {
    super(
      `Unsupported environment formatter '${requested}'. Supported values: ${ENVIRONMENT_FORMATTER_IDS.join(
        ", ",
      )}. Aliases: claude -> claude-code, ollama -> ollama-host.`,
    );
    this.name = "UnsupportedEnvironmentFormatterError";
  }
}

export function resolveEnvironmentFormatterId(
  requested: string,
): EnvironmentFormatterId {
  const normalized = requested.trim().toLowerCase();
  if ((ENVIRONMENT_FORMATTER_IDS as readonly string[]).includes(normalized)) {
    return normalized as EnvironmentFormatterId;
  }
  const alias = ALIASES[normalized as keyof typeof ALIASES];
  if (alias) return alias;
  throw new UnsupportedEnvironmentFormatterError(requested);
}

export function getEnvironmentFormatterDescriptor(
  requested: string,
): EnvironmentFormatterDescriptor {
  return FORMATTERS[resolveEnvironmentFormatterId(requested)];
}

export function renderEnvironmentContinuation(
  view: ContinuationView,
  requested: string,
  options: EnvironmentFormatterOptions = {},
): string {
  const descriptor = getEnvironmentFormatterDescriptor(requested);
  assertSafeExternalInput(view, {
    allowSecretOverride: true,
    maxBytes: Number.MAX_SAFE_INTEGER,
  });
  const continuation = redactForOutput(view);
  const lines = [
    `# Zentext continuation for ${descriptor.label}`,
    "",
    `Formatter: zentext.environment/${descriptor.id}@${descriptor.version}`,
    "Validation: current",
  ];

  if (!options.compact) {
    lines.push(
      "",
      descriptor.description,
      "",
      "## Environment guidance",
      "",
      ...descriptor.guidance.map((instruction) => `- ${instruction}`),
      "",
      "## Recovered state",
      "",
      `- Project: ${continuation.project.name} (\`${continuation.project.id}\`)`,
      `- Task: ${continuation.task.title} (\`${continuation.task.id}\`)`,
      `- Task revision: ${continuation.task.revision}`,
      `- Handoff: \`${continuation.handoff.record_id}\` at revision ${continuation.handoff.based_on_task_revision}`,
      `- Stopping point: ${continuation.handoff.stopping_point}`,
      `- Exact next action: ${continuation.handoff.next_action}`,
    );
  }

  if (options.includeInstructions) {
    lines.push(
      "",
      "## Tool-neutral continuation contract",
      "",
      ...TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS.map(
        (instruction, index) => `${index + 1}. ${instruction}`,
      ),
    );
  }

  lines.push(
    "",
    "--- BEGIN VALIDATED ZENTEXT STATE ---",
    "",
    "```json",
    JSON.stringify(continuation, null, 2),
    "```",
    "",
    "--- END VALIDATED ZENTEXT STATE ---",
  );

  return lines.join("\n");
}
