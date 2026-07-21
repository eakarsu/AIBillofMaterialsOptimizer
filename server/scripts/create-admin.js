'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  const name = (process.env.PROVISION_ADMIN_NAME || '').trim();
  const tenantId = (process.env.TENANT_ID || process.env.GOVERNANCE_TENANT_ID || '').trim();
  if (!email || !name || !tenantId || password.length < 12) {
    throw new Error('Admin email, name, tenant, and a 12+ character password are required');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password, name, role, tenant_id)
     VALUES ($1, $2, $3, 'admin', $4)
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       tenant_id = EXCLUDED.tenant_id`,
    [email, passwordHash, name, tenantId]
  );
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
