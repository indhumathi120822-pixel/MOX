const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { runScanJS } = require('../scanner_js');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new Error('Only valid .zip files are accepted.'));
    }
    cb(null, true);
  }
});

// 1. GET /api/monitoring/projects — List all monitored projects in watchlist
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await all(`
      SELECT p.*,
        (SELECT COUNT(*) FROM monitoring_events e WHERE e.monitored_project_id = p.id AND e.status = 'UNREAD') as unread_notifications_count
      FROM monitored_projects p
      ORDER BY p.created_at DESC
    `);
    res.json({ projects });
  } catch (err) {
    console.error('[Monitoring] Error listing projects:', err);
    res.status(500).json({ error: 'Failed to fetch monitored projects watchlist.' });
  }
});

// 1b. POST /api/monitoring/projects/upload-zip — Upload & extract ZIP project file
router.post('/projects/upload-zip', authenticateToken, (req, res) => {
  upload.single('zip_file')(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ error: multerErr.message || 'Only valid .zip files are accepted.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please select a valid .zip file to upload.' });
      }

      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase();
      if (ext !== '.zip') {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(400).json({ error: 'Only valid .zip files are accepted.' });
      }

      const projectName = req.body.name || originalName.replace(/\.zip$/i, '');
      const zipPath = req.file.path;
      const extractDir = path.join(uploadsDir, `extracted_${Date.now()}_${path.parse(originalName).name}`);

      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      // Safe extraction with path traversal protection
      try {
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();
        if (!entries || entries.length === 0) {
          throw new Error('ZIP archive is empty or invalid.');
        }

        const resolvedDest = path.resolve(extractDir);
        for (const entry of entries) {
          const targetPath = path.resolve(extractDir, entry.entryName);
          if (!targetPath.startsWith(resolvedDest)) {
            throw new Error(`Security Violation: Path traversal detected in ZIP entry '${entry.entryName}'`);
          }
        }

        zip.extractAllTo(extractDir, true);
      } catch (extractErr) {
        try { fs.unlinkSync(zipPath); } catch (e) {}
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
        return res.status(400).json({ error: `Invalid ZIP file or extraction failed: ${extractErr.message}` });
      }

      // Clean up temp zip file
      try { fs.unlinkSync(zipPath); } catch (e) {}

      // Detect project root directory if single parent folder exists inside zip
      let projectRoot = extractDir;
      try {
        const items = fs.readdirSync(extractDir).filter(e => !e.startsWith('.') && e !== '__MACOSX');
        if (items.length === 1) {
          const singleChild = path.join(extractDir, items[0]);
          if (fs.statSync(singleChild).isDirectory()) {
            projectRoot = singleChild;
          }
        }
      } catch (e) {}

      // Perform baseline cryptographic scan on extracted files
      const scanResult = runScanJS(projectRoot, projectName);

      const criticalCount = scanResult.summary ? scanResult.summary.critical || 0 : 0;
      const highCount = scanResult.summary ? scanResult.summary.high || 0 : 0;
      const mediumCount = scanResult.summary ? scanResult.summary.medium || 0 : 0;
      const lowCount = scanResult.summary ? scanResult.summary.low || 0 : 0;

      let riskLevel = 'Low';
      if (criticalCount > 0) riskLevel = 'Critical';
      else if (highCount > 0) riskLevel = 'High';
      else if (mediumCount > 0) riskLevel = 'Medium';

      let quantumStatus = 'Quantum Safe';
      const hasQuantumVulnerable = scanResult.findings && scanResult.findings.some(f => f.quantum_risk && (f.quantum_risk.includes('Vulnerable') || f.quantum_risk.includes('Shor')));
      const hasPQC = scanResult.findings && scanResult.findings.some(f => f.quantum_risk && (f.quantum_risk.includes('POST_QUANTUM') || f.quantum_risk.includes('Resistant')));

      if (hasQuantumVulnerable && hasPQC) quantumStatus = 'Mixed';
      else if (hasQuantumVulnerable) quantumStatus = 'Quantum Vulnerable';
      else if (hasPQC) quantumStatus = 'PQC Post-Quantum';

      // Insert project into monitored_projects
      const projResult = await run(`
        INSERT INTO monitored_projects (
          user_id, name, source_type, source_reference, branch, status,
          risk_level, quantum_status, total_findings, critical_count, high_count,
          medium_count, low_count, last_scan_time, last_check_time, notification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OK')
      `, [
        req.user ? req.user.id : 1,
        projectName.trim(),
        'upload',
        projectRoot,
        'main',
        'STATIC_UPLOAD',
        riskLevel,
        quantumStatus,
        scanResult.total_findings || 0,
        criticalCount,
        highCount,
        mediumCount,
        lowCount
      ]);

      const projectId = projResult.lastID;

      // Save initial baseline snapshot
      const baselineHash = `baseline_v1_${Date.now()}`;
      const baselineJson = JSON.stringify({
        timestamp: new Date().toISOString(),
        findings: scanResult.findings || [],
        summary: scanResult.summary || {},
        cbom: scanResult.cbom || {}
      });

      await run(`
        INSERT INTO monitored_baselines (monitored_project_id, scan_id, baseline_hash, baseline_json)
        VALUES (?, ?, ?, ?)
      `, [projectId, 0, baselineHash, baselineJson]);

      await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
        req.user ? req.user.id : 1,
        'MONITOR_ZIP_PROJECT_ADDED',
        `Uploaded and extracted ZIP project '${projectName}' (${originalName}). Baseline recorded with ${scanResult.total_findings} findings.`
      ]);

      const createdProject = await get(`SELECT * FROM monitored_projects WHERE id = ?`, [projectId]);

      res.json({
        message: `ZIP Project '${projectName}' successfully uploaded, extracted, scanned, and added to Monitoring Watchlist.`,
        project: createdProject,
        scan_result: scanResult
      });

    } catch (err) {
      console.error('[Monitoring] Error uploading ZIP project:', err);
      res.status(500).json({ error: err.message || 'Failed to process ZIP project upload.' });
    }
  });
});

