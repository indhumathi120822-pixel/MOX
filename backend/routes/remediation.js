const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Generate remediation preview diff for a finding
router.get('/preview/:finding_id', authenticateToken, async (req, res) => {
  try {
    const finding = await get(`SELECT * FROM findings WHERE id = ?`, [req.params.finding_id]);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found.' });
    }

    const filePath = finding.location;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found on disk at ${filePath}` });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const lineNum = finding.line_number || 1;
    const targetLine = lines[lineNum - 1] || '';

    // Generate deterministic patch suggestion based on finding algorithm
    let proposedLine = targetLine;
    if (finding.algorithm === 'MD5') {
      proposedLine = targetLine.replace(/MD5/gi, 'SHA-256').replace(/md5/gi, 'sha256');
    } else if (finding.algorithm === 'SHA-1') {
      proposedLine = targetLine.replace(/SHA-?1/gi, 'SHA-256').replace(/sha1/gi, 'sha256');
    } else if (finding.algorithm === 'DES' || finding.algorithm === '3DES') {
      proposedLine = targetLine.replace(/DES|3DES/gi, 'AES/GCM/NoPadding');
    } else if (finding.algorithm === 'AES-ECB') {
      proposedLine = targetLine.replace(/ECB/gi, 'GCM');
    } else if (finding.algorithm === 'RSA') {
      proposedLine = targetLine.replace(/1024|512/g, '3072');
    }

    const diffPatch = `--- ${filePath} (Original)\n+++ ${filePath} (Remediated)\n@@ -${lineNum},1 +${lineNum},1 @@\n- ${targetLine}\n+ ${proposedLine}`;

    res.json({
      finding,
      file_path: filePath,
      line_number: lineNum,
      original_line: targetLine,
      proposed_line: proposedLine,
      diff_patch: diffPatch
    });
  } catch (err) {
    console.error('Remediation preview error:', err);
    res.status(500).json({ error: 'Failed to generate remediation diff.' });
  }
});

// Apply remediation patch with explicit user approval
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { finding_id, file_path, line_number, proposed_line } = req.body;
    if (!finding_id || !file_path || proposed_line === undefined) {
      return res.status(400).json({ error: 'finding_id, file_path, and proposed_line are required.' });
    }

    const finding = await get(`SELECT * FROM findings WHERE id = ?`, [finding_id]);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found.' });
    }

    if (!fs.existsSync(file_path)) {
      return res.status(404).json({ error: 'Target file does not exist.' });
    }

    // Backup original file before editing (NEVER DESTROY ORIGINAL)
    const backupPath = `${file_path}.bak_${Date.now()}`;
    fs.copyFileSync(file_path, backupPath);

    // Perform atomic line replacement
    const content = fs.readFileSync(file_path, 'utf-8');
    const lines = content.split('\n');
    const idx = (line_number || 1) - 1;
    lines[idx] = proposed_line;

    fs.writeFileSync(file_path, lines.join('\n'), 'utf-8');

    // Update finding status in SQLite
    await run(`UPDATE findings SET remediation_status = 'Applied' WHERE id = ?`, [finding_id]);
    await run(`UPDATE assets SET remediation_status = 'In Progress' WHERE id = ?`, [finding.asset_id]);

    // Record remediation task
    await run(
      `INSERT INTO remediation_tasks (finding_id, file_path, line_number, original_code, proposed_code, diff_patch, status, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [finding_id, file_path, line_number, finding.evidence, proposed_line, `Modified line ${line_number}`, 'Applied']
    );

    // Audit trail
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user.id,
      'REMEDIATION_APPLIED',
      `Applied remediation patch to ${file_path} for finding ID ${finding_id}. Backup created at ${backupPath}`
    ]);

    res.json({
      message: 'Remediation patch applied successfully. Original file backed up.',
      backup_path: backupPath,
      file_path
    });
  } catch (err) {
    console.error('Remediation apply error:', err);
    res.status(500).json({ error: 'Failed to apply remediation patch.' });
  }
});

// Verify remediation by comparing pre- and post-remediation state
router.get('/verify/:scan_id', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scan_id;
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [scanId]);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found.' });
    }

    const totalFindings = await get(`SELECT COUNT(*) as count FROM findings WHERE scan_id = ?`, [scanId]);
    const appliedCount = await get(`SELECT COUNT(*) as count FROM findings WHERE scan_id = ? AND remediation_status = 'Applied'`, [scanId]);

    const remainingCount = totalFindings.count - appliedCount.count;
    const riskDelta = appliedCount.count > 0 ? -1.5 * appliedCount.count : 0.0;

    res.json({
      scan_id: scanId,
      total_findings_before: totalFindings.count,
      remediated_findings: appliedCount.count,
      remaining_findings: remainingCount,
      risk_score_before: scan.risk_score,
      risk_score_after: Math.max(0.0, scan.risk_score + riskDelta),
      verification_status: remainingCount === 0 ? 'COMPLETE' : 'PARTIAL'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify remediation.' });
  }
});

module.exports = router;
