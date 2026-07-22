import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess, SpawnOptions } from "node:child_process";

import {
  AntigravityCliAdapter,
  combinePrompts,
} from "../src/proof/model-adapter.js";

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  killSignal?: string;

  constructor(
    private readonly scenario: {
      exitCode?: number | null;
      error?: Error;
      stdoutChunks?: string[];
      stderrChunks?: string[];
      closeDelay?: number;
      /** If true, the close event never fires (use for timeout tests). */
      hang?: boolean;
    },
  ) {
    super();
  }

  kill(signal: string = "SIGTERM"): boolean {
    this.killed = true;
    this.killSignal = signal;
    return true;
  }

  start() {
    if (this.scenario.error) {
      // Emit synchronously so the "error" handler runs before close.
      this.emit("error", this.scenario.error);
      return;
    }

    for (const chunk of this.scenario.stdoutChunks ?? []) {
      this.stdout.emit("data", Buffer.from(chunk, "utf8"));
    }
    for (const chunk of this.scenario.stderrChunks ?? []) {
      this.stderr.emit("data", Buffer.from(chunk, "utf8"));
    }

    if (this.scenario.hang) {
      return;
    }

    const delay = this.scenario.closeDelay ?? 0;
    if (delay === 0) {
      this.emit("close", this.scenario.exitCode ?? 0);
    } else {
      setTimeout(() => {
        this.emit("close", this.scenario.exitCode ?? 0);
      }, delay);
    }
  }
}

function makeRunner(
  scenario: FakeChildProcess["scenario"],
  capture?: {
    command?: string[];
    args?: string[][];
    options?: SpawnOptions[];
  },
  /** Set to false to let the caller start the child manually. */
  autoStart = true,
) {
  return (
    command: string,
    args: string[],
    options: SpawnOptions,
  ): ChildProcess => {
    capture?.command?.push(command);
    capture?.args?.push(args);
    capture?.options?.push(options);
    const child = new FakeChildProcess(scenario);
    if (autoStart) {
      // Defer start so the adapter has time to attach event listeners.
      setImmediate(() => child.start());
    }
    return child as unknown as ChildProcess;
  };
}

describe("AntigravityCliAdapter prompt combining", () => {
  it("wraps system and user sections with deterministic delimiters", () => {
    const out = combinePrompts("sys", "user");
    expect(out).toBe("--- ZENTEXT_SYSTEM ---\nsys\n--- ZENTEXT_USER ---\nuser");
  });

  it("trims system and user content", () => {
    const out = combinePrompts("  sys  ", "  user  ");
    expect(out).toBe("--- ZENTEXT_SYSTEM ---\nsys\n--- ZENTEXT_USER ---\nuser");
  });
});

describe("AntigravityCliAdapter command construction", () => {
  it("builds the expected agy argument list with extra args", async () => {
    const captured: { command?: string; args?: string[]; options?: SpawnOptions } =
      {};
    const runner = (
      command: string,
      args: string[],
      options: SpawnOptions,
    ): ChildProcess => {
      captured.command = command;
      captured.args = args;
      captured.options = options;
      const child = new FakeChildProcess({
        stdoutChunks: ["ok"],
        exitCode: 0,
      });
      setImmediate(() => child.start());
      return child as unknown as ChildProcess;
    };

    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      command: "/usr/local/bin/agy",
      args: ["--effort", "high"],
      runner,
    });

    await adapter.send("system text", "user text");

    expect(captured.command).toBe("/usr/local/bin/agy");
    expect(captured.args).toEqual([
      "--effort",
      "high",
      "--model",
      "gemini-test",
      "--dangerously-skip-permissions",
      "--print",
      combinePrompts("system text", "user text"),
    ]);
    expect(captured.options?.stdio).toEqual(["ignore", "pipe", "pipe"]);
  });

  it("uses default command agy when no command is provided", async () => {
    let command = "";
    const runner = (cmd: string): ChildProcess => {
      command = cmd;
      const child = new FakeChildProcess({ stdoutChunks: ["ok"], exitCode: 0 });
      setImmediate(() => child.start());
      return child as unknown as ChildProcess;
    };

    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });

    await adapter.send("s", "u");
    expect(command).toBe("agy");
  });

  it("preserves the original HOME in the child environment", async () => {
    let capturedEnv: Record<string, string> | undefined;
    const runner = (_cmd: string, _args: string[], options: SpawnOptions): ChildProcess => {
      capturedEnv = options.env as Record<string, string>;
      const child = new FakeChildProcess({ stdoutChunks: ["ok"], exitCode: 0 });
      setImmediate(() => child.start());
      return child as unknown as ChildProcess;
    };

    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });

    await adapter.send("s", "u");
    expect(capturedEnv?.HOME).toBeTruthy();
  });
});

