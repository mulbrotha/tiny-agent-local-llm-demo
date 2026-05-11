# Exploring Local Agents with OpenCode — A Technical Deep Dive

A personal writeup on running local AI agents using OpenCode, the tradeoffs vs. cloud providers, and what I learned along the way.

---

## What This Is

This is a documentation of my experience setting up and using local agents with OpenCode — what works, what doesn't, and where local agents still fall short of cloud alternatives. The goal was to evaluate whether local models can replace cloud-based coding assistants without sacrificing capability.

---

## Local vs Cloud at a Glance

| Dimension | Local (OpenCode + qwen3-coder 14B) | Cloud (Claude / GPT-class) |
|-----------|------------------------------------|----------------------------|
| Cost | One-time model download, $0 ongoing | ~$20/mo per seat |
| First response | 10–30s | 1–3s |
| Tool-calling reliability | Occasional malformed JSON | Reliable |
| Context window | 32k (configurable, RAM-bound) | 200k+ |
| Vision / multimodal | Not in the coding models I tested | Yes |
| Offline | Yes | No |
| Privacy | Code never leaves the machine | Sent to provider |

The rest of this writeup explains how I arrived at these numbers and where the tradeoffs hurt or help.

---

## What is OpenCode-ai?

OpenCode is an open-source ai coding agent that runs as a terminal TUI, a Desktop app or an IDE extension. It is a provider-agnostic alternative to Claude Code. It is not coupled to any single provider; it works with Claude, OpenAi, Google Gemini, local models via Ollama and other providers.

### The key capabilities
- **Plan & Build modes**: In Plan mode, OpenCode drafts what it intends to do before touching any files. You review the plan, then switch to Build mode to execute. This two-step approach reduces unwanted changes.
- **Full Agentic tooling**: The agent can read, write, and edit files, run shell commands, search via grep/glob, and surface LSP diagnostics, all without you manually copying code back and forth.
- **Privacy First**: OpenCode does not store any of your code or context data, so it can operate in privacy-sensitive environments.
- **MCP support**: It supports the Model Context Protocol for connecting to external tools and services.
- **Custom Commands**: reusable prompts stored as Markdown files per-user or per-project.

---
## The Setup

### Stack
- **Orchestrator**: OpenCode (opencode-ai)
- **Backend**: Ollama (started with this, later tested LM Studio)
- **Model tested**: qwen3-coder 14B (primary), llama3.1 8B (comparison)
- **Hardware**: M-series Mac with 16GB RAM (My Personal use)

### What Agents Look Like

Each agent is a markdown file with YAML frontmatter in `.opencode/agents/`. I created four:

| Agent | System Prompt Core | Permission Model |
|-------|-------------------|-----------------|
| **@coder** | General dev assistant | Full read/edit/bash |
| **@test-writer** | Vitest + Testing Library specialist | Full read/edit/bash |
| **@refactor** | Hook extraction, component decomposition | Full read/edit/bash |
| **@review** | Pre-commit code reviewer | Read-only |

The permission system is a nice touch — each agent gets exactly the tool access it needs, no more. The review agent, for example, has `bash: deny` and `edit: deny`, so it can look at code but never modify it.

### Final Configuration

After iterating through Ollama and several models, this is what I converged on:

| Component | Choice |
|-----------|--------|
| **Backend** | LM Studio |
| **Model** | qwen3-coder 14B (Q8 quantized) |
| **Context window** | 32768 tokens |
| **Timeout** | 600000ms |
| **Agents** | coder, test-writer, refactor, review |

The why behind each of these choices is in the sections below.

---

## What Works Well

### No API Costs, No Rate Limits

Once the model is downloaded (~9GB for qwen3-coder), there are zero recurring costs. Cloud coding assistants charge ~$20/month per seat. More importantly, there are no rate limits — I can call agents repeatedly without hitting a paywall or getting throttled.

### Full Offline Operation

No internet required. This is useful during a flight or a subway commute where you can continued working on the codebase without interruption. Cloud-based tools would have been completely unavailable.

### Data Privacy

Every prompt, every file read, every code change — all stays on the machine. For projects with sensitive code that shouldn't hit third-party APIs, this is a significant advantage.

### Custom Agent Behavior

The agent system prompt is fully controllable. You can bake in project-specific conventions directly:

```yaml
---
description: Writes tests using Vitest + Testing Library
mode: subagent
model: ollama/qwen3-coder
permission:
  read: allow
  edit: allow
  bash: allow
---
You are a test engineer. The project uses Vitest with @testing-library/react.
- Write tests in __tests__/ mirroring src/
- Use describe/it/expect from vitest
- Use render/screen from @testing-library/react
- Always run `pnpm test:run` to verify tests pass
```

This level of specialization means the agent produces output that follows existing code patterns without me having to repeat context.

