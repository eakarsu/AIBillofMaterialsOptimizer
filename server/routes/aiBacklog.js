// aiBacklog.js — pass-5 backlog implementation for AIBillofMaterialsOptimizer.
//
// Adds NEEDS-PRODUCT-DECISION endpoints from the audit backlog with
// reasonable defaults documented inline:
//   - POST /api/ai/rag-query      (RAG over BOM + saved playbooks)
//   - POST /api/ai/multi-agent     (multi-agent orchestration)
//   - GET/POST /api/ai/playbooks   (RAG corpus CRUD)
//   - GET/PUT  /api/whitelabel     (white-label / reseller branding)
//
// The retrieval step in /rag-query is an in-memory keyword/BM25-lite ranker
// over `ai_playbooks.body` rows + the user's BOM items so we do NOT take a
// new heavy dependency (no vector store).
//
// All AI endpoints emit `503 {"error":"AI provider not configured","missing":"OPENROUTER_API_KEY"}`
// when the key is absent.
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, persistAIResult } = require('../services/openrouter');

const router = express.Router();

// PRODUCT-DECISION: vector store deferred — using in-memory keyword scoring
// over `ai_playbooks` + BOM items.  Good enough for ~thousands of rows; can
// be swapped for pgvector / external store later without changing the API.
async function ensureBacklogTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_playbooks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT NOT NULL,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whitelabel_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE,
      brand_name TEXT NOT NULL DEFAULT 'AI BOM Optimizer',
      primary_color VARCHAR(16) NOT NULL DEFAULT '#1f6feb',
      logo_url TEXT,
      support_email TEXT,
      tenant_slug VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureBacklogTables();

router.use(auth);

function aiKeyMissing(res) {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    res.status(503).json({ error: 'AI provider not configured', missing: 'OPENROUTER_API_KEY' });
    return true;
  }
  return false;
}

// ─── Playbook CRUD (RAG corpus) ─────────────────────────────────────────────
router.get('/playbooks', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, tags, body, created_at, updated_at
       FROM ai_playbooks WHERE user_id = $1 OR user_id IS NULL
       ORDER BY updated_at DESC LIMIT 200`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/playbooks', async (req, res) => {
  try {
    const { title, body, tags } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });
    const r = await pool.query(
      `INSERT INTO ai_playbooks (user_id, title, tags, body)
       VALUES ($1,$2,$3,$4) RETURNING id, title, tags, created_at`,
      [req.user?.id || null, title, Array.isArray(tags) ? tags : [], body]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/playbooks/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM ai_playbooks WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING id`,
      [req.params.id, req.user?.id || null]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Playbook not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// In-memory keyword scorer (Jaccard-ish over tokens).  Adequate for stub.
function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}
function score(query, doc) {
  const q = new Set(tokenize(query));
  const d = tokenize(doc);
  if (!d.length || !q.size) return 0;
  let hits = 0;
  for (const t of d) if (q.has(t)) hits++;
  return hits / Math.sqrt(d.length);
}

