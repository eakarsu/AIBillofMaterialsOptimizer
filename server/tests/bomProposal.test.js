'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBomProposal, approveProposal } = require('../domain/bomProposal');

const valid = () => ({
  bomId: 'assembly-1', baseVersion: '1.0', proposedVersion: '1.1', baseStatus: 'released', maxTotalCost: 50,
  items: [{ partNumber: 'R-10', quantity: 2, unitCost: 3, currency: 'USD', supplierId: 's1', lifecycleStatus: 'active', complianceStatus: 'approved', evidenceRefs: ['released-drawing:1'] }],
});

test('produces a deterministic approval-gated rollup', () => {
  const result = evaluateBomProposal(valid());
  assert.equal(result.totalCost, 6);
  assert.equal(result.status, 'awaiting_engineering_approval');
  assert.equal(result.proposalHash.length, 64);
});

test('blocks unsafe or ungrounded substitutions', () => {
  const proposal = valid();
  proposal.items[0].complianceStatus = 'unknown';
  proposal.substitutions = [{ fromPartNumber: 'R-10', toPartNumber: 'MISSING' }];
  const result = evaluateBomProposal(proposal);
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.some((item) => item.code === 'COMPLIANCE_NOT_APPROVED'));
  assert.throws(() => approveProposal(result, { id: 'u1', role: 'engineer' }), /only unblocked/);
});

test('requires an engineering role to approve', () => {
  assert.throws(() => approveProposal(evaluateBomProposal(valid()), { id: 'u2', role: 'viewer' }), /role required/);
});
