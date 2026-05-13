# Cloud Agents with MCP — Setup Guide

How to configure OpenCode with cloud providers and enable MCP servers per agent for extended tool access.

---

## What This Covers

The local agent setup works well for routine coding, but cloud models bring speed, larger context, and better reasoning. MCP (Model Context Protocol) extends agents with external tools — databases, APIs, file systems, search — scoped per agent so each one gets exactly the tools it needs.

---

## 1. Cloud Provider Configuration

### Basic Setup

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "apiKey": "{env:ANTHROPIC_API_KEY}"
    },
    "openai": {
      "apiKey": "{env:OPENAI_API_KEY}"
    }
  },
  "model": "anthropic/claude-sonnet-4-5"
}
```

The `model` field uses `provider/model-id` syntax. Run `/models` in the TUI to see all available models from configured providers.

### Combining Cloud + Local Providers

You can keep the local Ollama provider alongside cloud providers and switch per agent:

```json
{
  "provider": {
    "anthropic": {
      "apiKey": "{env:ANTHROPIC_API_KEY}"
    },
    "openai": {
      "apiKey": "{env:OPENAI_API_KEY}"
    },
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": {
        "qwen3-coder": { "name": "Qwen3-Coder (local)" }
      }
    }
  }
}
```

---

## 2. MCP Server Configuration

MCP servers are defined under the `mcp` key in `opencode.json`. Each server gets a unique name that prefixes its tools (`servername_toolname`).

### Local MCP Servers (stdio)

These run as child processes. The `command` must be an **array** (not a string).

```json
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/mulai/projects"],
      "enabled": true
    },
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "enabled": true,
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_TOKEN}"
      }
    },
    "brave-search": {
      "type": "local",
      "command": ["npx", "-y", "@brave/brave-search-mcp-server"],
      "enabled": true,
      "environment": {
        "BRAVE_API_KEY": "{env:BRAVE_API_KEY}"
      }
    },
    "sqlite": {
      "type": "local",
      "command": ["uvx", "mcp-server-sqlite", "--db-path", "db.sqlite"],
      "enabled": true
    }
  }
}
```

### Remote MCP Servers (HTTP/SSE)

These connect to external services. OAuth is handled automatically for most providers.

```json
{
  "mcp": {
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    },
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "{env:CONTEXT7_API_KEY}" }
    },
    "gh_grep": {
      "type": "remote",
      "url": "https://mcp.grep.app"
    }
  }
}
```

---

## 3. Per-Agent MCP Scoping

By default, all MCP servers are available to all agents. To scope tools to specific agents, use a two-step pattern: disable globally, enable per agent.

### Pattern: Disable Globally, Enable Per Agent

```json
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "enabled": true,
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/mulai/projects"],
      "enabled": true
    },
    "brave-search": {
      "type": "local",
      "command": ["npx", "-y", "@brave/brave-search-mcp-server"],
      "enabled": true,
      "environment": { "BRAVE_API_KEY": "{env:BRAVE_API_KEY}" }
    }
  },
  "tools": {
    "github*": false,
    "filesystem*": false,
    "brave-search*": false
  },
  "agent": {
    "coder": {
      "tools": {
        "github*": true,
        "filesystem*": true
      }
    },
    "test-writer": {
      "tools": {
        "filesystem*": true
      }
    },
    "review": {
      "tools": {
        "github*": true,
        "brave-search*": true
      }
    }
  }
}
```

### Alternative: Using Permissions

The `permission` system supports the same pattern with `allow`/`deny`/`ask`:

```json
{
  "permission": {
    "github*": "deny",
    "filesystem*": "deny"
  },
  "agent": {
    "coder": {
      "permission": {
        "github*": "allow",
        "filesystem*": "allow"
      }
    }
  }
}
```

This way:
- **@coder** gets GitHub + filesystem access
- **@test-writer** only gets filesystem access (to read/write test files)
- **@review** gets GitHub + search but not filesystem (read-only)
- **Default/build agent** gets none of the MCP tools

---

## 4. Complete Example: Multi-Agent Cloud Setup with MCP

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "apiKey": "{env:ANTHROPIC_API_KEY}"
    },
    "openai": {
      "apiKey": "{env:OPENAI_API_KEY}"
    }
  },
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "enabled": true,
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/mulai/projects"],
      "enabled": true
    },
    "brave-search": {
      "type": "local",
      "command": ["npx", "-y", "@brave/brave-search-mcp-server"],
      "enabled": true,
      "environment": { "BRAVE_API_KEY": "{env:BRAVE_API_KEY}" }
    },
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    },
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "@anthropic/mcp-server-postgres", "postgresql://localhost:5432/mydb"],
      "enabled": true
    }
  },
  "tools": {
    "github*": false,
    "filesystem*": false,
    "brave-search*": false,
    "sentry*": false,
    "postgres*": false
  },
  "agent": {
    "coder": {
      "tools": {
        "github*": true,
        "filesystem*": true,
        "postgres*": true
      }
    },
    "test-writer": {
      "tools": {
        "filesystem*": true
      }
    },
    "review": {
      "tools": {
        "github*": true,
        "brave-search*": true,
        "sentry*": true
      }
    },
    "refactor": {
      "tools": {
        "filesystem*": true
      }
    }
  }
}
```

---

## 5. MCP Auth Management

```bash
# Authenticate with an OAuth-based MCP server
opencode mcp auth sentry

# List all servers and auth status
opencode mcp list

# Debug connection issues
opencode mcp debug sentry

# Remove stored credentials
opencode mcp logout sentry
```

---

## 6. Per-Agent Models

Each agent can also use a different model, not just different tools:

```json
{
  "agent": {
    "coder": {
      "model": "anthropic/claude-sonnet-4-5",
      "tools": { "github*": true }
    },
    "test-writer": {
      "model": "openai/gpt-4.1",
      "tools": { "filesystem*": true }
    },
    "review": {
      "model": "ollama/qwen3-coder",
      "tools": { "github*": true }
    }
  }
}
```

---

## 7. Caveats and Notes

- **MCP tools consume context tokens** — every tool exposed by an MCP server adds to the context. Enable only what each agent needs.
- **npx needs `-y`** — without it, interactive prompts cause silent failures.
- **Use `{env:VAR}` for secrets** — never hardcode API keys in config.
- **Restart OpenCode** after changing MCP configuration — it reads config at startup.
- **Configs merge** across global (`~/.config/opencode/opencode.json`) and project (`opencode.json`) levels. You can define shared MCP servers globally and override per project.
- **The root key is `mcp`** not `mcpServers` (legacy format, may still work but not canonical).

---

## 8. Quick Comparison

| Aspect | Local Agents | Cloud Agents + MCP |
|--------|-------------|-------------------|
| Cost | Free (one-time HW) | ~$20/mo per seat |
| Speed | Slow (10-30s) | Fast (1-3s) |
| Context | 32k limited | 100k-200k |
| Privacy | Full local | Data leaves machine |
| Tools | Built-in only | Built-in + MCP servers |
| Offline | Yes | No |
| Setup complexity | Moderate | Low (API key only) |
