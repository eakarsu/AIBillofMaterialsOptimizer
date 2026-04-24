const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 4001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bom', require('./routes/bom'));
app.use('/api/alternatives', require('./routes/alternatives'));
app.use('/api/obsolescence', require('./routes/obsolescence'));
app.use('/api/leadtime', require('./routes/leadtime'));
app.use('/api/costdown', require('./routes/costdown'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/bomversions', require('./routes/bomversions'));
app.use('/api/risks', require('./routes/risks'));
app.use('/api/export', require('./routes/export'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.listen(PORT, () => {
  console.log(`🚀 BOM Optimizer API running on port ${PORT}`);
});
