const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { pcns_open: 11, impacted_boms: 26, sole_source_parts: 6, redesign_risk: 3 },
    impacts: [
      { pcn: 'PCN-77A', part: 'MCU-STM32F4', supplier: 'Arrow', boms: 8, risk: 'high', action: 'qualify alternate' },
      { pcn: 'PCN-81C', part: 'REG-5V-LDO', supplier: 'DigiKey', boms: 4, risk: 'medium', action: 'update approved vendor list' },
      { pcn: 'PCN-89K', part: 'CAP-10UF-X7R', supplier: 'Mouser', boms: 14, risk: 'low', action: 'bulk buy approved' },
    ],
  });
});

router.post('/assess', (req, res) => {
  const { boms = 0, soleSource = false } = req.body || {};
  res.json({ risk: soleSource || boms > 5 ? 'high' : 'standard', required_steps: ['notify engineering', 'find alternates', 'cost delta review'] });
});

module.exports = router;
