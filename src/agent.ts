/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                       Tiny-Agent                             ║
 * ║                                                              ║
 * ║  A minimal agentic AI loop for learning how agents work.     ║
 * ║  Toggle between local (Ollama) and cloud (Anthropic) LLMs.   ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    npm run local              # Ollama (default)             ║
 * ║    npm run cloud              # Claude via Anthropic API     ║
 * ║    OLLAMA_MODEL=llama3.1 npm run local  # custom model       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * THE AGENT LOOP (this is what you're here to learn):
 *
 *   ┌──────────┐
 *   │  Prompt  │  ← user types a task
 *   └────┬─────┘
 *        │
 *   ┌────▼─────┐
 *   │  LLM     │  ← model reasons about what to do
 *   │  thinks  │
 *   └────┬─────┘
 *        │
 *   ┌────▼──────────┐    YES    ┌────────────┐
 *   │  Tool call?   │─────────▶│  Execute   │
 *   └────┬──────────┘          │  the tool  │
 *        │ NO                  └─────┬──────┘
 *        │                           │
 *   ┌────▼─────┐              ┌──────▼───────┐
 *   │  Done!   │              │ Feed result  │
 *   │  Print   │              │ back to LLM  │──┐
 *   │  answer  │              └──────────────┘  │
 *   └──────────┘                                │
 *        ▲                                      │
 *        └──────────────────────────────────────┘
 */

import * as readline from "readline";
import { createProvider, type Message } from "./providers.js";
import { executeTool } from "./tools.js";

// ── System Prompt ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Tiny-Agent, a helpful coding assistant with access to the local file system.

You can use tools to explore code, read files, list directories, and run shell commands.
When asked about a codebase, start by listing the directory structure, then read relevant files.

RULES:
- Always use tools to get real data. Never guess file contents.
- You can chain multiple tool calls to build up context before answering.
- When you have enough information, give a clear, concise answer.
- If a task requires multiple steps, do them one at a time.`;

// ── Config ──────────────────────────────────────────────────────

const MAX_ITERATIONS = 15; // safety net: prevent infinite loops

// ── The Agent Loop ──────────────────────────────────────────────

const runAgent = async (userMessage: string, history: Message[]) => {
  const provider = createProvider();

  // Add the new user message to history
  history.push({ role: "user", content: userMessage });

  let iterations = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log(`\n🤖 [${provider.name}] Thinking...\n`);

  // ── THE LOOP ──────────────────────────────────────────────
  // This is the core agentic pattern:
  // 1. Send conversation to LLM
  // 2. If LLM wants to use a tool → execute it, add result, repeat
  // 3. If LLM is done → break and show the answer

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Step 1: Call the LLM
    const response = await provider.chat(history, SYSTEM_PROMPT);

    // Track tokens for benchmarking
    if (response.rawTokens) {
      totalInputTokens += response.rawTokens.input;
      totalOutputTokens += response.rawTokens.output;
    }

    // Step 2: Check if we got tool calls
    if (response.stopReason === "tool_use" && response.toolCalls.length > 0) {
      // Save the assistant's message (with tool calls) to history
      history.push({
        role: "assistant",
        content: response.text || "",
        tool_calls: response.toolCalls,
      });

      // Execute each tool and add results to history
      for (const tc of response.toolCalls) {
        console.log(`  🔧 ${tc.name}(${JSON.stringify(tc.input)})`);

        const result = executeTool(tc.name, tc.input);

        // Truncate long results for display
        const preview =
          result.length > 200 ? result.slice(0, 200) + "..." : result;
        console.log(`  📄 ${preview}\n`);

        // Feed the tool result back to the LLM
        history.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        });
      }

      // Loop back → LLM will see the tool results and decide next step
      continue;
    }

    // Step 3: No tool calls → LLM is done, print the answer
    if (response.text) {
      console.log(`\n💬 ${response.text}`);
    }

    if (response.stopReason === "error") {
      console.log(`\n❌ Agent encountered an error.`);
    }

    // Save final assistant message
    history.push({ role: "assistant", content: response.text || "" });

    // Print stats
    console.log(
      `\n📊 Stats: ${iterations} iteration(s) | ${totalInputTokens} input tokens | ${totalOutputTokens} output tokens`
    );

    break;
  }

  if (iterations >= MAX_ITERATIONS) {
    console.log(`\n⚠️  Hit max iterations (${MAX_ITERATIONS}). Stopping.`);
  }

  return history;
};

// ── Interactive REPL ────────────────────────────────────────────

const main = async () => {
  const provider = createProvider();

  console.log(`
╔══════════════════════════════════════════════╗
║              Tiny-Agent                      ║
║  Agentic AI Loop — Learn by Doing            ║
╠══════════════════════════════════════════════╣
║  Provider: ${provider.name.padEnd(33)}║
║  Tools:    read_file, list_dir, run_command  ║
║  Type 'quit' to exit, 'switch' to toggle     ║
╚══════════════════════════════════════════════╝
  `);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let history: Message[] = [];

  const prompt = () => {
    rl.question("\n🧑 You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) return prompt();
      if (trimmed === "quit" || trimmed === "exit") {
        console.log("\n👋 Goodbye!\n");
        rl.close();
        return;
      }
      if (trimmed === "clear") {
        history = [];
        console.log("🗑️  Conversation cleared.");
        return prompt();
      }
      if (trimmed === "switch") {
        const current = process.env.PROVIDER || "ollama";
        const next = current === "ollama" ? "anthropic" : "ollama";
        process.env.PROVIDER = next;
        history = []; // clear history on switch (different message formats)
        console.log(`🔄 Switched to ${next}. Conversation cleared.`);
        return prompt();
      }

      try {
        history = await runAgent(trimmed, history);
      } catch (err: any) {
        console.error(`\n❌ Error: ${err.message}`);
      }

      prompt();
    });
  };

  prompt();
};

main();
