# Local Models — Known Issues & Solutions

## 1. Poor Tool-Calling Accuracy

Models hallucinate tool names (e.g. `todonext`), output XML tags instead of JSON, or produce malformed tool calls.

**Symptoms:**
- "Model tried to call unavailable tool 'X'" — wrong tool name
- "SchemaError: Missing key" — malformed tool call JSON
- Subagent hangs or loops without completing tasks

**Solutions:**
- Use models specifically fine-tuned for tool calling: `qwen3-coder` (14B/30B), `gpt-oss`, `glm-4.5/4.7`, `minimax-m2`, `deepseek-coder-v2`
- Avoid models smaller than 7B parameters — they lack tool-calling capability

## 2. Default Context Window Too Small

Ollama defaults to **4096 tokens** — far too small for agentic coding tasks. Without enough context, the model "forgets" previous tool calls and loops.

**Solutions:**

Per-model fix:
```bash
ollama run qwen3-coder
/set parameter num_ctx 32768
/save qwen3-coder
```

Global fix (start Ollama with):
```bash
OLLAMA_CONTEXT_LENGTH=32000 ollama serve
```

Or configure in opencode.json:
```json
"qwen3-coder": {
  "name": "Qwen3-Coder (local)",
  "limit": { "context": 32768, "output": 4096 }
}
```

## 3. Empty `tool_calls` Array / Infinite Loops

Some local backends return `finish_reason: "tool_calls"` with an empty `tool_calls: []`, causing the agent to loop or hang indefinitely.

**Solutions:**
- Upgrade opencode to a version that treats empty tool_calls as a normal stop
- Switch to LM Studio or llama.cpp (more compliant OpenAI-compatible APIs)

## 4. Missing `description` in Bash Tool Calls

Local models sometimes omit the `description` field in bash tool calls, causing `"expected string, received undefined"` errors.

**Solution:**
- Upgrade opencode — recent versions handle missing descriptions gracefully

## 5. Timeouts

Local models can take a long time to respond, especially on CPU or with large context windows.

**Solution:**
- Increase timeout in `opencode.json`:
```json
"options": {
  "baseURL": "http://localhost:11434/v1",
  "timeout": 600000
}
```

## 6. Model Doesn't Support Tools At All

Not all models support tool calling — older models like `qwen2.5-coder`, `llama3.2:3b`, and some `deepseek-coder-v2` versions lack tool support.

**Solution:**
- Check a model's capabilities:
  ```bash
  ollama show <model>
  ```
  Look for `tools` under Capabilities
- Browse compatible models: https://ollama.com/search?c=tools

## 7. Ollama's OpenAI-Compatible API Is Not Fully Compatible

The `/v1` endpoints have subtle differences from OpenAI's spec — streaming tool_calls may not be recognized, context window limits not respected.

**Solutions:**
- Switch to **LM Studio** or **llama.cpp** which have more compliant APIs
- The opencode team recommends LM Studio over Ollama for local use

## 8. CPU-Only Mode (No GPU Acceleration)

Default Ollama installation may run on CPU only, making inference extremely slow.

**Solutions:**
- macOS: Ollama uses Metal automatically
- Linux: Install GPU-enabled version (`ollama-gpu` on Arch, or follow manual installation)
- Verify GPU is being used via `ollama ps` (shows running models)

## 9. Tool Calls Execute But Produce No Output

Model generates tool calls (edit/write) that show as executed but no files are actually modified.

**Solutions:**
- Increase context window to 32k+
- Use a larger model with better instruction following (14B+)

## 10. Model Shows "Generating" But Never Produces Output

Ollama model loads but opencode UI shows perpetual "Generating..." with nothing happening.

**Solutions:**
- Increase context length + timeout in opencode.json
- Upgrade Ollama to v0.15+ (many users report this fixes the issue)

## 11. User Message Content Arrives as Empty Array

Model cannot see the user's input because message formatting gets corrupted during transmission.

**Solution:**
- Switch to LM Studio or llama.cpp — this is an Ollama-specific compatibility issue

## 12. Session Loop — Agent Keeps Calling Tools Indefinitely

Local model keeps making the same tool call repeatedly, never completing the task.

**Solution:**
- Increase context window (small context causes the model to "forget" it already called the tool)
- Use `num_ctx` of at least 16k-32k

## Recommended Setup

| Component | Recommendation |
|-----------|---------------|
| **Model** | `qwen3-coder` (14B or 30B), `gpt-oss`, `glm-4.7` |
| **Min params** | 7B+ for basic, 14B+ for reliable tool calling |
| **Context window** | 32k minimum |
| **Backend** | LM Studio or llama.cpp over Ollama |
| **Timeout** | 600000 (10 minutes) |
| **Quantization** | Q8 over Q4 for better quality |
