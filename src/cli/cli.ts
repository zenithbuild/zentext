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
} from "./commands.js";

function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | number | boolean | undefined>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | number | boolean | undefined> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        const num = Number(next);
        flags[key] = !isNaN(num) && next.trim() !== "" ? num : next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] ?? "",
    positional: positional.slice(1),
    flags,
  };
}


function collectRepeated(values: (string | number | boolean | undefined)[]): string[] {
  return values.filter((v): v is string => typeof v === "string").map((v) => v);
}

function parseHandoffOptions(
  positional: string[],
  flags: Record<string, string | number | boolean | undefined>,
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
  const from =
    typeof flags.from === "string"
      ? flags.from
      : positional.find((_, i, arr) => arr[i - 1] === "--from");
  const stoppingPoint =
    typeof flags["stopping-point"] === "string"
      ? flags["stopping-point"]
      : positional.find((_, i, arr) => arr[i - 1] === "--stopping-point");
  const nextAction =
    typeof flags["next-action"] === "string"
      ? flags["next-action"]
      : positional.find((_, i, arr) => arr[i - 1] === "--next-action");

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
    completed: collectRepeated([flags.completed]),
    blockers: collectRepeated([flags.blockers]),
    filesChanged: collectRepeated([flags["files-changed"]]),
    verification: collectRepeated([flags.verification]),
    previousResponse:
      typeof flags["previous-response"] === "string"
        ? flags["previous-response"]
        : undefined,
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
          type: typeof flags.type === "string" ? flags.type : undefined,
          status: typeof flags.status === "string" ? flags.status : undefined,
          limit: typeof flags.limit === "number" ? flags.limit : undefined,
        });
        break;
      }
      case "repack": {
        const maxSizeRaw = flags["max-size"];
        if (maxSizeRaw !== undefined && typeof maxSizeRaw !== "number") {
          throw new CliError("--max-size must be a positive number", 1);
        }
        result = await repack(cwd, {
          focus: typeof flags.focus === "string" ? flags.focus : undefined,
          maxSize: typeof maxSizeRaw === "number" ? maxSizeRaw : undefined,
          out: typeof flags.out === "string" ? flags.out : undefined,
        });
        break;
      }
      case "handoff": {
        const subcommand = positional[0] ?? "";
        const json = flags.json === true;
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
            const opts = parseHandoffOptions(positional.slice(1), flags);
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

    if (result.output && !flags.out) {
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
