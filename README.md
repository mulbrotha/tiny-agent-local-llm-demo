# Tiny-Agent

A minimal agentic AI loop built for learning. Understand how AI agents actually work — tool calling, context management, and the reasoning loop — by reading ~300 lines of TypeScript.

Toggle between **local** (Ollama) and **cloud** (Anthropic Claude) to see where local models break down on complex tool-calling tasks.

## The Agent Loop

This is the entire concept:

```
User prompt → LLM thinks → Picks a tool → Executes → Result fed back → LLM thinks again → ... → Final answer
```

That's it. Every AI coding agent (Cursor, Copilot, OpenCode, Claude Code) is this loop with more tools and polish.

## Quick Start

```bash
# Install dependencies
npm install

# Run with Ollama (local — free, private)
npm run local

# Run with Claude (cloud — smarter, costs money)
ANTHROPIC_API_KEY=sk-ant-... npm run cloud
```

### Ollama Setup

```bash
# Install Ollama: https://ollama.com
# Pull a model with tool-calling support. like:
ollama pull qwen2.5-coder:7b

# Or try a bigger model for better tool calling
ollama pull qwen2.5-coder:14b

# Or just use a newer version
ollama pull qwen3-coder:latest
```

### Custom Model

```bash
OLLAMA_MODEL=llama3.1 npm run local
```

## Architecture

```
src/
├── agent.ts       # The agent loop + interactive REPL (~120 lines)
├── providers.ts   # Ollama & Anthropic behind same interface (~180 lines)
└── tools.ts       # Tool schemas + executors (~100 lines)
```

### Key Concepts to Study

| Concept | Where to look | What to notice |
|---------|--------------|----------------|
| **Agent loop** | `agent.ts` → `runAgent()` | The while loop — call LLM, check for tool calls, execute, repeat |
| **Tool schemas** | `tools.ts` → `toolSchemas` | JSON schemas the LLM uses to decide *what* to call and *how* |
| **Tool execution** | `tools.ts` → `executeTool()` | Simple dispatch — name → function → string result |
| **Context management** | `agent.ts` → `history` array | Every message (user, assistant, tool results) builds up context |
| **Provider abstraction** | `providers.ts` → `Provider` interface | Same loop, different LLM — swap with one env var |
| **Message format differences** | `providers.ts` | Ollama uses OpenAI format, Anthropic uses its own — compare them |

## Demo Strategy: 3 Layers of Comparison

The demo uses THREE tools to tell the story ; from "I built this" to "production-grade":

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Tiny-Agent (Ollama)    — local model, your code   │
│  Layer 2: Tiny-Agent (Claude)    — cloud model, your code   │
│  Layer 3: OpenCode (Ollama)   — local model, pro agent      │
└─────────────────────────────────────────────────────────────┘
```

This lets you show:
- **Tiny-Agent local vs cloud** → same code, different LLM → proves the MODEL matters
- **Tiny-Agent vs OpenCode** → same LLM, different agent → proves the AGENT code matters
- **All three together** → the full picture of what's possible locally

### Demo 1: Simple Task — "Count functions in a file"
```

# Tiny-Agent (Ollama) — should handle it
npm run local
> How many functions are in src/tools.ts?

# Tiny-Agent (Claude) — should handle it faster/cleaner
npm run cloud
> How many functions are in src/tools.ts?

# OpenCode — show it doing the same task with its richer toolset
opencode
> How many functions are in src/tools.ts?
```
All three should succeed. Point: the agent loop works everywhere.

### Demo 2: Multi-Step — "Find the biggest file"
```
> What's the largest file in this project by line count?
```
Requires chaining: list_dir → run_command (wc -l) → compare.
- Tiny-Agent (Ollama): may fumble tool chaining or hallucinate
- Tiny-Agent (Claude): clean multi-step execution
- OpenCode: handles it smoothly with more tools available

### Demo 3: Complex Reasoning — "Refactor suggestion"
```
> Read src/providers.ts and suggest how to reduce code duplication between the two providers.
```
This is the "aha moment":
- Tiny-Agent (Ollama): can read the file but reasoning may be shallow
- Tiny-Agent (Claude): strong analysis, concrete suggestions
- OpenCode (Ollama): better than raw Tiny-Agent Ollama (more context), but still limited by model

### Demo 4 (Optional): "Actually do it"
```
> Refactor providers.ts to extract a shared base class. Write the new code.
```
- Tiny-Agent: doesn't have a write_file tool (on purpose — show the limitation)
- OpenCode: can actually edit the file, run tests, iterate — full agentic coding

## What to Benchmark

| Metric | Tiny-Agent (Ollama) | Tiny-Agent (Claude) | OpenCode (Ollama) |
|--------|------------------|-------------------|-------------------|
| **Accuracy** | ? | ? | ? |
| **Tool-call correctness** | ? | ? | ? |
| **Iterations** | ? | ? | ? |
| **Tokens used** | ? | ? | ? |
| **Latency** | ? | ? | ? |
| **Cost** | $0 | ~$0.01-0.05/task | $0 |
| **Data leaves machine?** | ❌ No | ✅ Yes | ❌ No |

Fill this out during your dry run — the numbers tell the story.

## Presentation Flow (15-20 min)

### Act 1: The Hook (2 min)
"What if your code never left your machine?"
- Cloud AI assistants are powerful, but every line of code goes to someone else's server
- At Amex, that's a hard stop for many use cases
- Today I'll show you how agentic AI works under the hood — and what running it locally looks like

### Act 2: How Agents Work (5 min) — *code walkthrough*
- Open `agent.ts` — walk through the loop (it's 211 lines, the diagram is right at the top)
- Show `tools.ts` — "this is what the LLM sees" (tool schemas) vs "this is what runs" (executors)
- Show `providers.ts` — "same interface, two different LLMs behind it"
- Key insight: every agent you've heard of — Cursor, Copilot, Claude Code, OpenCode — is this loop with more tools

### Act 3: Live Demo (7 min) — *the showstopper*
Run Demo 1 through Demo 3 across all three layers:
1. **Tiny-Agent + Ollama** → "Look, a local model calling tools from my code"
2. **Tiny-Agent + Claude** → "Same code, swap the provider — watch the difference"
3. **OpenCode + Ollama** → "Now a production agent, still fully local"
4. Show the benchmark table — fill in numbers live

### Act 4: The Tradeoffs (3 min)
- Security/privacy: no data leaves your machine with local
- Cost: $0/month vs API pricing
- Capability gap: local models struggle with complex tool chaining and reasoning
- Hardware: need a decent GPU for larger models

### Act 5: Decision Framework (2 min)
| Use Case | Recommendation |
|----------|---------------|
| Sensitive codebases | Local (Ollama + OpenCode) |
| Complex refactoring | Cloud API (Claude) |
| Learning / prototyping | Local (free, fast iteration) |
| Production agent workflows | Cloud or hybrid |

"They're complementary, not competing."

### Q&A (remaining time)

## License

May 04 - 08,2026  — built for 5+learning.
