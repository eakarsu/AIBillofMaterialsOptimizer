require('dotenv').config({ path: '../.env' });

/**
 * 4-strategy AI JSON parser:
 *  1. Pass-through if already object
 *  2. Direct JSON.parse on full content
 *  3. Strip markdown fences, parse again
 *  4. Extract first {…} block by index
 * Falls back to { raw_response } when none succeed.
 */
function parseAIJson(text) {
  if (text && typeof text === 'object') return text;
  if (typeof text !== 'string') return { raw_response: String(text ?? '') };

  try { return JSON.parse(text); } catch {}

  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  return { raw_response: text };
}

async function queryOpenRouter(prompt, systemPrompt = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your .env file.';
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'BOM Optimizer',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated';
}

/**
 * Best-effort persistence to ai_results JSONB table.
 */
async function persistAIResult(pool, { feature, entity_type, entity_id, user_email, request_payload, response }) {
  if (!pool) return null;
  try {
    const r = await pool.query(
      `INSERT INTO ai_results (feature, entity_type, entity_id, user_email, request_payload, response)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [feature, entity_type || null, entity_id || null, user_email || null,
       request_payload ? JSON.stringify(request_payload) : null,
       response ? JSON.stringify(response) : null]
    );
    return r.rows[0];
  } catch {
    return null;
  }
}

module.exports = { queryOpenRouter, parseAIJson, persistAIResult };
