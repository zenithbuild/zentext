#!/usr/bin/env node
/**
 * Zentext CLI entry point.
 *
 * Phase 2 read/inspect commands only:
 *   init, status, show, list
 */

import {
  CliError,
  handoffAcknowledge,
  handoffCreate,
  handoffShow,
  handoffValidate,
  init,
  list,
  printUsage,
  repack,
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
      console.log(result.output);
    }
    process.exit(result.exitCode);
  } catch (err) {
    if (err instanceof CliError) {
      console.error(err.message);
      process.exit(err.exitCode);
    }
    console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(5);
  }
}

main();
