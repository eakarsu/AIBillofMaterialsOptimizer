'use strict';
const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { WorkflowError, evaluateBomProposal, approveProposal } = require('../domain/bomProposal');
const router = express.Router();

const tenantFor = (user) => String(user.tenantId || user.tenant_id || `user:${user.id}`);
const migrationFailure = (error, res, next) => error.code === '42P01'
  ? res.status(503).json({ error: 'Database migration 001_governed_bom_workflows.sql is required', code: 'MIGRATION_REQUIRED' })
  : next(error);

router.post('/', auth, async (req, res, next) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 200) return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
  let proposal;
  try { proposal = evaluateBomProposal(req.body); } catch (error) {
    if (error instanceof WorkflowError) return res.status(422).json({ error: error.message, code: error.code, details: error.details });
    return next(error);
  }
  const tenantId = tenantFor(req.user);
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  const client = await pool.connect().catch((error) => null);
  if (!client) return res.status(503).json({ error: 'Workflow store is unavailable', code: 'STORE_UNAVAILABLE' });
  try {
    await client.query('BEGIN');
    const id = crypto.randomUUID();
    const inserted = await client.query(`INSERT INTO bom_change_workflows
      (id, tenant_id, idempotency_key, request_hash, bom_id, status, proposal, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING *`,
      [id, tenantId, idempotencyKey, requestHash, proposal.bomId, proposal.status, proposal, req.user.id]);
    let workflow = inserted.rows[0];
    if (!workflow) {
      workflow = (await client.query('SELECT * FROM bom_change_workflows WHERE tenant_id=$1 AND idempotency_key=$2', [tenantId, idempotencyKey])).rows[0];
      if (workflow.request_hash !== requestHash) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Idempotency-Key was already used with different input' }); }
      await client.query('COMMIT');
      return res.json({ workflow, replayed: true });
    }
    await client.query(`INSERT INTO bom_change_events (id,workflow_id,tenant_id,actor_id,event_type,to_status,evidence_hash)
      VALUES ($1,$2,$3,$4,'proposal.created',$5,$6)`, [crypto.randomUUID(), id, tenantId, req.user.id, proposal.status, proposal.proposalHash]);
    await client.query('COMMIT');
    res.status(201).json({ workflow });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); return migrationFailure(error, res, next); }
  finally { client.release(); }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT w.*, COALESCE(json_agg(e ORDER BY e.created_at) FILTER (WHERE e.id IS NOT NULL), '[]') AS events
      FROM bom_change_workflows w LEFT JOIN bom_change_events e ON e.workflow_id=w.id
      WHERE w.id=$1 AND w.tenant_id=$2 GROUP BY w.id`, [req.params.id, tenantFor(req.user)]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ workflow: result.rows[0] });
  } catch (error) { return migrationFailure(error, res, next); }
});

router.post('/:id/approve', auth, async (req, res, next) => {
  const tenantId = tenantFor(req.user);
  const client = await pool.connect().catch(() => null);
  if (!client) return res.status(503).json({ error: 'Workflow store is unavailable', code: 'STORE_UNAVAILABLE' });
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT * FROM bom_change_workflows WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenantId])).rows[0];
    if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Workflow not found' }); }
    let approved;
    try { approved = approveProposal(row.proposal, { id: req.user.id, role: req.user.role }); }
    catch (error) { await client.query('ROLLBACK'); return res.status(error.code === 'FORBIDDEN' ? 403 : 409).json({ error: error.message, code: error.code }); }
    const updated = (await client.query(`UPDATE bom_change_workflows SET status='approved', proposal=$1, approved_by=$2, version=version+1, updated_at=NOW()
      WHERE id=$3 AND version=$4 RETURNING *`, [approved, req.user.id, row.id, row.version])).rows[0];
    if (!updated) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Workflow was concurrently modified' }); }
    await client.query(`INSERT INTO bom_change_events (id,workflow_id,tenant_id,actor_id,event_type,from_status,to_status,evidence_hash)
      VALUES ($1,$2,$3,$4,'proposal.approved',$5,'approved',$6)`, [crypto.randomUUID(), row.id, tenantId, req.user.id, row.status, row.proposal.proposalHash]);
    await client.query('COMMIT'); res.json({ workflow: updated });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); return migrationFailure(error, res, next); }
  finally { client.release(); }
});

module.exports = router;