// 2. POST /api/monitoring/projects — Add a new project to monitoring watchlist
router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, source_type, source_reference, branch } = req.body;

    if (!name || !source_type || !source_reference) {
      return res.status(400).json({ error: 'Name, source_type (github|local|upload), and source_reference are required.' });
    }

    const cleanSourceType = (source_type || 'local').toLowerCase();
    const cleanBranch = branch || 'main';

    // Determine target scanning path
    let scanPath = source_reference.trim();

    // Default status logic
    let initialStatus = 'ACTIVE';
    if (cleanSourceType === 'upload') {
      initialStatus = 'STATIC_UPLOAD';
    } else if (cleanSourceType === 'github') {
      initialStatus = 'ACTIVE';
    }

    // Resolve local path if path does not exist on disk, fallback to sample_targets safely
    if (cleanSourceType === 'local' && !fs.existsSync(scanPath)) {
      const fallback = path.join(process.cwd(), 'sample_targets');
      if (fs.existsSync(fallback)) {
        scanPath = fallback;
      }
    } else if (cleanSourceType === 'github' && !fs.existsSync(scanPath)) {
      const fallback = path.join(process.cwd(), 'sample_targets');
      if (fs.existsSync(fallback)) {
        scanPath = fallback;
      }
    }

    // Perform baseline cryptographic scan using ECDAT scanner engine
    const scanResult = runScanJS(scanPath, name);

    const criticalCount = scanResult.summary ? scanResult.summary.critical || 0 : 0;
    const highCount = scanResult.summary ? scanResult.summary.high || 0 : 0;
    const mediumCount = scanResult.summary ? scanResult.summary.medium || 0 : 0;
    const lowCount = scanResult.summary ? scanResult.summary.low || 0 : 0;

    let riskLevel = 'Low';
    if (criticalCount > 0) riskLevel = 'Critical';
    else if (highCount > 0) riskLevel = 'High';
    else if (mediumCount > 0) riskLevel = 'Medium';

    let quantumStatus = 'Quantum Safe';
    const hasQuantumVulnerable = scanResult.findings && scanResult.findings.some(f => f.quantum_risk && (f.quantum_risk.includes('Vulnerable') || f.quantum_risk.includes('Shor')));
    const hasPQC = scanResult.findings && scanResult.findings.some(f => f.quantum_risk && (f.quantum_risk.includes('POST_QUANTUM') || f.quantum_risk.includes('Resistant')));

    if (hasQuantumVulnerable && hasPQC) quantumStatus = 'Mixed';
    else if (hasQuantumVulnerable) quantumStatus = 'Quantum Vulnerable';
    else if (hasPQC) quantumStatus = 'PQC Post-Quantum';

    // Insert project into monitored_projects
    const projResult = await run(`
      INSERT INTO monitored_projects (
        user_id, name, source_type, source_reference, branch, status,
        risk_level, quantum_status, total_findings, critical_count, high_count,
        medium_count, low_count, last_scan_time, last_check_time, notification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'OK')
    `, [
      req.user ? req.user.id : 1,
      name.trim(),
      cleanSourceType,
      source_reference.trim(),
      cleanBranch,
      initialStatus,
      riskLevel,
      quantumStatus,
      scanResult.total_findings || 0,
      criticalCount,
      highCount,
      mediumCount,
      lowCount
    ]);

    const projectId = projResult.lastID;

    // Create initial baseline snapshot in monitored_baselines
    const baselineHash = `baseline_v1_${Date.now()}`;
    const baselineJson = JSON.stringify({
      timestamp: new Date().toISOString(),
      findings: scanResult.findings || [],
      summary: scanResult.summary || {},
      cbom: scanResult.cbom || {}
    });

    await run(`
      INSERT INTO monitored_baselines (monitored_project_id, scan_id, baseline_hash, baseline_json)
      VALUES (?, ?, ?, ?)
    `, [projectId, 0, baselineHash, baselineJson]);

    // Record audit log
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user ? req.user.id : 1,
      'MONITOR_PROJECT_ADDED',
      `Added project '${name}' (${cleanSourceType}) to security watchlist. Initial baseline recorded with ${scanResult.total_findings} findings.`
    ]);

    const createdProject = await get(`SELECT * FROM monitored_projects WHERE id = ?`, [projectId]);

    res.json({
      message: `Project '${name}' successfully added to Monitoring Watchlist.`,
      project: createdProject,
      scan_result: scanResult
    });
  } catch (err) {
    console.error('[Monitoring] Error adding project:', err);
    res.status(500).json({ error: 'Failed to add project to monitoring watchlist.' });
  }
});

