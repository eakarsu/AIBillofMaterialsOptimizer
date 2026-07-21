'use strict';

const crypto = require('crypto');

class WorkflowError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const requiredText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new WorkflowError('INVALID_INPUT', `${field} is required`);
  return value.trim();
};

function evaluateBomProposal(input) {
  if (!input || typeof input !== 'object') throw new WorkflowError('INVALID_INPUT', 'proposal body is required');
  const bomId = requiredText(input.bomId, 'bomId');
  const baseVersion = requiredText(input.baseVersion, 'baseVersion');
  const proposedVersion = requiredText(input.proposedVersion, 'proposedVersion');
  if (baseVersion === proposedVersion) throw new WorkflowError('INVALID_INPUT', 'proposedVersion must differ from baseVersion');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new WorkflowError('INVALID_INPUT', 'items must be non-empty');

  const blockers = [];
  const seen = new Set();
  let totalCost = 0;
  let currency = null;
  const items = input.items.map((item, index) => {
    const partNumber = requiredText(item.partNumber, `items[${index}].partNumber`).toUpperCase();
    if (seen.has(partNumber)) blockers.push({ code: 'DUPLICATE_PART', partNumber });
    seen.add(partNumber);
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    if (!Number.isInteger(quantity) || quantity <= 0) blockers.push({ code: 'INVALID_QUANTITY', partNumber });
    if (!Number.isFinite(unitCost) || unitCost < 0) blockers.push({ code: 'INVALID_UNIT_COST', partNumber });
    const itemCurrency = requiredText(item.currency, `items[${index}].currency`).toUpperCase();
    if (currency && currency !== itemCurrency) blockers.push({ code: 'CURRENCY_CONVERSION_REQUIRED', partNumber });
    currency ||= itemCurrency;
    if (!item.supplierId) blockers.push({ code: 'SUPPLIER_REQUIRED', partNumber });
    if (item.lifecycleStatus !== 'active') blockers.push({ code: 'LIFECYCLE_NOT_ACTIVE', partNumber });
    if (item.complianceStatus !== 'approved') blockers.push({ code: 'COMPLIANCE_NOT_APPROVED', partNumber });
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) blockers.push({ code: 'EVIDENCE_REQUIRED', partNumber });
    if (item.effectiveFrom && item.effectiveTo && Date.parse(item.effectiveFrom) > Date.parse(item.effectiveTo)) {
      blockers.push({ code: 'INVALID_EFFECTIVITY', partNumber });
    }
    if (Number.isFinite(unitCost) && Number.isInteger(quantity)) totalCost += unitCost * quantity;
    return { ...item, partNumber, quantity, unitCost, currency: itemCurrency };
  });

  if (input.baseStatus !== 'released') blockers.push({ code: 'BASE_NOT_RELEASED' });
  if (Number.isFinite(Number(input.maxTotalCost)) && totalCost > Number(input.maxTotalCost)) {
    blockers.push({ code: 'COST_CONSTRAINT_EXCEEDED', actual: totalCost, maximum: Number(input.maxTotalCost) });
  }
  const substitutions = Array.isArray(input.substitutions) ? input.substitutions : [];
  for (const substitution of substitutions) {
    if (!seen.has(String(substitution.fromPartNumber || '').toUpperCase()) || !seen.has(String(substitution.toPartNumber || '').toUpperCase())) {
      blockers.push({ code: 'SUBSTITUTION_PART_NOT_IN_PROPOSAL' });
    }
    if (!substitution.engineeringEvidenceRef) blockers.push({ code: 'SUBSTITUTION_EVIDENCE_REQUIRED' });
  }

  const canonical = { bomId, baseVersion, proposedVersion, items, substitutions, totalCost, currency };
  return {
    ...canonical,
    proposalHash: crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    blockers,
    status: blockers.length ? 'blocked' : 'awaiting_engineering_approval',
    requiredApprovals: ['engineer', 'supply_chain'],
  };
}

function approveProposal(proposal, actor) {
  if (!proposal || proposal.status !== 'awaiting_engineering_approval') throw new WorkflowError('INVALID_TRANSITION', 'only unblocked proposals can be approved');
  if (!actor || !['engineer', 'admin'].includes(actor.role)) throw new WorkflowError('FORBIDDEN', 'engineering approval role required');
  return { ...proposal, status: 'approved', approvedBy: actor.id, approvedAt: new Date().toISOString() };
}

module.exports = { WorkflowError, evaluateBomProposal, approveProposal };
