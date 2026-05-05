"use strict";
// Thin OpenAI wrapper for Library-AI text generation.
//
// Uses gpt-4o-mini (same model the marketing generator uses) — quality is
// plenty for parenting-content writing, cost is ~₹0.10 / 1K-token article.
// Returns a parsed JSON object; the caller declares the expected shape and
// does any further validation. Never throws on API non-200; instead returns
// `null` so the cron loop can skip and continue.
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatJson = chatJson;
exports.estimateOpenAiInr = estimateOpenAiInr;
const integrationConfig_1 = require("../lib/integrationConfig");
/** Run a JSON-mode chat completion. Returns parsed JSON or null on any failure. */
async function chatJson(messages, opts = {}) {
    const cfg = await (0, integrationConfig_1.getIntegrationConfig)();
    if (!cfg.openai.apiKey) {
        console.warn('[library/openai] openai.apiKey not set');
        return null;
    }
    const model = opts.model ?? 'gpt-4o-mini';
    const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.8;
    const max_tokens = typeof opts.maxTokens === 'number' ? opts.maxTokens : 1500;
    let res;
    try {
        res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.openai.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                response_format: { type: 'json_object' },
                temperature,
                max_tokens,
            }),
        });
    }
    catch (e) {
        console.warn('[library/openai] network error', e);
        return null;
    }
    if (!res.ok) {
        console.warn(`[library/openai] ${res.status}: ${await res.text().catch(() => '')}`);
        return null;
    }
    const data = (await res.json().catch(() => ({})));
    const raw = data?.choices?.[0]?.message?.content ?? '';
    try {
        return JSON.parse(raw);
    }
    catch {
        console.warn('[library/openai] non-JSON content:', raw.slice(0, 240));
        return null;
    }
}
/** Estimate INR cost of a gpt-4o-mini completion based on rough token totals. */
function estimateOpenAiInr(maxTokens) {
    // gpt-4o-mini: ~$0.15/M input, $0.60/M output. Round up assuming 70% output tokens.
    // 1500 max-tokens → ~$0.0006 → ~₹0.05.
    const usdPerToken = 0.6 / 1000000;
    return Math.max(0.02, maxTokens * usdPerToken * 0.7 * 86); // 86 INR/USD rough
}
