const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const scanRoutes = require('./routes/scans');
const assetRoutes = require('./routes/assets');
const cbomRoutes = require('./routes/cbom');
const nistRoutes = require('./routes/nist');
const remediationRoutes = require('./routes/remediation');
const migrationRoutes = require('./routes/migration');
const monitoringRoutes = require('./routes/monitoring');
const webhookRoutes = require('./routes/webhook');
const reportRoutes = require('./routes/reports');

const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/cbom', cbomRoutes);
app.use('/api/nist', nistRoutes);
app.use('/api/remediation', remediationRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'online',
    app: 'MOX - Enterprise Cryptographic Discovery & Analysis Tool',
    version: '1.0.0',
    mode: 'LOCAL-ONLY / PRIVACY-FIRST',
    nist_compliance: 'Mapped to FIPS 203/204/205, SP 800-52 Rev 2, SP 800-57 Part 1, CSF 2.0',
    timestamp: new Date().toISOString()
  });
});

// Static frontend production build serving & SPA Fallback
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend static build not found. Run "npm run build" first.');
  }
});

// Initialize database and start listening
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(` ECDAT Backend API Server running locally on port ${PORT}`);
    console.log(` Mode: LOCAL-ONLY MODE (Scanned data remains on this device)`);
    console.log(` Reference: NIST-Referenced (FIPS 203/204/205, SP 800-52r2)`);
    console.log(`================================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
