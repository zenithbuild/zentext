export type FlagScalar = string | number | boolean;
export type FlagValue = FlagScalar | FlagScalar[] | undefined;

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, FlagValue>;
}

export const REPEATABLE_FLAGS = new Set([
  "completed",
  "blockers",
  "files-changed",
  "verification",
  "note",
]);

function parseValue(key: string, raw: string): string | number {
  if (REPEATABLE_FLAGS.has(key)) return raw;
  const number = Number(raw);
  return !Number.isNaN(number) && raw.trim() !== "" ? number : raw;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    const value: FlagScalar =
      next === undefined || next.startsWith("--") ? true : parseValue(key, next);
    if (value !== true) i += 1;

    if (!REPEATABLE_FLAGS.has(key)) {
      flags[key] = value;
      continue;
    }

    const previous = flags[key];
    if (previous === undefined) {
      flags[key] = value;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      flags[key] = [previous, value];
    }
  }

  return {
    command: positional[0] ?? "",
    positional: positional.slice(1),
    flags,
  };
}

export function stringFlag(flags: Record<string, FlagValue>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

export function numberFlag(flags: Record<string, FlagValue>, key: string): number | undefined {
  const value = flags[key];
  return typeof value === "number" ? value : undefined;
}

export function booleanFlag(flags: Record<string, FlagValue>, key: string): boolean {
  return flags[key] === true;
}

export function repeatedStringFlag(flags: Record<string, FlagValue>, key: string): string[] {
  const value = flags[key];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((entry): entry is string => typeof entry === "string");
}