// ─── POST /api/ai/rag-query — RAG over playbooks + BOM ─────────────────────
router.post('/rag-query', async (req, res) => {
  const { question, top_k = 6 } = req.body || {};
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'question is required' });
  if (aiKeyMissing(res)) return;

  try {
    let playbooks = [];
    try {
      const r = await pool.query(
        `SELECT id, title, tags, body FROM ai_playbooks WHERE user_id = $1 OR user_id IS NULL`,
        [req.user?.id || null]
      );
      playbooks = r.rows;
    } catch (_) {}

    let bomItems = [];
    try {
      const r = await pool.query(
        `SELECT id, part_number, part_name, manufacturer, supplier, category, unit_cost
         FROM bom_items LIMIT 500`
      );
      bomItems = r.rows;
    } catch (_) {}

    const bomDocs = bomItems.map(b => ({
      kind: 'bom_item',
      id: b.id,
      title: `${b.part_number} ${b.part_name}`,
      body: `${b.part_number} ${b.part_name} ${b.manufacturer || ''} ${b.supplier || ''} ${b.category || ''} unit_cost=${b.unit_cost}`,
    }));
    const pbDocs = playbooks.map(p => ({
      kind: 'playbook',
      id: p.id,
      title: p.title,
      body: `${p.title} ${(p.tags || []).join(' ')} ${p.body}`,
    }));

    const allDocs = [...pbDocs, ...bomDocs];
    const ranked = allDocs
      .map(d => ({ doc: d, s: score(question, d.body) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.max(1, Math.min(20, parseInt(top_k))));

    const context = ranked
      .map(r => `[${r.doc.kind}#${r.doc.id} ${r.doc.title}] ${r.doc.body.slice(0, 400)}`)
      .join('\n\n');

    const prompt = `Answer the user's question using ONLY the supplied context.  If the context is insufficient say so.  Cite source ids in square brackets.

Context:
${context || 'No matching context found.'}

Question: ${question}

Respond ONLY in JSON: {"answer":"...","citations":[{"kind":"playbook|bom_item","id":N,"why":"..."}],"confidence":"low|medium|high"}`;

    const raw = await queryOpenRouter(prompt, 'You are a BOM/supply-chain RAG assistant.  Always cite sources.');
    const data = parseAIJson(raw);
    await persistAIResult(pool, {
      feature: 'rag-query', entity_type: 'rag', entity_id: null,
      user_email: req.user?.email, request_payload: req.body, response: data,
    });
    res.json({ success: true, data, retrieved: ranked.length, top_sources: ranked.map(r => ({ kind: r.doc.kind, id: r.doc.id, title: r.doc.title, score: r.s })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ai/multi-agent — multi-agent orchestration (sequential) ─────
// PRODUCT-DECISION: agent topology = SEQUENTIAL chain of three specialists
// (procurement, compliance, finance) sharing a single shared context.
// Easier to reason about than a fully parallel debate; can be upgraded
// to a router/critic loop later.
router.post('/multi-agent', async (req, res) => {
  const { goal, context = {} } = req.body || {};
  if (!goal) return res.status(400).json({ error: 'goal is required' });
  if (aiKeyMissing(res)) return;

  const agents = [
    { name: 'procurement', system: 'You are a senior electronics procurement strategist. Focus on cost, lead-time, supplier diversification.' },
    { name: 'compliance',  system: 'You are a global RoHS/REACH/Conflict-Minerals compliance officer. Focus on regulatory risk and certification.' },
    { name: 'finance',     system: 'You are a CFO advisor. Focus on cash-flow, working capital, and ROI of recommended actions.' },
  ];

  try {
    const transcript = [];
    let sharedNotes = '';
    for (const agent of agents) {
      const prompt = `Goal: ${goal}\nContext: ${JSON.stringify(context).slice(0, 4000)}\nPrior notes from other agents:\n${sharedNotes || '(none yet)'}\n\nRespond ONLY in JSON: {"role":"${agent.name}","insights":["..."],"recommendations":["..."],"open_questions":["..."]}`;
      const raw = await queryOpenRouter(prompt, agent.system);
      const data = parseAIJson(raw);
      transcript.push({ agent: agent.name, response: data });
      sharedNotes += `\n[${agent.name}] ${(data.insights || []).join(' | ')}`;
    }

    // synthesizer
    const synthPrompt = `Goal: ${goal}\nAgent transcript:\n${JSON.stringify(transcript, null, 2)}\n\nProduce a unified plan.  JSON only: {"executive_summary":"...","action_plan":[{"step":N,"owner":"...","action":"...","rationale":"..."}],"risks":["..."],"kpis":["..."]}`;
    const rawSynth = await queryOpenRouter(synthPrompt, 'You are a chief of staff synthesising specialist input into a single executive plan.');
    const plan = parseAIJson(rawSynth);

    await persistAIResult(pool, {
      feature: 'multi-agent', entity_type: 'goal', entity_id: null,
      user_email: req.user?.email, request_payload: req.body, response: { transcript, plan },
    });
    res.json({ success: true, transcript, plan });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── White-label / reseller settings ───────────────────────────────────────
// PRODUCT-DECISION: per-user branding (single tenant per account).  Multi-
// tenant SaaS reseller hierarchy is deferred until a customer asks.  The
// table is keyed by user_id; default row is created on first read.
router.get('/whitelabel', async (req, res) => {
  // mounted under /api too via separate registration; keep here for grouping
  try {
    const uid = req.user?.id || null;
    const r = await pool.query(
      `SELECT id, brand_name, primary_color, logo_url, support_email, tenant_slug, updated_at
       FROM whitelabel_settings WHERE user_id = $1`,
      [uid]
    );
    if (r.rowCount === 0) {
      const ins = await pool.query(
        `INSERT INTO whitelabel_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING id, brand_name, primary_color, logo_url, support_email, tenant_slug, updated_at`,
        [uid]
      );
      return res.json(ins.rows[0] || { brand_name: 'AI BOM Optimizer', primary_color: '#1f6feb' });
    }
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/whitelabel', async (req, res) => {
  try {
    const uid = req.user?.id || null;
    const { brand_name, primary_color, logo_url, support_email, tenant_slug } = req.body || {};
    const r = await pool.query(
      `INSERT INTO whitelabel_settings (user_id, brand_name, primary_color, logo_url, support_email, tenant_slug, updated_at)
       VALUES ($1, COALESCE($2,'AI BOM Optimizer'), COALESCE($3,'#1f6feb'), $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET brand_name = COALESCE(EXCLUDED.brand_name, whitelabel_settings.brand_name),
           primary_color = COALESCE(EXCLUDED.primary_color, whitelabel_settings.primary_color),
           logo_url = EXCLUDED.logo_url,
           support_email = EXCLUDED.support_email,
           tenant_slug = EXCLUDED.tenant_slug,
           updated_at = NOW()
       RETURNING id, brand_name, primary_color, logo_url, support_email, tenant_slug, updated_at`,
      [uid, brand_name, primary_color, logo_url || null, support_email || null, tenant_slug || null]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