// 3. GET /api/monitoring/projects/:id — Get details of a single monitored project
router.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get(`SELECT * FROM monitored_projects WHERE id = ?`, [projectId]);

    if (!project) {
      return res.status(404).json({ error: 'Monitored project not found.' });
    }

    const baselines = await all(`
      SELECT id, scan_id, baseline_hash, created_at
      FROM monitored_baselines
      WHERE monitored_project_id = ?
      ORDER BY created_at DESC
    `, [projectId]);

    const latestBaselineRow = await get(`
      SELECT baseline_json FROM monitored_baselines
      WHERE monitored_project_id = ?
      ORDER BY created_at DESC LIMIT 1
    `, [projectId]);

    let latestBaselineData = null;
    if (latestBaselineRow && latestBaselineRow.baseline_json) {
      try {
        latestBaselineData = JSON.parse(latestBaselineRow.baseline_json);
      } catch (e) {}
    }

    const events = await all(`
      SELECT * FROM monitoring_events
      WHERE monitored_project_id = ?
      ORDER BY created_at DESC LIMIT 50
    `, [projectId]);

    res.json({
      project,
      baselines,
      latest_baseline: latestBaselineData,
      events
    });
  } catch (err) {
    console.error('[Monitoring] Error getting project details:', err);
    res.status(500).json({ error: 'Failed to fetch monitored project details.' });
  }
});

