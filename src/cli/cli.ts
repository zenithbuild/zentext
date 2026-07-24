#!/usr/bin/env node
/**
 * Zentext CLI entry point.
 *
 * Phase 2 read/inspect commands only:
 *   init, status, show, list
 */

import {
  CliError,
  continueProject,
  handoffAcknowledge,
  handoffCreate,
  handoffExport,
  handoffShow,
  handoffValidate,
  init,
  list,
  parseContinuationOptions,
  parseHandoffExportFormat,
  printUsage,
  repack,
  search,
  show,
  status,
  taskCreate,
  taskShow,
  taskUpdate,
} from "./commands.js";
import {
  booleanFlag,
  numberFlag,
  parseArgs,
  repeatedStringFlag,
  stringFlag,
  type FlagValue,
} from "./args.js";
import { runRpcServer } from "../rpc/server.js";
import { redactForOutput } from "../safety.js";
import type { RecordType } from "../types/records.js";

function parseHandoffOptions(
  flags: Record<string, FlagValue>,
): {
  from: string;
  stoppingPoint: string;
  nextAction: string;
  completed: string[];
  blockers: string[];
  filesChanged: string[];
  verification: string[];
  previousResponse?: string;
} {
  const from = stringFlag(flags, "from");
  const stoppingPoint = stringFlag(flags, "stopping-point");
  const nextAction = stringFlag(flags, "next-action");

  if (!from || !stoppingPoint || !nextAction) {
    throw new CliError(
      "Usage: zentext handoff create --from <agent> --stopping-point <text> --next-action <text>",
      1,
    );
  }

  return {
    from,
    stoppingPoint,
    nextAction,
    completed: repeatedStringFlag(flags, "completed"),
    blockers: repeatedStringFlag(flags, "blockers"),
    filesChanged: repeatedStringFlag(flags, "files-changed"),
    verification: repeatedStringFlag(flags, "verification"),
    previousResponse: stringFlag(flags, "previous-response"),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "help") {
    console.log(printUsage());
    process.exit(0);
  }

  const cwd = process.cwd();
  const { command, positional, flags } = parseArgs(argv);

  try {
    if (command === "rpc") {
      if (positional.length > 0 || Object.keys(flags).length > 0) {
        throw new CliError("Usage: zentext rpc", 1);
      }
      await runRpcServer(process.stdin, process.stdout, process.stderr);
      return;
    }

    let result: { output: string; exitCode: number };

    switch (command) {
      case "init": {
        result = await init(cwd);
        break;
      }
      case "status": {
        result = await status(cwd);
        break;
      }
      case "continue": {
        if (positional.length > 0) {
          throw new CliError(
            "Usage: zentext continue [--json | --markdown | --prompt] | --for <environment>",
            1,
          );
        }
        const continuation = parseContinuationOptions(flags);
        result = await continueProject(cwd, {
          format: continuation.format,
          environment: continuation.environment,
          compact: continuation.compact,
          includeInstructions: continuation.includeInstructions,
        });
        break;
      }
      case "show": {
        if (positional.length < 1) {
          throw new CliError("Usage: zentext show <id>", 1);
        }
        result = await show(cwd, positional[0]);
        break;
      }
      case "list": {
        result = await list(cwd, {
          type: stringFlag(flags, "type"),
          status: stringFlag(flags, "status"),
          limit: numberFlag(flags, "limit"),
        });
        break;
      }
      case "search": {
        const supported = new Set([
          "type",
          "status",
          "task-id",
          "min-revision",
          "max-revision",
          "include-superseded",
          "freshness",
          "limit",
          "offset",
          "json",
        ]);
        const unsupported = Object.keys(flags).find((key) => !supported.has(key));
        if (unsupported) {
          throw new CliError(`Unsupported option for zentext search: --${unsupported}`, 1);
        }
        for (const name of ["json", "include-superseded"] as const) {
          if (flags[name] !== undefined && flags[name] !== true) {
            throw new CliError(`--${name} does not accept a value`, 1);
          }
        }
        for (const name of [
          "min-revision",
          "max-revision",
          "limit",
          "offset",
        ] as const) {
          if (flags[name] !== undefined && typeof flags[name] !== "number") {
            throw new CliError(`--${name} must be a number`, 1);
          }
        }
        for (const name of ["type", "status", "task-id", "freshness"] as const) {
          if (flags[name] !== undefined && typeof flags[name] !== "string") {
            throw new CliError(`--${name} requires a value`, 1);
          }
        }
        if (positional.length !== 1) {
          throw new CliError(
            "Usage: zentext search <query> [--type <type>] [--status <status>] [--freshness <prefer-current|current-only|historical-only>] [--limit <n>] [--offset <n>] [--json]",
            1,
          );
        }
        const type = stringFlag(flags, "type");
        const status = stringFlag(flags, "status");
        result = await search(cwd, {
          query: positional[0],
          ...(type ? { record_types: [type as RecordType] } : {}),
          ...(status ? { statuses: [status] } : {}),
          ...(stringFlag(flags, "task-id")
            ? { task_id: stringFlag(flags, "task-id") }
            : {}),
          ...(numberFlag(flags, "min-revision") !== undefined
            ? { min_revision: numberFlag(flags, "min-revision") }
            : {}),
          ...(numberFlag(flags, "max-revision") !== undefined
            ? { max_revision: numberFlag(flags, "max-revision") }
            : {}),
          include_superseded: booleanFlag(flags, "include-superseded"),
          ...(stringFlag(flags, "freshness")
            ? {
                freshness_mode: stringFlag(flags, "freshness") as
                  | "prefer-current"
                  | "current-only"
                  | "historical-only",
              }
            : {}),
          ...(numberFlag(flags, "limit") !== undefined
            ? { limit: numberFlag(flags, "limit") }
            : {}),
          ...(numberFlag(flags, "offset") !== undefined
            ? { offset: numberFlag(flags, "offset") }
            : {}),
          json: booleanFlag(flags, "json"),
        });
        break;
      }
      case "repack": {
        const maxSizeRaw = flags["max-size"];
        if (maxSizeRaw !== undefined && typeof maxSizeRaw !== "number") {
          throw new CliError("--max-size must be a positive number", 1);
        }
        result = await repack(cwd, {
          focus: stringFlag(flags, "focus"),
          maxSize: typeof maxSizeRaw === "number" ? maxSizeRaw : undefined,
          out: stringFlag(flags, "out"),
        });
        break;
      }
      case "task": {
        const subcommand = positional[0] ?? "";
        switch (subcommand) {
          case "create": {
            const title = stringFlag(flags, "title");
            if (!title || title.trim() === "") {
              throw new CliError("Usage: zentext task create --title <text> [--goal <text>] [--summary <text>] [--status active|blocked|done|canceled]", 1);
            }
            result = await taskCreate(cwd, {
              title,
              goal: stringFlag(flags, "goal"),
              summary: stringFlag(flags, "summary"),
              status: stringFlag(flags, "status"),
            });
            break;
          }
          case "show": {
            result = await taskShow(cwd);
            break;
          }
          case "update": {
            result = await taskUpdate(cwd, {
              title: stringFlag(flags, "title"),
              summary: stringFlag(flags, "summary"),
              status: stringFlag(flags, "status"),
              notes: repeatedStringFlag(flags, "note"),
              nextAction: stringFlag(flags, "next-action"),
            });
            break;
          }
          default: {
            throw new CliError(
              `Unknown task subcommand: ${subcommand}

Usage: zentext task {create|show|update} ...`,
              1,
            );
          }
        }
        break;
      }
      case "handoff": {
        const subcommand = positional[0] ?? "";
        const json = booleanFlag(flags, "json");
        switch (subcommand) {
          case "show": {
            result = await handoffShow(cwd, { json });
            break;
          }
          case "acknowledge": {
            result = await handoffAcknowledge(cwd, { json });
            break;
          }
          case "validate": {
            result = await handoffValidate(cwd, { json });
            break;
          }
          case "create": {
            const opts = parseHandoffOptions(flags);
            result = await handoffCreate(cwd, opts);
            break;
          }
          case "export": {
            result = await handoffExport(cwd, {
              format: parseHandoffExportFormat(flags),
            });
            break;
          }
          default: {
            throw new CliError(
              `Unknown handoff subcommand: ${subcommand}

${printUsage()}`,
              1,
            );
          }
        }
        break;
      }
      default: {
        throw new CliError(`Unknown command: ${command}\n\n${printUsage()}`, 1);
      }
    }

    if (result.output && !stringFlag(flags, "out")) {
      console.log(redactForOutput(result.output));
    }
    process.exit(result.exitCode);
  } catch (err) {
    if (err instanceof CliError) {
      console.error(redactForOutput(err.message));
      process.exit(err.exitCode);
    }
    console.error(
      redactForOutput(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`),
    );
    process.exit(5);
  }
}

main();
