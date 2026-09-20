const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Export Full Technical Report (JSON)
router.get('/scan/:scan_id/json', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scan_id;
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [scanId]);
    const project = scan ? await get(`SELECT * FROM projects WHERE id = ?`, [scan.project_id]) : null;
    const assets = await all(`SELECT * FROM assets WHERE scan_id = ?`, [scanId]);
    const findings = await all(`SELECT * FROM findings WHERE scan_id = ?`, [scanId]);
    const cbomNodes = await all(`SELECT * FROM cbom_nodes WHERE scan_id = ?`, [scanId]);

    const report = {
      title: "Enterprise Cryptographic Discovery & Analysis Report",
      tool: "ECDAT v1.0.0 (SIH26164 / NIST-Referenced)",
      generated_at: new Date().toISOString(),
      project: project ? project.name : "Enterprise App",
      scan_summary: scan,
      total_assets: assets.length,
      total_findings: findings.length,
      assets,
      findings,
      cbom_summary: {
        total_nodes: cbomNodes.length
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ecdat_report_scan_${scanId}.json`);
    res.send(JSON.stringify(report, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate JSON report.' });
  }
});

// Export Executive Summary HTML Report
router.get('/scan/:scan_id/html', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scan_id;
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [scanId]);
    const project = scan ? await get(`SELECT * FROM projects WHERE id = ?`, [scan.project_id]) : null;
    const findings = await all(`SELECT * FROM findings WHERE scan_id = ?`, [scanId]);
    const assets = await all(`SELECT * FROM assets WHERE scan_id = ?`, [scanId]);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>ECDAT Executive Cryptographic Audit Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
          h1 { color: #60a5fa; margin: 0; font-size: 28px; }
          .subtitle { color: #94a3b8; font-size: 14px; margin-top: 5px; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
          .metric { background: #0f172a; padding: 15px; border-radius: 6px; text-align: center; }
          .metric-val { font-size: 24px; font-weight: bold; color: #38bdf8; }
          .metric-lbl { font-size: 12px; color: #94a3b8; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
          th { background: #0f172a; color: #94a3b8; font-size: 13px; uppercase; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .badge-critical { background: #7f1d1d; color: #fca5a5; }
          .badge-high { background: #7c2d12; color: #fdba74; }
          .badge-medium { background: #713f12; color: #fde047; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ECDAT Executive Cryptographic Report</h1>
          <div class="subtitle">SIH26164 | Local-First | Privacy-First | NIST-Referenced (FIPS 203/204/205)</div>
          <div class="subtitle">Project: <strong>${project ? project.name : 'Enterprise App'}</strong> | Generated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="grid">
          <div class="metric"><div class="metric-val">${scan ? scan.risk_score : 0}/10</div><div class="metric-lbl">Risk Score</div></div>
          <div class="metric"><div class="metric-val">${assets.length}</div><div class="metric-lbl">Discovered Assets</div></div>
          <div class="metric"><div class="metric-val">${findings.length}</div><div class="metric-lbl">Total Findings</div></div>
          <div class="metric"><div class="metric-val">${findings.filter(f => f.severity === 'Critical' || f.severity === 'High').length}</div><div class="metric-lbl">High/Critical Exposure</div></div>
        </div>

        <div class="card">
          <h2>Discovered Cryptographic Findings</h2>
          <table>
            <thead>
              <tr>
                <th>Finding</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Algorithm</th>
                <th>NIST Reference</th>
                <th>Quantum Risk</th>
              </tr>
            </thead>
            <tbody>
              ${findings.map(f => `
                <tr>
                  <td><strong>${f.title}</strong><br/><small style="color:#94a3b8">${f.location}:${f.line_number || 1}</small></td>
                  <td>${f.category}</td>
                  <td><span class="badge badge-${f.severity.toLowerCase()}">${f.severity}</span></td>
                  <td>${f.algorithm}</td>
                  <td>${f.nist_reference}</td>
                  <td>${f.quantum_risk || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename=ecdat_summary_scan_${scanId}.html`);
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate HTML report.' });
  }
});

module.exports = router;