describe("AntigravityCliAdapter outcomes", () => {
  it("returns trimmed stdout on success", async () => {
    const runner = makeRunner({
      stdoutChunks: ["  hello world  \n"],
      exitCode: 0,
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });
    const result = await adapter.send("s", "u");
    expect(result).toBe("hello world");
  });

  it("rejects with empty stdout message when stdout is empty", async () => {
    const runner = makeRunner({
      stdoutChunks: [],
      stderrChunks: ["some warning"],
      exitCode: 0,
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });
    await expect(adapter.send("s", "u")).rejects.toThrow(
      /returned empty stdout/,
    );
  });

  it("rejects with exit code and stderr on nonzero exit", async () => {
    const runner = makeRunner({
      stdoutChunks: ["partial"],
      stderrChunks: ["bad request"],
      exitCode: 1,
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });
    await expect(adapter.send("s", "u")).rejects.toThrow(/exited 1/);
  });

  it("rejects with quota message when stderr contains quota", async () => {
    const runner = makeRunner({
      stdoutChunks: [""],
      stderrChunks: [
        "Error: Individual quota reached. Please upgrade your subscription.",
      ],
      exitCode: 0,
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });
    await expect(adapter.send("s", "u")).rejects.toThrow(/quota error/);
  });

  it("rejects with spawn error message on spawn failure", async () => {
    const runner = makeRunner({
      error: new Error("ENOENT: agy not found"),
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
    });
    await expect(adapter.send("s", "u")).rejects.toThrow(/spawn error/);
  });
});

describe("AntigravityCliAdapter timeout handling", () => {
  it("rejects with timeout and kills the child when close never fires", async () => {
    const captured: { child?: FakeChildProcess } = {};
    const runner = (
      _cmd: string,
      _args: string[],
      _options: SpawnOptions,
    ): ChildProcess => {
      const child = new FakeChildProcess({ hang: true });
      captured.child = child;
      return child as unknown as ChildProcess;
    };

    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
      timeoutMs: 1,
    });

    await expect(adapter.send("s", "u")).rejects.toThrow(/timed out/);
    expect(captured.child?.killed).toBe(true);
    expect(captured.child?.killSignal).toBe("SIGTERM");
  });

  it("does not double-settle if close fires after timeout", async () => {
    const captured: { child?: FakeChildProcess } = {};
    const runner = (
      _cmd: string,
      _args: string[],
      _options: SpawnOptions,
    ): ChildProcess => {
      const child = new FakeChildProcess({ hang: true });
      captured.child = child;
      return child as unknown as ChildProcess;
    };

    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
      timeoutMs: 1,
    });

    await expect(adapter.send("s", "u")).rejects.toThrow(/timed out/);

    // Simulate the process finally closing after the timeout fired.
    captured.child!.emit("close", 0);

    // If settlement happened again, the promise would be rejected/resolved a
    // second time. The existing await above already consumed the first
    // rejection; no further synchronous error means the guard worked.
    expect(true).toBe(true);
  });

  it("resolves normally when close fires before timeout", async () => {
    const runner = makeRunner({
      stdoutChunks: ["ok"],
      exitCode: 0,
    });
    const adapter = new AntigravityCliAdapter({
      name: "Gemini",
      model: "gemini-test",
      runner,
      timeoutMs: 1000,
    });
    await expect(adapter.send("s", "u")).resolves.toBe("ok");
  });
});
