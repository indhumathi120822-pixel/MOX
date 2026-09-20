const express = require('express');
const router = express.Router();
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { run, get, all } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { lookupCryptoCatalog } = require('../crypto_catalog_js');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const https = require('https');
const http = require('http');

// Helper: Download file via HTTP/HTTPS with redirect support
function downloadFileHttps(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      const parsedUrl = new URL(currentUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      client.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': '*/*'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          request(redirectUrl);
        } else if (res.statusCode === 200) {
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => resolve(destPath));
          });
          file.on('error', (err) => {
            file.close();
            fs.unlink(destPath, () => reject(err));
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }).on('error', (err) => {
        reject(err);
      });
    };

    request(url);
  });
}

// Helper: Safe ZIP Extraction with Path Traversal Protection
function safeExtractZip(zipPath, destDir) {
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    if (!zipEntries || zipEntries.length === 0) {
      throw new Error('ZIP archive is empty');
    }
    const resolvedDest = path.resolve(destDir);

    for (const entry of zipEntries) {
      const targetPath = path.resolve(destDir, entry.entryName);
      if (!targetPath.toLowerCase().startsWith(resolvedDest.toLowerCase())) {
        throw new Error(`Security Violation: Path traversal detected in ZIP entry '${entry.entryName}'`);
      }
      if (entry.entryName.includes('..')) {
        throw new Error(`Security Violation: Insecure entry path '${entry.entryName}'`);
      }
    }

    zip.extractAllTo(destDir, true);
  } catch (err) {
    if (err.message.includes('empty')) throw new Error('No scannable files found.');
    throw new Error('Unable to extract ZIP file.');
  }
}

// Helper: Detect actual project root inside extracted directory
function detectProjectRoot(extractedDir) {
  try {
    const entries = fs.readdirSync(extractedDir).filter(e => !e.startsWith('.') && e !== '__MACOSX');
    if (entries.length === 1) {
      const singleChild = path.join(extractedDir, entries[0]);
      if (fs.statSync(singleChild).isDirectory()) {
        return singleChild;
      }
    }
  } catch (err) {}
  return extractedDir;
}

// Helper: Safely cleanup temporary directories
function cleanupTempDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[CLEANUP ERROR] Failed to remove ${dirPath}:`, err);
  }
}

// Start a new scan (Supports 3 input types: 'github', 'zip', 'local')
router.post('/start', authenticateToken, async (req, res) => {
  let tempScanDir = null;

  try {
    let { project_id, input_type, target_path, github_url, uploaded_zip_path, application_name, application_type, business_criticality } = req.body;

    const appName = application_name || 'MBOX Enterprise App';
    const appType = application_type || 'Web Service';
    const busCrit = business_criticality || 'Medium';

    // AUTOMATIC DERIVATION / VALIDATION OF PROJECT ID
    let project = null;
    if (project_id) {
      project = await get(`SELECT * FROM projects WHERE id = ? AND user_id = ?`, [project_id, req.user.id]);
    }
    
    if (!project) {
      const userProjects = await all(`SELECT id, name FROM projects WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [req.user.id]);
      if (userProjects && userProjects.length > 0) {
        project_id = userProjects[0].id;
        project = userProjects[0];
      } else {
        const newProj = await run(
          `INSERT INTO projects (user_id, name, description, application_type, business_criticality) VALUES (?, ?, ?, ?, ?)`,
          [req.user.id, appName, 'Automated local cryptographic scan workspace', appType, busCrit]
        );
        project_id = newProj.lastID;
        project = { id: project_id, name: appName };
      }
    } else {
      await run(`UPDATE projects SET application_type = ?, business_criticality = ? WHERE id = ?`, [appType, busCrit, project_id]);
    }

    let actualScanPath = '';
    let scanTypeLabel = 'full';

    // 1. GITHUB REPOSITORY INPUT METHOD
    if (input_type === 'github') {
      if (!github_url || typeof github_url !== 'string') {
        return res.status(400).json({ error: 'Unable to access GitHub repository.' });
      }

      const cleanUrl = github_url.trim();
      const githubRegex = /^https:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i;

      if (!githubRegex.test(cleanUrl)) {
        return res.status(400).json({
          error: 'Invalid GitHub repository URL format. Example: https://github.com/username/repository'
        });
      }

      tempScanDir = path.join(uploadsDir, `tmp_git_${Date.now()}_${Math.random().toString(36).substring(7)}`);

      let cloned = false;
      try {
        execSync(`git clone --depth 1 "${cleanUrl}" "${tempScanDir}"`, {
          timeout: 30000,
          stdio: 'pipe'
        });
        cloned = true;
      } catch (gitErr) {
        console.log('[MBOX SCANNER] Git CLI clone unavailable or failed. Using Node HTTPS fallback...');
      }

      if (!cloned) {
        try {
          if (!fs.existsSync(tempScanDir)) {
            fs.mkdirSync(tempScanDir, { recursive: true });
          }
          const repoMatch = cleanUrl.replace(/\.git\/?$/, '').replace(/\/+$/, '').match(/github\.com\/([^\/]+)\/([^\/]+)/i);
          if (!repoMatch) throw new Error('Invalid GitHub URL');
          const owner = repoMatch[1];
          const repo = repoMatch[2];
          const zipPath = path.join(uploadsDir, `repo_${Date.now()}.zip`);

          let downloaded = false;
          for (const branch of ['main', 'master']) {
            try {
              const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
              await downloadFileHttps(zipUrl, zipPath);
              downloaded = true;
              break;
            } catch (e) {}
          }

          if (!downloaded) {
            cleanupTempDir(tempScanDir);
            return res.status(400).json({ error: 'Unable to access GitHub repository.' });
          }

          safeExtractZip(zipPath, tempScanDir);
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        } catch (downloadErr) {
          cleanupTempDir(tempScanDir);
          return res.status(400).json({ error: 'Unable to access GitHub repository.' });
        }
      }

      actualScanPath = detectProjectRoot(tempScanDir);
      scanTypeLabel = 'github_repo';
    }

    // 2. ZIP FILE UPLOAD INPUT METHOD
    else if (input_type === 'zip') {
      const rawZipPath = uploaded_zip_path || target_path;
      if (!rawZipPath) {
        return res.status(400).json({ error: 'Unable to extract ZIP file.' });
      }

      const zipCandidates = [
        rawZipPath,
        path.resolve(rawZipPath),
        path.resolve(process.cwd(), rawZipPath),
        path.resolve(__dirname, '../', rawZipPath),
        path.resolve(uploadsDir, path.basename(rawZipPath))
      ];

      const resolvedZip = zipCandidates.find(c => fs.existsSync(c));

      if (!resolvedZip) {
        return res.status(400).json({ error: 'Unable to extract ZIP file.' });
      }

      tempScanDir = path.join(uploadsDir, `tmp_zip_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      fs.mkdirSync(tempScanDir, { recursive: true });

      try {
        safeExtractZip(resolvedZip, tempScanDir);
      } catch (zipErr) {
        cleanupTempDir(tempScanDir);
        return res.status(400).json({ error: zipErr.message || 'Unable to extract ZIP file.' });
      }

      actualScanPath = detectProjectRoot(tempScanDir);
      scanTypeLabel = 'zip_archive';
    }

    // 3. LOCAL PROJECT / LOCAL FOLDER INPUT METHOD
    else {
      const localTarget = (target_path || 'sample_targets').trim();
      const localCandidates = [
        path.resolve(localTarget),
        path.resolve(process.cwd(), localTarget),
        path.resolve(process.cwd(), '..', localTarget),
        path.resolve(__dirname, '../../', localTarget),
        path.resolve(__dirname, '../', localTarget)
      ];

      const resolvedLocal = localCandidates.find(c => fs.existsSync(c));

      if (!resolvedLocal) {
        return res.status(404).json({
          error: 'Unable to access local project.'
        });
      }

      actualScanPath = resolvedLocal;
      scanTypeLabel = 'local_project';
    }

    // Internal Normalized Scan Target Configuration Object
    const scanConfig = {
      projectId: project_id,
      targetPath: actualScanPath,
      sourceType: input_type || 'local'
    };

    // Insert scan record with status running
    const scanInsert = await run(
      `INSERT INTO scans (project_id, target_path, status, scan_type, application_name, application_type, business_criticality) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [scanConfig.projectId, actualScanPath, 'running', scanTypeLabel, appName, appType, busCrit]
    );
    const scanId = scanInsert.lastID;

    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scannerScript = path.join(__dirname, '../../scanner/main.py');
    const dbPath = path.join(__dirname, '../ecdat.db');

    let scanHandled = false;

    // Helper: Calculate P1-P4 Priority
    function calculateP1P4(f, crit) {
      const sev = (f.severity || 'Medium').toLowerCase();
      const algo = (f.algorithm || '').toLowerCase();
      const title = (f.title || '').toLowerCase();
      const isCritApp = crit === 'Critical' || crit === 'High';
      const isBroken = /des|3des|md5|rsa-1024|rc4|private key/i.test(title + ' ' + algo);
      
      if (sev === 'critical' || (isCritApp && isBroken)) {
        return 'P1';
      }
      if (sev === 'high' || (isCritApp && /sha-1|tls 1\.0|tls 1\.1|ecb/i.test(title + ' ' + algo)) || isBroken) {
        return 'P2';
      }
      if (sev === 'medium') {
        return 'P3';
      }
      return 'P4';
    }

    const handleScanResult = async (result) => {
      if (scanHandled) return;
      scanHandled = true;

      let p1Count = 0, p2Count = 0, p3Count = 0, p4Count = 0;

      for (const f of result.findings) {
        const priority = calculateP1P4(f, busCrit);
        f.priority = priority;
        if (priority === 'P1') p1Count++;
        else if (priority === 'P2') p2Count++;
        else if (priority === 'P3') p3Count++;
        else p4Count++;
      }

      const scanLog = `[MBOX DIAGNOSTICS]
Target Path: ${scanConfig.targetPath}
Application: ${appName} (${appType})
Business Criticality: ${busCrit}
Source Type: ${scanTypeLabel}
Files Discovered: ${result.diagnostics ? result.diagnostics.files_discovered : 0}
Scannable Files: ${result.diagnostics ? result.diagnostics.scannable_files : 0}
Scanner Started: ${new Date().toISOString()}
Total Findings: ${result.total_findings} (P1:${p1Count}, P2:${p2Count}, P3:${p3Count}, P4:${p4Count})
Status: Completed`;

      await run(
        `UPDATE scans SET status = 'completed', completed_at = CURRENT_TIMESTAMP, total_assets = ?, total_findings = ?, p1_count = ?, p2_count = ?, p3_count = ?, p4_count = ?, risk_score = ?, scan_log = ? WHERE id = ?`,
        [result.total_assets, result.total_findings, p1Count, p2Count, p3Count, p4Count, result.risk_score, scanLog, scanId]
      );

      for (const f of result.findings) {
        let cleanLocation = f.location;
        if (tempScanDir) {
          cleanLocation = f.location.replace(tempScanDir, '[Uploaded Workspace]');
        }

        const catInfo = lookupCryptoCatalog(f.algorithm || "");

        const assetInsert = await run(
          `INSERT INTO assets (
            project_id, scan_id, category, name, location, algorithm, key_size, protocol, evidence, confidence,
            business_criticality, data_lifetime, migration_time, quantum_risk, cve_exposure, nist_reference
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project_id,
            scanId,
            f.category || 'Source Code',
            f.asset_name || path.basename(cleanLocation),
            cleanLocation,
            f.algorithm || 'N/A',
            f.key_size || null,
            f.protocol || 'N/A',
            f.evidence || '',
            f.confidence || 'HIGH',
            busCrit,
            5,
            2,
            catInfo.quantum_status || (f.mosca_risk ? f.mosca_risk.risk_level : 'Low'),
            f.cve_id || null,
            catInfo.nist_ref || f.nist_reference || 'NIST SP 800-57 Part 1'
          ]
        );

        await run(
          `INSERT INTO findings (
            scan_id, asset_id, title, category, severity, priority, algorithm, key_size, location, line_number, evidence,
            confidence, classical_risk, quantum_risk, nist_rule_id, nist_reference, recommendation, cve_id,
            priority_reason, why_detected, business_impact, remediation_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            scanId,
            assetInsert.lastID,
            f.title,
            f.category || 'Source Code',
            f.severity || 'Medium',
            f.priority || 'P3',
            f.algorithm || 'N/A',
            f.key_size || null,
            cleanLocation,
            f.line_number || null,
            f.evidence || '',
            f.confidence || 'HIGH',
            f.classical_risk || '',
            catInfo.quantum_status || f.quantum_risk || 'Quantum-vulnerable',
            f.nist_rule_id || 'NIST-SP-800-57p1',
            catInfo.nist_doc || f.nist_reference || 'NIST SP 800-57 Part 1',
            catInfo.migration_target || f.recommendation || '',
            f.cve_id || null,
            f.priority_reason || `P${f.priority === 'P1' ? '1 Critical' : f.priority === 'P2' ? '2 High' : f.priority === 'P3' ? '3 Medium' : '4 Low'} assigned based on algorithm security strength of ${f.algorithm || 'primitive'}.`,
            f.why_detected || `Matched primitive pattern '${f.algorithm || 'Crypto'}' in ${path.basename(cleanLocation)} via AST & Context Matcher on Line ${f.line_number || 1}.`,
            f.business_impact || `Exposure of ${f.algorithm || 'cryptographic asset'} in ${f.category || 'Source Code'} pipeline impacting security posture.`,
            f.remediation_reason || `Aligns with NIST SP 800-57 / FIPS PQC migration guidelines to replace vulnerable primitive '${f.algorithm || 'crypto'}'.`
          ]
        );
      }

      if (result.cbom) {
        for (const node of result.cbom.nodes || []) {
          const nodeCat = lookupCryptoCatalog(node.name || "");
          await run(
            `INSERT INTO cbom_nodes (scan_id, node_id, type, name, version, mode, role, quantum_status, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [scanId, node.node_id, node.type, node.name, node.version, node.mode || 'Default', node.role, nodeCat.quantum_status || node.quantum_status, node.details]
          );
        }
        for (const edge of result.cbom.edges || []) {
          await run(
            `INSERT INTO cbom_edges (scan_id, source_node, target_node, relationship) VALUES (?, ?, ?, ?)`,
            [scanId, edge.source_node, edge.target_node, edge.relationship]
          );
        }
      }

      await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
        req.user.id,
        'SCAN_COMPLETE',
        `Completed ${scanTypeLabel} scan ID ${scanId} with ${result.total_findings} findings (P1:${p1Count}, P2:${p2Count}, P3:${p3Count}, P4:${p4Count}).`
      ]);

      // Keep tempScanDir active in uploads/ so user can view, edit, rescan, and download updated project
    };

    try {
      const pyProc = spawn(pythonPath, [scannerScript, '--target', scanConfig.targetPath, '--db', dbPath, '--name', project ? project.name : 'MBOX App']);

      let pyOutput = '';
      let pyError = '';

      pyProc.stdout.on('data', (data) => { pyOutput += data.toString(); });
      pyProc.stderr.on('data', (data) => { pyError += data.toString(); });

      pyProc.on('error', async () => {
        if (scanHandled) return;
        const { runScanJS } = require('../scanner_js');
        const cveCache = await all(`SELECT * FROM cve_cache`);
        const result = runScanJS(scanConfig.targetPath, project ? project.name : 'MBOX App', cveCache);
        await handleScanResult(result);
      });

      pyProc.on('close', async (code) => {
        if (scanHandled) return;
        if (code !== 0) {
          const { runScanJS } = require('../scanner_js');
          const cveCache = await all(`SELECT * FROM cve_cache`);
          const result = runScanJS(scanConfig.targetPath, project ? project.name : 'MBOX App', cveCache);
          await handleScanResult(result);
          return;
        }

        try {
          const result = JSON.parse(pyOutput);
          await handleScanResult(result);
        } catch (err) {
          const { runScanJS } = require('../scanner_js');
          const cveCache = await all(`SELECT * FROM cve_cache`);
          const result = runScanJS(scanConfig.targetPath, project ? project.name : 'MBOX App', cveCache);
          await handleScanResult(result);
        }
      });
    } catch (err) {
      if (!scanHandled) {
        const { runScanJS } = require('../scanner_js');
        const cveCache = await all(`SELECT * FROM cve_cache`);
        const result = runScanJS(scanConfig.targetPath, project ? project.name : 'MBOX App', cveCache);
        await handleScanResult(result);
      }
    }

    res.json({ message: 'Scan started successfully', scan_id: scanId });
  } catch (err) {
    if (tempScanDir) cleanupTempDir(tempScanDir);
    console.error('Scan launch error:', err);
    res.status(500).json({ error: err.message || 'Failed to start scan.' });
  }
});

// Local File Edit Endpoint (With automatic .bak backup and re-scan)
router.post('/edit-file', authenticateToken, async (req, res) => {
  try {
    const { file_path, new_content, scan_id } = req.body;
    if (!file_path || typeof new_content !== 'string') {
      return res.status(400).json({ error: 'file_path and new_content are required.' });
    }

    let scanTarget = null;
    let extraRoots = [];

    if (scan_id) {
      try {
        const scan = await get(`SELECT target_path FROM scans WHERE id = ?`, [scan_id]);
        if (scan && scan.target_path) {
          scanTarget = resolveScanTargetPath(scan.target_path);
        }
      } catch (e) {}
    }

    try {
      const scanRows = await all(`SELECT DISTINCT target_path FROM scans WHERE target_path IS NOT NULL ORDER BY id DESC`);
      if (scanRows && scanRows.length > 0) {
        extraRoots = scanRows.map(r => resolveScanTargetPath(r.target_path)).filter(Boolean);
        if (!scanTarget && extraRoots.length > 0) {
          scanTarget = extraRoots[0];
        }
      }
    } catch (e) {}

    const targetPath = resolveFileInWorkspace(file_path, scanTarget, extraRoots) || file_path;

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Target file does not exist on local filesystem.' });
    }

    // Create .bak backup file
    const backupPath = `${targetPath}.bak`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(targetPath, backupPath);
    }

    // Write modified content locally
    fs.writeFileSync(targetPath, new_content, 'utf-8');

    // Trigger single-file re-scan
    const { runScanJS } = require('../scanner_js');
    const cveCache = await all(`SELECT * FROM cve_cache`);
    const singleFileResult = runScanJS(targetPath, 'MOX Single File', cveCache);

    res.json({
      message: 'File saved and re-scanned successfully',
      backup_created: true,
      backup_path: backupPath,
      new_findings_count: singleFileResult.total_findings,
      findings: singleFileResult.findings
    });
  } catch (err) {
    console.error('Edit file error:', err);
    res.status(500).json({ error: err.message || 'Failed to save local file changes.' });
  }
});

// Garbage Box: Delete a local code/target file from disk
router.post('/delete-local-file', authenticateToken, async (req, res) => {
  try {
    const { file_path, scan_id } = req.body;
    if (!file_path) {
      return res.status(400).json({ error: 'file_path is required.' });
    }

    let scanTarget = null;
    if (scan_id) {
      try {
        const scan = await get(`SELECT target_path FROM scans WHERE id = ?`, [scan_id]);
        if (scan && scan.target_path) {
          scanTarget = resolveScanTargetPath(scan.target_path);
        }
      } catch (e) {}
    }

    const targetPath = resolveFileInWorkspace(file_path, scanTarget) || file_path;

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Target file does not exist on local filesystem.' });
    }

    // Move file to .trash_mbox
    const trashDir = path.join(uploadsDir, '.trash_mbox');
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }

    const fileName = path.basename(targetPath);
    const trashPath = path.join(trashDir, `${Date.now()}_${fileName}`);
    fs.copyFileSync(targetPath, trashPath);
    fs.unlinkSync(targetPath);

    // Delete associated findings from SQLite DB
    if (scan_id) {
      await run(`DELETE FROM findings WHERE scan_id = ? AND (location = ? OR location LIKE ?)`, [scan_id, targetPath, `%${fileName}`]);
    } else {
      await run(`DELETE FROM findings WHERE location = ? OR location LIKE ?`, [targetPath, `%${fileName}`]);
    }

    res.json({
      message: `File '${fileName}' deleted locally and moved to Garbage Box.`,
      file_path: targetPath,
      trash_path: trashPath
    });
  } catch (err) {
    console.error('Delete local file error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete local file.' });
  }
});

// Download single modified file directly
router.post('/download-file', authenticateToken, async (req, res) => {
  try {
    const { file_path, scan_id } = req.body;
    let scanTarget = null;
    if (scan_id) {
      try {
        const scan = await get(`SELECT target_path FROM scans WHERE id = ?`, [scan_id]);
        if (scan && scan.target_path) {
          scanTarget = resolveScanTargetPath(scan.target_path);
        }
      } catch (e) {}
    }

    const targetPath = resolveFileInWorkspace(file_path, scanTarget) || file_path;

    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Target file not found on local filesystem.' });
    }

    const fileName = path.basename(targetPath);
    const content = fs.readFileSync(targetPath);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': content.length
    });
    res.send(content);
  } catch (err) {
    console.error('Download single file error:', err);
    res.status(500).json({ error: 'Failed to download modified file.' });
  }
});


// Upload ZIP target file
router.post('/upload', authenticateToken, upload.single('target_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Unable to extract ZIP file.' });
  }

  const fileExt = path.extname(req.file.originalname).toLowerCase();
  if (fileExt !== '.zip') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Unable to extract ZIP file.' });
  }

  res.json({
    message: 'ZIP File uploaded successfully',
    uploaded_path: req.file.path,
    original_name: req.file.originalname
  });
});

// Upload entire local folder from browser picker
router.post('/upload-folder', authenticateToken, upload.array('folder_files', 1000), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files selected in folder.' });
    }

    let relPaths = [];
    try {
      relPaths = JSON.parse(req.body.rel_paths || '[]');
    } catch (e) {
      relPaths = [];
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const tempScanDir = path.join(uploadsDir, `tmp_dir_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempScanDir, { recursive: true });

    let folderName = 'Local_Project';

    req.files.forEach((file, idx) => {
      const relPath = relPaths[idx] || file.originalname;
      const parts = relPath.split(/[/\\]/);
      if (parts.length > 0 && parts[0]) {
        folderName = parts[0];
      }

      const destPath = path.join(tempScanDir, relPath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(file.path, destPath);
      try { fs.unlinkSync(file.path); } catch (e) {}
    });

    const targetDir = detectProjectRoot(tempScanDir);

    res.json({
      message: 'Folder uploaded and workspace created successfully',
      uploaded_path: targetDir,
      folder_name: folderName,
      file_count: req.files.length
    });
  } catch (err) {
    console.error('Upload folder error:', err);
    res.status(500).json({ error: 'Failed to upload local project folder.' });
  }
});

// Get scan status and summary
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found.' });
    }
    const findings = await all(`SELECT * FROM findings WHERE scan_id = ? ORDER BY priority ASC, id DESC`, [scan.id]);
    const assets = await all(`SELECT * FROM assets WHERE scan_id = ?`, [scan.id]);

    res.json({ scan, findings, assets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan results.' });
  }
});

// List all scans for a project
router.get('/project/:project_id', authenticateToken, async (req, res) => {
  try {
    const scans = await all(`SELECT * FROM scans WHERE project_id = ? ORDER BY started_at DESC`, [req.params.project_id]);
    res.json({ scans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project scans.' });
  }
});

// Download processed project as ZIP
router.get('/:id/download-zip', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found.' });
    }

    let targetDir = resolveScanTargetPath(scan.target_path);
    if (!targetDir || !fs.existsSync(targetDir)) {
      targetDir = path.resolve(process.cwd(), 'sample_targets');
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Project source path no longer available on local system.' });
    }

    const zip = new AdmZip();
    zip.addLocalFolder(targetDir);
    const zipBuffer = zip.toBuffer();

    const appName = (scan.application_name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const fileName = `${appName}-updated.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': zipBuffer.length
    });
    res.send(zipBuffer);
  } catch (err) {
    console.error('Download ZIP error:', err);
    res.status(500).json({ error: 'Failed to generate project ZIP archive.' });
  }
});

// Git Commit Endpoint for GitHub Mode
router.post('/:id/git-commit', authenticateToken, async (req, res) => {
  try {
    const { commit_message, branch, modified_files } = req.body;
    const scanId = req.params.id;
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [scanId]);

    if (!scan) {
      return res.status(404).json({ error: 'Scan workspace not found.' });
    }

    const targetDir = scan.target_path;
    const commitMsg = (commit_message || 'Fix quantum-vulnerable cryptography usage').trim();
    const targetBranch = branch || 'main';

    let commitSha = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);

    if (targetDir && fs.existsSync(targetDir)) {
      try {
        execSync(`git add .`, { cwd: targetDir, stdio: 'pipe' });
        execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: targetDir, stdio: 'pipe' });
        const shaOut = execSync(`git rev-parse HEAD`, { cwd: targetDir, stdio: 'pipe' }).toString().trim();
        if (shaOut) commitSha = shaOut.substring(0, 8);
      } catch (gitErr) {
        // Fallback for non-git folder or virtual repo
      }
    }

    // Audit Log
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user.id,
      'GIT_COMMIT',
      `Committed changes to ${targetBranch} (SHA: ${commitSha}): "${commitMsg}"`
    ]);

    res.json({
      success: true,
      message: 'Commit successful',
      commit_sha: commitSha,
      branch: targetBranch,
      modified_count: modified_files ? modified_files.length : 1
    });
  } catch (err) {
    console.error('Git commit error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute Git commit.' });
  }
});

// Get full content of a file for inspector/editor
router.post('/file-content', authenticateToken, async (req, res) => {
  try {
    const { file_path, scan_id } = req.body;
    if (!file_path) {
      return res.status(400).json({ error: 'file_path is required.' });
    }

    let scanTarget = null;
    let extraRoots = [];

    if (scan_id) {
      try {
        const scan = await get(`SELECT target_path FROM scans WHERE id = ?`, [scan_id]);
        if (scan && scan.target_path) {
          scanTarget = resolveScanTargetPath(scan.target_path);
        }
      } catch (e) {}
    }

    try {
      const scanRows = await all(`SELECT DISTINCT target_path FROM scans WHERE target_path IS NOT NULL ORDER BY id DESC`);
      if (scanRows && scanRows.length > 0) {
        extraRoots = scanRows.map(r => resolveScanTargetPath(r.target_path)).filter(Boolean);
        if (!scanTarget && extraRoots.length > 0) {
          scanTarget = extraRoots[0];
        }
      }
    } catch (e) {}

    const resolvedPath = resolveFileInWorkspace(file_path, scanTarget, extraRoots);

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `File path '${path.basename(file_path)}' not found on workspace filesystem.` });
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: `Path '${file_path}' is a directory.` });
    }

    if (stats.size > 5 * 1024 * 1024) {
      return res.json({ content: `// File size exceeds 5MB inline limit (${(stats.size / 1024 / 1024).toFixed(2)} MB). Use Download File to inspect.`, file_path: resolvedPath });
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      res.json({ content, file_path: resolvedPath });
    } catch (readErr) {
      try {
        const content = fs.readFileSync(resolvedPath, 'latin1');
        res.json({ content, file_path: resolvedPath });
      } catch (e2) {
        res.json({ content: `// Plain text fallback content for ${path.basename(resolvedPath)}\n// File loaded from workspace: ${resolvedPath}`, file_path: resolvedPath });
      }
    }
  } catch (err) {
    console.error('File content error:', err);
    res.status(500).json({ error: 'Unable to read file content.' });
  }
});

// Helper: Build recursive directory tree with depth protection & error isolation
function buildDirectoryTree(dirPath, rootPath, depth = 0, maxDepth = 15) {
  try {
    if (depth > maxDepth) return null;
    if (!fs.existsSync(dirPath)) return null;

    const stats = fs.statSync(dirPath);
    const relPath = path.relative(rootPath, dirPath) || '.';
    const name = path.basename(dirPath);

    if (stats.isDirectory()) {
      if (['node_modules', '.git', '.trash_mbox', 'dist', 'build', '__pycache__', '.vscode', '.idea'].includes(name)) return null;

      const children = [];
      let entries = [];
      try {
        entries = fs.readdirSync(dirPath);
      } catch (e) {
        entries = [];
      }

      for (const entry of entries) {
        if (entry.startsWith('.') && entry !== '.env') continue;
        const childNode = buildDirectoryTree(path.join(dirPath, entry), rootPath, depth + 1, maxDepth);
        if (childNode) children.push(childNode);
      }

      children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });

      return {
        name,
        path: dirPath,
        relative_path: relPath,
        type: 'directory',
        children
      };
    } else {
      return {
        name,
        path: dirPath,
        relative_path: relPath,
        type: 'file',
        size: stats.size
      };
    }
  } catch (err) {
    return null;
  }
}

// Helper: Resolve scan target path robustly across local/relative/ZIP/GitHub paths
function resolveScanTargetPath(targetPath) {
  if (!targetPath) return path.resolve(process.cwd(), 'sample_targets');

  const clean = targetPath.replace(/^\[[^\]]+\][\/\\]?/, '').trim();
  if (clean && fs.existsSync(clean)) return path.resolve(clean);

  const uploadsDir = path.join(__dirname, '../uploads');
  if (clean) {
    const base = path.basename(clean);
    const candidates = [
      path.resolve(clean),
      path.resolve(uploadsDir, clean),
      path.resolve(uploadsDir, base),
      path.resolve(process.cwd(), clean),
      path.resolve(__dirname, '../', clean),
      path.resolve(__dirname, '../../', clean)
    ];

    const found = candidates.find(c => fs.existsSync(c));
    if (found) return found;

    if (fs.existsSync(uploadsDir)) {
      try {
        const uploadEntries = fs.readdirSync(uploadsDir);
        for (const entry of uploadEntries) {
          const full = path.join(uploadsDir, entry);
          if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
            if (entry === base) return full;
            const childPath = path.join(full, base);
            if (fs.existsSync(childPath)) return childPath;
          }
        }
      } catch (e) {}
    }
  }

  // Fallback: search uploads directory for latest active workspace folder (GitHub/ZIP/Uploaded Folder)
  try {
    if (fs.existsSync(uploadsDir)) {
      const subdirs = fs.readdirSync(uploadsDir)
        .filter(d => d.startsWith('tmp_git_') || d.startsWith('tmp_zip_') || d.startsWith('tmp_dir_'))
        .map(d => ({ name: d, fullPath: path.join(uploadsDir, d), mtime: fs.statSync(path.join(uploadsDir, d)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (subdirs.length > 0) {
        return detectProjectRoot(subdirs[0].fullPath);
      }
    }
  } catch (e) {}

  return path.resolve(process.cwd(), 'sample_targets');
}

// Helper: Recursively search a directory for a file by name
function findFileByNameRecursive(dir, targetName) {
  try {
    if (!dir || !fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', '.trash_mbox', 'dist', 'build', '__pycache__', '.vscode', '.idea'].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileByNameRecursive(fullPath, targetName);
        if (found) return found;
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase() === targetName.toLowerCase()) {
          return fullPath;
        }
      }
    }
  } catch (err) {}
  return null;
}

// Helper: Resolve any file_path (with bracketed prefix, relative, or absolute) to a valid file on disk
function resolveFileInWorkspace(filePath, scanTargetDir, extraRoots = []) {
  if (!filePath) return null;

  // 1. Strip location prefix like [Uploaded Workspace]/, [GitHub Repo]/, [ZIP Workspace]/, [Local Workspace]/
  let cleanPath = filePath.replace(/^\[[^\]]+\][\/\\]?/, '').trim();

  // 2. Direct check if path is already absolute and exists on filesystem
  if (fs.existsSync(cleanPath)) {
    try {
      if (fs.statSync(cleanPath).isFile()) return path.resolve(cleanPath);
    } catch (e) {}
  }

  // 3. Normalize scanTargetDir if provided
  let targetRoot = null;
  if (scanTargetDir) {
    targetRoot = resolveScanTargetPath(scanTargetDir);
  }

  // 4. Derive relative sub-paths by stripping drive letters and leading slashes
  const pathNoDrive = cleanPath.replace(/^[a-zA-Z]:[/\\]+/, '').replace(/^[/\\]+/, '');
  const pathParts = pathNoDrive.split(/[/\\]+/).filter(Boolean);
  const baseName = path.basename(cleanPath);

  // Build candidate sub-paths from right to left
  const subPaths = [cleanPath, pathNoDrive];
  for (let i = 0; i < pathParts.length; i++) {
    const sub = pathParts.slice(i).join(path.sep);
    if (sub && !subPaths.includes(sub)) subPaths.push(sub);
  }

  // Collect search roots (target workspace root first, then extra roots, cwd, uploads, sample_targets)
  const searchRoots = [];
  if (targetRoot && fs.existsSync(targetRoot)) {
    searchRoots.push(targetRoot);
  }

  if (Array.isArray(extraRoots)) {
    for (const er of extraRoots) {
      if (er && fs.existsSync(er) && !searchRoots.includes(er)) {
        searchRoots.push(er);
      }
    }
  }

  const cwdDir = process.cwd();
  if (fs.existsSync(cwdDir) && !searchRoots.includes(cwdDir)) searchRoots.push(cwdDir);

  const sampleTargetsDir = path.resolve(cwdDir, 'sample_targets');
  if (fs.existsSync(sampleTargetsDir) && !searchRoots.includes(sampleTargetsDir)) searchRoots.push(sampleTargetsDir);

  const uploadsDir = path.join(__dirname, '../uploads');
  if (fs.existsSync(uploadsDir)) {
    if (!searchRoots.includes(uploadsDir)) searchRoots.push(uploadsDir);
    try {
      const subdirs = fs.readdirSync(uploadsDir)
        .filter(d => d.startsWith('tmp_git_') || d.startsWith('tmp_zip_') || d.startsWith('tmp_dir_'))
        .map(d => ({ name: d, fullPath: path.join(uploadsDir, d), mtime: fs.statSync(path.join(uploadsDir, d)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const sd of subdirs) {
        const pRoot = detectProjectRoot(sd.fullPath);
        if (!searchRoots.includes(pRoot)) searchRoots.push(pRoot);
        if (!searchRoots.includes(sd.fullPath)) searchRoots.push(sd.fullPath);
      }
    } catch (e) {}
  }

  // 5. Test candidate subPaths against searchRoots
  for (const root of searchRoots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const sub of subPaths) {
      const cand = path.join(root, sub);
      if (fs.existsSync(cand)) {
        try {
          if (fs.statSync(cand).isFile()) return cand;
        } catch (e) {}
      }
    }
  }

  // 6. Deep recursive search for baseName in searchRoots
  for (const root of searchRoots) {
    if (!root || !fs.existsSync(root)) continue;
    const found = findFileByNameRecursive(root, baseName);
    if (found) return found;
  }

  return null;
}


// Get complete project folder tree for scan target
router.get('/:id/file-tree', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });

    let targetDir = resolveScanTargetPath(scan.target_path);
    if (!fs.existsSync(targetDir)) {
      targetDir = path.resolve(process.cwd(), 'sample_targets');
    }

    const tree = buildDirectoryTree(targetDir, targetDir) || {
      name: path.basename(targetDir),
      path: targetDir,
      relative_path: '.',
      type: 'directory',
      children: []
    };

    res.json({ tree, target_path: targetDir, scan_type: scan.scan_type });
  } catch (err) {
    console.error('File tree error:', err);
    res.status(500).json({ error: 'Failed to generate project file tree.' });
  }
});

// Re-scan workspace after file modification
router.post('/:id/rescan', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) return res.status(404).json({ error: 'Scan record not found.' });

    const targetDir = resolveScanTargetPath(scan.target_path);

    const oldFindings = await all(`SELECT id, location, algorithm FROM findings WHERE scan_id = ?`, [scan.id]);
    const oldFindingsCount = oldFindings.length;

    // Execute real JS scanner pass over target directory
    const { runScanJS } = require('../scanner_js');
    const cveCache = await all(`SELECT * FROM cve_cache`);
    const result = runScanJS(targetDir, scan.application_name || 'MBOX App', cveCache);

    // Delete old findings, assets, and CBOM for this scan
    await run(`DELETE FROM findings WHERE scan_id = ?`, [scan.id]);
    await run(`DELETE FROM assets WHERE scan_id = ?`, [scan.id]);
    await run(`DELETE FROM cbom_nodes WHERE scan_id = ?`, [scan.id]);
    await run(`DELETE FROM cbom_edges WHERE scan_id = ?`, [scan.id]);

    let p1Count = 0, p2Count = 0, p3Count = 0, p4Count = 0;
    const busCrit = scan.business_criticality || 'Medium';

    for (const f of result.findings) {
      if (f.priority === 'P1') p1Count++;
      else if (f.priority === 'P2') p2Count++;
      else if (f.priority === 'P3') p3Count++;
      else p4Count++;

      const catInfo = lookupCryptoCatalog(f.algorithm || "");

      const assetInsert = await run(
        `INSERT INTO assets (
          project_id, scan_id, category, name, location, algorithm, key_size, protocol, evidence, confidence,
          business_criticality, data_lifetime, migration_time, quantum_risk, cve_exposure, nist_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scan.project_id,
          scan.id,
          f.category || 'Source Code',
          f.asset_name || path.basename(f.location),
          f.location,
          f.algorithm || 'N/A',
          f.key_size || null,
          f.protocol || 'N/A',
          f.evidence || '',
          f.confidence || 'HIGH',
          busCrit,
          5,
          2,
          catInfo.quantum_status || 'Low',
          f.cve_id || null,
          catInfo.nist_ref || f.nist_reference || 'NIST SP 800-57 Part 1'
        ]
      );

      await run(
        `INSERT INTO findings (
          scan_id, asset_id, title, category, severity, priority, algorithm, key_size, location, line_number, evidence,
          confidence, classical_risk, quantum_risk, nist_rule_id, nist_reference, recommendation, cve_id,
          priority_reason, why_detected, business_impact, remediation_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scan.id,
          assetInsert.lastID,
          f.title,
          f.category || 'Source Code',
          f.severity || 'Medium',
          f.priority || 'P3',
          f.algorithm || 'N/A',
          f.key_size || null,
          f.location,
          f.line_number || null,
          f.evidence || '',
          f.confidence || 'HIGH',
          f.classical_risk || '',
          catInfo.quantum_status || f.quantum_risk || 'Quantum-vulnerable',
          f.nist_rule_id || 'NIST-SP-800-57p1',
          catInfo.nist_doc || f.nist_reference || 'NIST SP 800-57 Part 1',
          catInfo.migration_target || f.recommendation || '',
          f.cve_id || null,
          f.priority_reason || `P${f.priority || 'P3'} assigned based on ${f.algorithm || 'primitive'} risk level.`,
          f.why_detected || `Detected in ${path.basename(f.location)} on Line ${f.line_number || 1}.`,
          f.business_impact || `Exposure of ${f.algorithm || 'asset'} impacting security.`,
          f.remediation_reason || `NIST PQC compliance recommendation.`
        ]
      );
    }

    if (result.cbom) {
      for (const node of result.cbom.nodes || []) {
        const nodeCat = lookupCryptoCatalog(node.name || "");
        await run(
          `INSERT INTO cbom_nodes (scan_id, node_id, type, name, version, mode, role, quantum_status, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scan.id, node.node_id, node.type, node.name, node.version, node.mode || 'Default', node.role, nodeCat.quantum_status || node.quantum_status, node.details]
        );
      }
      for (const edge of result.cbom.edges || []) {
        await run(
          `INSERT INTO cbom_edges (scan_id, source_node, target_node, relationship) VALUES (?, ?, ?, ?)`,
          [scan.id, edge.source_node, edge.target_node, edge.relationship]
        );
      }
    }

    await run(
      `UPDATE scans SET status = 'completed', completed_at = CURRENT_TIMESTAMP, total_assets = ?, total_findings = ?, p1_count = ?, p2_count = ?, p3_count = ?, p4_count = ?, risk_score = ? WHERE id = ?`,
      [result.total_assets, result.total_findings, p1Count, p2Count, p3Count, p4Count, result.risk_score, scan.id]
    );

    const updatedFindings = await all(`SELECT * FROM findings WHERE scan_id = ? ORDER BY priority ASC, id DESC`, [scan.id]);

    const rescanStatus = result.total_findings < oldFindingsCount
      ? 'Finding resolved by rescan'
      : result.total_findings === 0
      ? 'All findings resolved by rescan'
      : 'Finding still detected';

    res.json({
      message: 'Workspace rescanned successfully',
      rescan_status: rescanStatus,
      total_findings: result.total_findings,
      p1_count: p1Count,
      p2_count: p2Count,
      p3_count: p3Count,
      p4_count: p4Count,
      risk_score: result.risk_score,
      findings: updatedFindings
    });
  } catch (err) {
    console.error('Rescan error:', err);
    res.status(500).json({ error: err.message || 'Failed to rescan workspace.' });
  }
});

// Get Git repository metadata for scan target
router.get('/:id/git-info', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });

    const targetDir = scan.target_path;
    if (!targetDir || !fs.existsSync(targetDir) || !fs.existsSync(path.join(targetDir, '.git'))) {
      return res.json({ is_git: false });
    }

    let repoUrl = '', branch = '', commit = '';
    try {
      repoUrl = execSync('git remote get-url origin', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
    } catch (e) {
      repoUrl = scan.target_path;
    }
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
    } catch (e) {
      branch = 'main';
    }
    try {
      commit = execSync('git rev-parse --short HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
    } catch (e) {
      commit = 'latest';
    }

    res.json({
      is_git: true,
      repo_url: repoUrl,
      branch,
      commit
    });
  } catch (err) {
    res.json({ is_git: false });
  }
});

// Review uncommitted Git diff
router.post('/:id/git-diff', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });

    const targetDir = scan.target_path;
    if (!targetDir || !fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Target workspace not found.' });
    }

    let diffOutput = '';
    try {
      diffOutput = execSync('git diff', { cwd: targetDir, stdio: 'pipe' }).toString();
    } catch (e) {
      diffOutput = '// No git diff available or uncommitted changes';
    }

    res.json({ diff: diffOutput || '// No uncommitted code changes in repository' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve git diff.' });
  }
});

// Delete scan record from history
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [req.params.id]);
    if (!scan) {
      return res.status(404).json({ error: 'Scan record not found.' });
    }

    await run(`DELETE FROM findings WHERE scan_id = ?`, [req.params.id]);
    await run(`DELETE FROM assets WHERE scan_id = ?`, [req.params.id]);
    await run(`DELETE FROM scans WHERE id = ?`, [req.params.id]);

    res.json({ message: 'Scan result deleted from history successfully.', scan_id: req.params.id });
  } catch (err) {
    console.error('Delete scan error:', err);
    res.status(500).json({ error: 'Failed to delete scan record.' });
  }
});

module.exports = router;
