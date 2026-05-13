# Using Local Agents with OpenCode

A step-by-step guide to creating and using local AI agents in your opencode projects.

---

## Table of Contents

1. [What Are Local Agents?](#what-are-local-agents)
2. [Prerequisites](#prerequisites)
3. [Setting Up a Local LLM Backend](#setting-up-a-local-llm-backend)
4. [Configuring opencode.json](#configuring-opencodejson)
5. [Creating a Local Agent](#creating-a-local-agent)
6. [Using Your Agent](#using-your-agent)
7. [Troubleshooting](#troubleshooting)

---

## What Are Local Agents?

Local agents are specialized AI assistants defined per-project in `.opencode/agents/` directory. They run on your machine using local LLMs (via Ollama, LM Studio, llama.cpp, etc.) — no cloud API costs, no data leaving your computer.

**Use cases:**
- A "coder" agent for general development
- A "test-writer" agent for writing tests
- A "refactor" agent for code cleanup
- A "review" agent for code review

---

## Prerequisites

- OpenCode installed (`npm install -g opencode-ai`)
- A local LLM backend (Ollama recommended for beginners)
- A project with an `opencode.json` config file

---

## Setting Up a Local LLM Backend

### Option 1: Ollama (Recommended for beginners)

```bash
# Install
brew install ollama          # macOS
# or: curl -fsSL https://ollama.com/install.sh | sh  # Linux

# Start the server (keep this terminal running)
ollama serve

# Pull a coding model (in another terminal)
ollama pull qwen3-coder      # ~9GB, best for coding (14B params)
# Alternatives:
# ollama pull llama3.1       # ~4.6GB, good all-round (8B params)
# ollama pull deepseek-coder-v2  # ~8GB, excellent coding (16B params)

# Verify
ollama list
```

> **Tip:** Increase the context window. Ollama defaults to 4096 tokens, which is too small:
> ```bash
> ollama run qwen3-coder
> /set parameter num_ctx 32768
> /save qwen3-coder
> ```

### Option 2: LM Studio (Better API compatibility)

Download from [lmstudio.ai](https://lmstudio.ai), load a model, and start the local inference server (default: `http://127.0.0.1:1234/v1`).

### Option 3: llama.cpp (Best performance)

```bash
# Clone and build llama.cpp, then run:
llama-server -m <model-file>.gguf --port 8080
```

---

## Configuring opencode.json

Create `opencode.json` in your project root to connect OpenCode to your local backend:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": {
        "baseURL": "http://localhost:11434/v1",
        "timeout": 600000
      },
      "models": {
        "qwen3-coder": {
          "name": "Qwen3-Coder (local)",
          "limit": {
            "context": 32768,
            "output": 4096
          }
        }
      }
    }
  }
}
```

For LM Studio, change `baseURL` to `http://127.0.0.1:1234/v1`.
For llama.cpp, change `baseURL` to `http://127.0.0.1:8080/v1`.

The `timeout` field prevents premature timeouts (local models are slower than cloud APIs).

---

## Creating a Local Agent

### Step 1: Create the agents directory

```bash
mkdir -p .opencode/agents
```

### Step 2: Create an agent file

Create `.opencode/agents/<name>.md` with a YAML frontmatter block and a system prompt:

```yaml
---
description: What this agent does (appears in @-mention menu)
mode: subagent              # subagent — invoked via @name, primary — Tab-accessible
model: ollama/qwen3-coder   # which model to use (optional, defaults to primary model)
permission:
  read: allow               # tool permissions: allow, ask, deny
  edit: allow
  bash: allow
  glob: allow
  grep: allow
  webfetch: deny
  websearch: deny
---
You are a <role>. Follow these rules:
- Rule 1
- Rule 2
<!-- The system prompt below the frontmatter defines the agent's behavior -->
```

### Step 3: Define tool permissions

Each permission key controls a set of tools:

| Key        | Tools controlled                        |
|------------|-----------------------------------------|
| `read`     | `read`                                  |
| `edit`     | `write`, `edit`, `apply_patch`          |
| `glob`     | `glob`                                  |
| `grep`     | `grep`                                  |
| `bash`     | `bash`                                  |
| `task`     | `task`                                  |
| `webfetch` | `webfetch`                              |
| `websearch`| `websearch`                             |

Values: `"allow"` (runs without asking), `"ask"` (prompts you), `"deny"` (disabled).

### Complete agent example

```yaml
---
description: Writes tests using Vitest + Testing Library
mode: subagent
model: ollama/qwen3-coder
permission:
  read: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
---
You are a test engineer. The project uses Vitest with @testing-library/react.
- Write tests in __tests__/ mirroring src/
- Use describe/it/expect from vitest
- Use render/screen from @testing-library/react
- Always run `pnpm test:run` to verify tests pass
```

---

## Using Your Agent

### Method 1: @-mention (Subagents)

In the OpenCode TUI, type `@` followed by the agent name:

```
@coder explain how the cart store works
@test-writer write tests for the ProductCard component
@refactor break down the CheckoutInner component
```

### Method 2: Switch primary agent (Tab key)

Press **Tab** to cycle through primary agents. Subagents do not appear in the Tab cycle.

### Method 3: /models to set default model

Run `/models` in the TUI and select your local model (e.g. `Ollama (local) > Qwen3-Coder (local)`) to use it with the default Build agent.

---

## Selecting the Right Model

| Model | Params | Size | RAM Needed | Quality |
|-------|--------|------|------------|---------|
| `qwen3-coder` | 14B | ~9GB | 16GB+ | Best for coding |
| `deepseek-coder-v2` | 16B | ~8GB | 16GB+ | Excellent |
| `llama3.1` | 8B | ~4.6GB | 8GB+ | Good all-round |
| `llama3.2` | 3B | ~2GB | 4GB+ | Lightweight |
| `gpt-oss` | 20B | ~12GB | 24GB+ | Strong |
| `glm-4.7` | 9B | ~5GB | 12GB+ | Good tool calling |

General rule: **14B+ models** produce reliable tool calls. Models under 7B struggle with agentic tasks.

---

## Troubleshooting

### Agent calls wrong tool names / malformed JSON

**Problem:** The model hallucinates tool names (e.g. `todonext`) or produces invalid JSON.

**Solutions:**
- Use a model with good tool-calling (qwen3-coder 14B+, gpt-oss, glm-4.7)
- Increase context window to 32k+
- Use LM Studio or llama.cpp instead of Ollama

### Agent never produces output

**Problem:** OpenCode shows "Generating..." indefinitely.

**Solutions:**
- Set a longer `timeout` in opencode.json (e.g. 600000ms)
- Increase `OLLAMA_CONTEXT_LENGTH=32000`
- Upgrade Ollama to v0.15+
- Switch to LM Studio

### Agent loops calling the same tool

**Problem:** The agent keeps calling the same tool over and over.

**Solution:** Increase context window — the model forgets it already called the tool due to limited context.

### "Model tried to call unavailable tool" error

**Solution:** The model is using the wrong tool name. Switch to a model with better tool-calling accuracy (qwen3-coder, deepseek-coder-v2).

### Connection refused

**Solutions:**
- Verify `ollama serve` (or your backend) is running
- Check the `baseURL` in opencode.json matches your backend's address
- Confirm the model is downloaded: `ollama list`

### No models appear in /models list

**Solutions:**
- Verify `opencode.json` is in your project root
- Check the provider configuration syntax
- Run `ollama list` to confirm models exist

---

## Recommended Setup

| Component | Recommendation |
|-----------|---------------|
| **Backend** | LM Studio (better API compat) or Ollama (easier setup) |
| **Model** | `qwen3-coder` (14B or 30B) |
| **Context window** | 32k minimum |
| **Timeout** | 600000ms (10 minutes) |
| **Quantization** | Q8 over Q4 for better quality |
| **RAM requirement** | 16GB+ for reliable coding agents |
