/**
 * Tiny-Agent — Tool Definitions
 *
 * These are the "hands" of the agent. The LLM sees the schemas
 * and decides which tool to call. We execute the tool and feed
 * the result back into the conversation.
 *
 * Three tools:
 *   read_file    — read a file from disk
 *   list_dir     — list files in a directory
 *   run_command  — execute a shell command
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

// ── Tool Schemas (what the LLM sees) ────────────────────────────

export const toolSchemas = [
  {
    name: "read_file",
    description:
      "Read the contents of a file at the given path. Returns the file text.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Absolute or relative file path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_dir",
    description:
      "List files and directories at the given path. Returns names with [DIR] or [FILE] prefix.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command and return stdout. Use for things like grep, wc, git status, etc. Do NOT use for destructive commands.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    },
  },
];

// ── Tool Executors (what actually runs) ─────────────────────────

type ToolInput = Record<string, string>;

const executors: Record<string, (input: ToolInput) => string> = {
  read_file({ path }) {
    try {
      return readFileSync(path, "utf-8");
    } catch (e: any) {
      return `ERROR: ${e.message}`;
    }
  },

  list_dir({ path }) {
    try {
      const entries = readdirSync(path);
      return entries
        .map((name) => {
          const full = join(path, name);
          try {
            const stat = statSync(full);
            return stat.isDirectory() ? `[DIR]  ${name}` : `[FILE] ${name}`;
          } catch {
            return `[????] ${name}`;
          }
        })
        .join("\n");
    } catch (e: any) {
      return `ERROR: ${e.message}`;
    }
  },

  run_command({ command }) {
    // Basic safety: block destructive commands
    const blocked = ["rm ", "rmdir", "mkfs", "dd ", "> /dev", "sudo"];
    if (blocked.some((b) => command.includes(b))) {
      return "ERROR: Command blocked for safety.";
    }
    try {
      return execSync(command, { encoding: "utf-8", timeout: 10_000 });
    } catch (e: any) {
      return `ERROR: ${e.message}`;
    }
  },
};

/**
 * Execute a tool by name. Returns the string result.
 */
export const executeTool = (name: string, input: ToolInput): string => {
  const fn = executors[name];
  if (!fn) return `ERROR: Unknown tool "${name}"`;
  return fn(input);
};
