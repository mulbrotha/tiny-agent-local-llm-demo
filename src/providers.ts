/**
 * Tiny-Agent — LLM Providers
 *
 * Both providers implement the same interface so the agent loop
 * doesn't care which one is running. This is the "toggle" —
 * swap providers with an env var and compare behavior.
 *
 *   PROVIDER=ollama    → local model via Ollama (OpenAI-compat API)
 *   PROVIDER=anthropic → Claude via Anthropic API
 */

import { toolSchemas } from "./tools.js";

// ── Shared Types ────────────────────────────────────────────────

export type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, string>;
};

export type LLMResponse = {
  text: string | null;
  toolCalls: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "error";
  rawTokens?: { input: number; output: number };
};

export interface Provider {
  name: string;
  chat(messages: Message[], systemPrompt: string): Promise<LLMResponse>;
}

// ── Ollama Provider (local) ─────────────────────────────────────

export class OllamaProvider implements Provider {
  name = "ollama (local)";
  private model: string;
  private baseUrl: string;

  constructor(
    model = process.env.OLLAMA_MODEL || "qwen3-coder:latest",
    baseUrl = "http://localhost:11434"
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async chat(messages: Message[], systemPrompt: string): Promise<LLMResponse> {
    // Ollama uses OpenAI-compatible /v1/chat/completions
    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            content: m.content,
            tool_call_id: m.tool_call_id,
          };
        }
        if (m.role === "assistant" && m.tool_calls?.length) {
          return {
              role: "assistant" as const,
              content: m.content || "",
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.input) },
            })),
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    // Convert our tool schemas to OpenAI function format
    const tools = toolSchemas.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        tools,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { text: `Ollama error: ${err}`, toolCalls: [], stopReason: "error" };
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const toolCalls: ToolCall[] = (msg?.tool_calls || []).map((tc: any) => ({
      id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      text: msg?.content || null,
      toolCalls,
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      rawTokens: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// ── Anthropic Provider (cloud) ──────────────────────────────────

export class AnthropicProvider implements Provider {
  name = "anthropic (cloud)";
  private model: string;
  private apiKey: string;

  constructor(model = "claude-sonnet-4-20250514") {
    this.model = model;
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (!this.apiKey) {
      console.warn(
        "⚠️  ANTHROPIC_API_KEY not set — cloud provider will fail."
      );
    }
  }

  async chat(messages: Message[], systemPrompt: string): Promise<LLMResponse> {
    // Convert to Anthropic message format
    const anthropicMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: m.tool_call_id,
              content: m.content,
            },
          ],
        };
      }
      if (m.role === "assistant" && m.tool_calls?.length) {
        const content: any[] = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
        return { role: "assistant" as const, content };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: toolSchemas,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        text: `Anthropic error: ${err}`,
        toolCalls: [],
        stopReason: "error",
      };
    }

    const data = await res.json();

    let text: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") text = block.text;
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    return {
      text,
      toolCalls,
      stopReason: data.stop_reason === "tool_use" ? "tool_use" : "end_turn",
      rawTokens: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    };
  }
}

// ── Factory ─────────────────────────────────────────────────────

export const createProvider = (): Provider => {
  const p = (process.env.PROVIDER || "ollama").toLowerCase();
  if (p === "anthropic" || p === "claude") return new AnthropicProvider();
  return new OllamaProvider(process.env.OLLAMA_MODEL);
};