---

## Where Local Agents Fall Short

### Tool-Calling Reliability

This was the biggest pain point. smaller models llama3.1 8B and anything under it consistently hallucinate tool names or produce malformed JSON. Common failure modes:

- **Wrong tool names**: Model calls `todonext` or `apply_code` instead of the actual tool names
- **Malformed JSON**: Missing keys, extra brackets, string vs. number type errors
- **XML instead of JSON**: Some models default to XML tool format that OpenCode doesn't understand

A representative failure I hit with llama3.1 8B asking it to edit a file:

```jsonc
// What OpenCode expects:
{ "name": "edit", "arguments": { "path": "src/foo.ts", "old": "...", "new": "..." } }

// What the model produced:
{ "name": "apply_code", "arguments": "src/foo.ts: rename foo to bar" }
```

Wrong tool name, and `arguments` is a free-form string instead of an object — OpenCode rejects it, the model retries, often with the same mistake, and the agent loops.

**qwen3-coder 14B handled this significantly better** than smaller models, but it still occasionally produced invalid tool calls, especially as context grew.

### Speed

Local inference is noticeably slower than cloud APIs. A typical interaction takes 10-30 seconds for the first response, vs. 1-3 seconds for GPT-4 or Claude. The `timeout: 600000` setting in opencode.json is essential — without it, requests time out before the model finishes generating.

On CPU-only setups, this becomes unusable. GPU acceleration (Metal on Mac, CUDA on Linux) is a hard requirement.

### Context Window Limitations

Ollama defaults to **4096 tokens** of context. For agentic tasks that involve reading multiple files and making sequential tool calls, this fills up almost immediately. The model "forgets" earlier context and starts repeating tool calls in an infinite loop.

The fix is straightforward but easy to miss:
```bash
ollama run qwen3-coder
/set parameter num_ctx 32768
/save qwen3-coder
```

Even with 32k tokens, context fills up faster than with cloud models. The agent eventually loses track of what file it was editing or what step it was on.

### Backend Fragmentation

The local LLM ecosystem has multiple backends, none of which fully match the OpenAI API spec:

| Backend | Issue |
|---------|-------|
| **Ollama** | Streaming tool_calls handling differs; empty `tool_calls[]` causes infinite loops |
| **LM Studio** | Better compliance, but setup is more involved |
| **llama.cpp** | Best performance, but requires building from source |

I had to switch from Ollama to LM Studio to resolve persistent empty tool_calls issues. Each switch meant reconfiguring `opencode.json` and verifying everything worked.

### No Vision / Multimodal

Local models lack vision capabilities. Cloud coding assistants can analyze screenshots, UI mockups, or architecture diagrams. If your workflow involves visual context, local models can't compete.

### Model Size vs. Capability Tradeoff

| Model | Params | Size | RAM | Tool Calls | Code Quality |
|-------|--------|------|-----|------------|-------------|
| `qwen3-coder` | 14B | ~9GB | 16GB+ | Reliable | Good |
| `llama3.1` | 8B | ~4.6GB | 8GB+ | Unreliable | Okay |
| `llama3.2` | 3B | ~2GB | 4GB+ | Fails | Poor |

The 14B model is the minimum viable option for agentic coding. Below that, tool-calling accuracy is too low to be productive. But 14B models need 16GB+ RAM, which rules out many developer laptops.

---

## Key Lessons Learned

### 1. Context Window Is Everything
Small context = agent loops forever. 32k tokens is the minimum; 64k+ would be better. This is the single most impactful configuration setting.

### 2. Model Selection Matters More Than Backend
qwen3-coder 14B is noticeably better than llama3.1 8B at tool calling. Trying to save disk space by using smaller models is a false economy — they fail too often to be useful.

### 3. Local Is Not a Drop-In Replacement for Cloud
Local agents are best for:
- Routine coding tasks (write tests, refactor components, explain code)
- Projects with sensitive/private code
- Offline work sessions

Cloud agents are still better for:
- Complex multi-file refactors requiring large context
- Understanding unfamiliar codebases (faster first response)
- Tasks that benefit from visual context (screenshots, diagrams)

### 4. Documentation Is Critical
The setup has many gotchas (context window, timeouts, empty tool_calls). Having a documented setup process (like the AGENTS.md in this project) saves significant time when onboarding new developers.

---

## Verdict

Local agents with OpenCode are a viable, cost-effective alternative when privacy, offline access, or per-seat cost matter — and when 10–30s first-response latency is acceptable. They are not yet a replacement for cloud assistants when speed and tool-calling reliability are the priority.

For me, the setup is good enough for daily use on routine tasks, and the cost savings are real. I reach for cloud assistants when I need to work through complex problems quickly, and use local agents for everything else.