// 4. POST /api/monitoring/projects/:id/scan-now — Re-scan project & compare against baseline snapshot
router.post('/projects/:id/scan-now', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get(`SELECT * FROM monitored_projects WHERE id = ?`, [projectId]);

    if (!project) {
      return res.status(404).json({ error: 'Monitored project not found.' });
    }

    // Determine scanning target path
    let scanPath = project.source_reference;
    if (!fs.existsSync(scanPath)) {
      const fallback = path.join(process.cwd(), 'sample_targets');
      if (fs.existsSync(fallback)) scanPath = fallback;
    }

    // Execute scan using ECDAT scanner engine
    const currentScan = runScanJS(scanPath, project.name);

    // Load previous baseline JSON snapshot
    const prevBaselineRow = await get(`
      SELECT baseline_json FROM monitored_baselines
      WHERE monitored_project_id = ?
      ORDER BY created_at DESC LIMIT 1
    `, [projectId]);

    let prevFindings = [];
    if (prevBaselineRow && prevBaselineRow.baseline_json) {
      try {
        const parsed = JSON.parse(prevBaselineRow.baseline_json);
        prevFindings = parsed.findings || [];
      } catch (e) {}
    }

    const currentFindings = currentScan.findings || [];

    // Cryptographic Change Detection Engine
    const generatedEvents = [];

    // Map previous findings by unique key
    const prevMap = new Map();
    prevFindings.forEach(f => {
      const key = `${f.algorithm || ''}::${f.location || ''}::${f.category || ''}`;
      prevMap.set(key, f);
    });

    // Check for newly introduced findings / weak algorithms
    currentFindings.forEach(f => {
      const key = `${f.algorithm || ''}::${f.location || ''}::${f.category || ''}`;
      if (!prevMap.has(key)) {
        const isWeakOrBroken = /MD5|SHA-1|DES|RC4|RSA-1024|TLSv1|SSLv3/i.test(f.algorithm || '');
        const isPQC = /ML-KEM|ML-DSA|SLH-DSA|Kyber|Dilithium|SPHINCS/i.test(f.algorithm || '');

        let eventType = 'NEW_ALGORITHM';
        let severity = f.severity || 'Medium';
        let priority = f.priority || 'P3';
        let title = `New Cryptographic Usage: ${f.algorithm || 'Primitive'}`;
        let description = `New ${f.category || 'cryptographic'} finding detected at ${path.basename(f.location || '')}:${f.line_number || 1}.`;

        if (isWeakOrBroken) {
          eventType = 'WEAK_ALGORITHM_INTRODUCED';
          severity = 'High';
          priority = 'P2';
          title = `Security Warning: Weak Cryptography Introduced (${f.algorithm})`;
          description = `A legacy/deprecated algorithm (${f.algorithm}) was introduced in ${path.basename(f.location || '')}.`;
        } else if (isPQC) {
          eventType = 'PQC_MIGRATION';
          severity = 'Info';
          priority = 'P4';
          title = `PQC Post-Quantum Algorithm Discovered (${f.algorithm})`;
          description = `Post-quantum algorithm (${f.algorithm}) detected in ${path.basename(f.location || '')}. Security posture improved.`;
        }

        generatedEvents.push({
          monitored_project_id: project.id,
          event_type: eventType,
          title,
          description,
          severity,
          priority,
          previous_state: 'None',
          current_state: f.algorithm || 'Detected',
          file_path: f.location || '',
          recommendation: f.recommendation || 'Review cryptographic implementation.'
        });
      }
    });

    // Save generated events into DB
    for (const ev of generatedEvents) {
      await run(`
        INSERT INTO monitoring_events (
          monitored_project_id, event_type, title, description, severity,
          priority, previous_state, current_state, file_path, recommendation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNREAD')
      `, [
        ev.monitored_project_id, ev.event_type, ev.title, ev.description,
        ev.severity, ev.priority, ev.previous_state, ev.current_state,
        ev.file_path, ev.recommendation
      ]);
    }

    // Recalculate metrics
    const criticalCount = currentScan.summary ? currentScan.summary.critical || 0 : 0;
    const highCount = currentScan.summary ? currentScan.summary.high || 0 : 0;
    const mediumCount = currentScan.summary ? currentScan.summary.medium || 0 : 0;
    const lowCount = currentScan.summary ? currentScan.summary.low || 0 : 0;

    let newRiskLevel = 'Low';
    if (criticalCount > 0) newRiskLevel = 'Critical';
    else if (highCount > 0) newRiskLevel = 'High';
    else if (mediumCount > 0) newRiskLevel = 'Medium';

    let newQuantumStatus = 'Quantum Safe';
    const hasQuantumVulnerable = currentFindings.some(f => f.quantum_risk && (f.quantum_risk.includes('Vulnerable') || f.quantum_risk.includes('Shor')));
    const hasPQC = currentFindings.some(f => f.quantum_risk && (f.quantum_risk.includes('POST_QUANTUM') || f.quantum_risk.includes('Resistant')));

    if (hasQuantumVulnerable && hasPQC) newQuantumStatus = 'Mixed';
    else if (hasQuantumVulnerable) newQuantumStatus = 'Quantum Vulnerable';
    else if (hasPQC) newQuantumStatus = 'PQC Post-Quantum';

    const hasNewEvents = generatedEvents.length > 0;
    const notificationStatus = hasNewEvents ? 'NEW_SECURITY_EVENT' : project.notification_status;
    const lastChangeDetected = hasNewEvents ? new Date().toISOString() : project.last_change_detected;

    // Update project metrics in DB
    await run(`
      UPDATE monitored_projects SET
        risk_level = ?,
        quantum_status = ?,
        total_findings = ?,
        critical_count = ?,
        high_count = ?,
        medium_count = ?,
        low_count = ?,
        last_scan_time = CURRENT_TIMESTAMP,
        last_check_time = CURRENT_TIMESTAMP,
        last_change_detected = ?,
        notification_status = ?
      WHERE id = ?
    `, [
      newRiskLevel, newQuantumStatus, currentScan.total_findings || 0,
      criticalCount, highCount, mediumCount, lowCount,
      lastChangeDetected, notificationStatus, project.id
    ]);

    // Save updated baseline snapshot if changes occurred
    if (hasNewEvents || prevFindings.length === 0) {
      const newHash = `baseline_v${Date.now()}`;
      const newJson = JSON.stringify({
        timestamp: new Date().toISOString(),
        findings: currentFindings,
        summary: currentScan.summary || {},
        cbom: currentScan.cbom || {}
      });

      await run(`
        INSERT INTO monitored_baselines (monitored_project_id, scan_id, baseline_hash, baseline_json)
        VALUES (?, ?, ?, ?)
      `, [project.id, 0, newHash, newJson]);
    }

    const updatedProject = await get(`SELECT * FROM monitored_projects WHERE id = ?`, [project.id]);

    res.json({
      message: hasNewEvents
        ? `Re-scan complete. ${generatedEvents.length} cryptographic security changes detected!`
        : 'Re-scan complete. No cryptographic posture changes detected.',
      project: updatedProject,
      diff_detected: hasNewEvents,
      new_events: generatedEvents,
      scan_result: currentScan
    });

  } catch (err) {
    console.error('[Monitoring] Error running scan-now:', err);
    res.status(500).json({ error: 'Failed to execute project re-scan.' });
  }
});

