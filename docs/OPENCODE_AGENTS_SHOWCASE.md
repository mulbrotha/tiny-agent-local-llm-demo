# OpenCode Agents Showcase — Local and Hybrid Patterns

A side-by-side walkthrough of the two agent patterns I use in this project: **local agents** for the hot path (cheap, private, offline) and **hybrid agents** that lean on cloud models + MCP for the harder 10% of tasks. Same `.opencode/agents/` markdown format for both — only the `model` field and the available tools change.

For deeper reference docs, see [AGENTS.md](AGENTS.md) (local agent inventory) and [CLOUD_AGENTS_WITH_MCP.md](CLOUD_AGENTS_WITH_MCP.md) (full MCP config reference).

---

## TL;DR

| Pattern | When to use | Cost | Tool reliability |
|---------|-------------|------|------------------|
| **Local agent** | Routine coding, tests, refactors, offline | $0 ongoing | OK with qwen3-coder 14B, weak below that |
| **Hybrid (cloud + MCP)** | Multi-file work, ticket/PR context, long tool chains | Cloud tokens only when invoked | Reliable; cloud models rarely malform JSON |

The setup keeps both kinds of agents in the same project — you pick which one to invoke per task.

---

## Pattern 1 — Local Agent

Local agents are markdown files in `.opencode/agents/` with YAML frontmatter pointing at an Ollama or LM Studio model. They handle tests, refactors, code review — work that benefits from being free, private, and instant-to-launch.

### Example: `@test-writer`

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

### Required `opencode.json` for local

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": {
        "qwen3-coder": { "name": "Qwen3-Coder (local)" }
      }
    }
  },
  "model": "ollama/qwen3-coder"
}
```

That's the entire local setup. No API keys, no remote dependencies. Just point at a running Ollama (or LM Studio with `baseURL: http://localhost:1234/v1`).

---

## Pattern 2 — Hybrid Agent (Cloud + MCP)

A hybrid agent uses the same agent file format but swaps in a cloud model and pulls in MCP tools for external context (Linear tickets, GitHub PRs, Sentry errors, a Postgres DB). It's the right answer for tasks where local tool-call reliability falls over — multi-file migrations, anything that needs to read context from outside the repo, or work where 32k tokens isn't enough.

### Example: `@architect`

```yaml
---
description: Complex multi-step tasks requiring reliable tool calling
mode: subagent
model: anthropic/claude-sonnet-4-5
permission:
  read: allow
  edit: allow
  bash: allow
---
You are a senior engineer working on multi-file changes. Plan before editing,
read related files for context, and run the test suite after changes.
- Use the `github` MCP tool to check open PRs touching the same files
- Use the `sentry` MCP tool to pull recent errors before a refactor
- Always run `pnpm test:run` and `pnpm lint` before reporting done
```

Structurally identical to `@test-writer` — only `model` and the system prompt's tool references change.

### MCP wiring in `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": { "apiKey": "{env:ANTHROPIC_API_KEY}" },
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": { "qwen3-coder": { "name": "Qwen3-Coder (local)" } }
    }
  },
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "enabled": true,
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_TOKEN}"
      }
    },
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    }
  },
  "tools": {
    "github*": false,
    "sentry*": false
  },
  "agent": {
    "architect": {
      "tools": { "github*": true, "sentry*": true }
    }
  }
}
```

Two things worth noting:
- **Local servers use `command` (stdio)**, remote servers use `url` (HTTP/SSE). OAuth is handled by `opencode mcp auth <server>`.
- **MCP tools are disabled globally and re-enabled per agent.** This keeps local agents lean (every exposed tool eats context tokens) and only gives `@architect` what it needs.

See [CLOUD_AGENTS_WITH_MCP.md](CLOUD_AGENTS_WITH_MCP.md) for the full per-agent tool-scoping pattern.

---

## Side-by-Side Comparison

| | Local (`@test-writer`) | Hybrid (`@architect`) |
|---|---|---|
| Model | `ollama/qwen3-coder` | `anthropic/claude-sonnet-4-5` |
| First response | 10–30s | 1–3s |
| Context window | 32k (configurable) | 200k |
| Tool reliability | OK on 14B, fails below | Reliable |
| External tools | Built-in only (read/edit/bash) | Built-in + MCP (GitHub, Sentry, …) |
| Cost per run | $0 | Cloud tokens |
| Works offline | Yes | No |

---

## How I Route Tasks Between Them

| Task | Agent | Model |
|------|-------|-------|
| Write tests for a new component | `@test-writer` | local qwen3-coder |
| Refactor a hook | `@refactor` | local qwen3-coder |
| Pre-commit review | `@review` | local qwen3-coder |
| Plan a multi-file migration | `@architect` | cloud claude-sonnet |
| Pull PR context + draft a fix | `@architect` (+ GitHub MCP) | cloud claude-sonnet |
| Investigate a production error | `@architect` (+ Sentry MCP) | cloud claude-sonnet |

The cloud agent runs a handful of times a day; everything else stays on-device. The result is closer to "best of both" than either approach on its own — local for the hot path, cloud + MCP for the complex 10%.

---

## Caveats

- **MCP tools cost context tokens** even when unused, so scope them per agent rather than enabling everything globally.
- **`npx` needs `-y`** in `command` arrays, otherwise interactive prompts cause silent failures.
- **Use `{env:VAR}` for secrets** — never hardcode API keys in `opencode.json`.
- **Restart OpenCode** after editing `opencode.json`; config is read at startup.
- **Configs merge** across `~/.config/opencode/opencode.json` (global) and project-level `opencode.json` — keep shared MCP servers global and project-specific tweaks local.
