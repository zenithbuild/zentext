#!/usr/bin/env node
/**
 * Zentext CLI entry point.
 *
 * Phase 2 read/inspect commands only:
 *   init, status, show, list
 */

import { CliError, init, list, printUsage, repack, show, status } from "./commands.js";

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
        result = await repack(cwd, {
          focus: typeof flags.focus === "string" ? flags.focus : undefined,
          maxSize: typeof flags["max-size"] === "number" ? flags["max-size"] : undefined,
          out: typeof flags.out === "string" ? flags.out : undefined,
        });
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