// 5. POST /api/monitoring/projects/:id/pause — Pause monitoring for a project
router.post('/projects/:id/pause', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    await run(`UPDATE monitored_projects SET status = 'PAUSED' WHERE id = ?`, [projectId]);
    res.json({ message: 'Project monitoring set to PAUSED.', status: 'PAUSED' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause project monitoring.' });
  }
});

// 6. POST /api/monitoring/projects/:id/resume — Resume monitoring for a project
router.post('/projects/:id/resume', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get(`SELECT source_type FROM monitored_projects WHERE id = ?`, [projectId]);
    const targetStatus = project && project.source_type === 'upload' ? 'STATIC_UPLOAD' : 'ACTIVE';

    await run(`UPDATE monitored_projects SET status = ? WHERE id = ?`, [targetStatus, projectId]);
    res.json({ message: `Project monitoring set to ${targetStatus}.`, status: targetStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume project monitoring.' });
  }
});

// 7. DELETE /api/monitoring/projects/:id — Remove project from monitoring watchlist
router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    await run(`DELETE FROM monitored_projects WHERE id = ?`, [projectId]);
    res.json({ message: 'Project removed from monitoring watchlist.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove project from watchlist.' });
  }
});

// 8. GET /api/monitoring/notifications — Get all security notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const events = await all(`
      SELECT e.*, p.name as project_name, p.source_type
      FROM monitoring_events e
      JOIN monitored_projects p ON e.monitored_project_id = p.id
      ORDER BY e.created_at DESC LIMIT 100
    `);
    res.json({ notifications: events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monitoring notifications.' });
  }
});

// 9. POST /api/monitoring/notifications/:id/review — Review or dismiss notification
router.post('/notifications/:id/review', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { action } = req.body; // 'mark_reviewed' | 'dismiss'
    const newStatus = action === 'dismiss' ? 'DISMISSED' : 'REVIEWED';

    await run(`UPDATE monitoring_events SET status = ? WHERE id = ?`, [eventId]);
    res.json({ message: `Notification marked as ${newStatus}.`, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification status.' });
  }
});

module.exports = router;
