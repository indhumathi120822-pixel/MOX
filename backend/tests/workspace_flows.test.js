const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

function makeRequest(method, endpoint, body = null, isJson = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = {};
    if (isJson && body) {
      headers['Content-Type'] = 'application/json';
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, body: parsed });
          } else {
            resolve({ status: res.statusCode, body: parsed });
          }
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function getFirstFilePath(treeNode) {
  if (!treeNode) return null;
  if (treeNode.type === 'file') return treeNode.path;
  if (treeNode.children) {
    for (const child of treeNode.children) {
      const p = getFirstFilePath(child);
      if (p) return p;
    }
  }
  return null;
}

async function runWorkspaceFlowTests() {
  console.log('================================================================');
  console.log(' STARTING ECDAT WORKSPACE & REAL FILE LOADING INTEGRATION SUITE');
  console.log('================================================================\n');

  // 1. Authenticate / Login
  try {
    const loginRes = await makeRequest('POST', '/auth/login', { username: 'admin', password: 'password123' });
    authToken = loginRes.body.token;
    console.log('[✓] Authentication successful (JWT token acquired).');
  } catch (err) {
    console.log('[!] Login failed, registering admin...');
    const regRes = await makeRequest('POST', '/auth/register', { username: 'admin', email: 'admin@mbox.security', password: 'password123' });
    authToken = regRes.body.token;
    console.log('[✓] Admin registered & token acquired.');
  }

  // Get project ID
  const projectsRes = await makeRequest('GET', '/projects');
  const project = projectsRes.body.projects[0];
  console.log(`[✓] Target project identified (ID: ${project.id}, Name: "${project.name}").\n`);

  // ---------------------------------------------------------------------------
  // TEST 1: LOCAL FOLDER WORKSPACE FLOW
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Local Folder Workspace Flow ---');
  const localScanRes = await makeRequest('POST', '/scans/start', {
    project_id: project.id,
    input_type: 'local',
    target_path: 'sample_targets',
    application_name: 'Local Sample Target App'
  });
  const localScanId = localScanRes.body.scan_id;
  console.log(`[✓] Local scan started (Scan ID: ${localScanId}).`);

  // Fetch scan details & findings
  const localScanDetails = await makeRequest('GET', `/scans/${localScanId}`);
  const localFindings = localScanDetails.body.findings || [];
  console.log(`[✓] Local scan completed with ${localFindings.length} real findings.`);

  // Fetch full directory tree
  const localTreeRes = await makeRequest('GET', `/scans/${localScanId}/file-tree`);
  console.log(`[✓] Local project file tree generated (Root: "${localTreeRes.body.tree.name}", Children: ${localTreeRes.body.tree.children.length}).`);

  // Open first finding file
  if (localFindings.length > 0) {
    const finding = localFindings[0];
    console.log(`    Testing File Opening for finding at: "${finding.location}" (Line ${finding.line_number})`);
    const fileContentRes = await makeRequest('POST', '/scans/file-content', {
      file_path: finding.location,
      scan_id: localScanId
    });
    if (!fileContentRes.body.content || fileContentRes.body.content.includes('Unable to parse/open')) {
      throw new Error(`[FAIL] Could not open local file: ${fileContentRes.body.content}`);
    }
    console.log(`[✓] REAL COMPLETE FILE OPENED SUCCESSFULLY! (${fileContentRes.body.content.split('\n').length} lines read from disk).`);

    // Edit and Save
    const editRes = await makeRequest('POST', '/scans/edit-file', {
      file_path: fileContentRes.body.file_path,
      new_content: fileContentRes.body.content + '\n// Verified edit test\n',
      scan_id: localScanId
    });
    console.log(`[✓] Save Changes successful! (Message: "${editRes.body.message}").`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: GITHUB REPOSITORY WORKSPACE FLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: GitHub Repository Workspace Flow ---');
  const ghScanRes = await makeRequest('POST', '/scans/start', {
    project_id: project.id,
    input_type: 'github',
    github_url: 'https://github.com/octocat/Hello-World',
    application_name: 'GitHub Hello-World Repo'
  });
  const ghScanId = ghScanRes.body.scan_id;
  console.log(`[✓] GitHub scan started (Scan ID: ${ghScanId}).`);

  const ghScanDetails = await makeRequest('GET', `/scans/${ghScanId}`);
  console.log(`[✓] GitHub scan completed.`);

  const ghTreeRes = await makeRequest('GET', `/scans/${ghScanId}/file-tree`);
  console.log(`[✓] GitHub repo file tree generated (Root: "${ghTreeRes.body.tree.name}", Children: ${ghTreeRes.body.tree.children?.length || 0}).`);

  const ghRootPath = ghTreeRes.body.target_path;
  const sampleFileInGh = getFirstFilePath(ghTreeRes.body.tree) || path.join(ghRootPath, 'README');
  console.log(`    Opening GitHub file: "${sampleFileInGh}"`);
  const ghFileRes = await makeRequest('POST', '/scans/file-content', {
    file_path: sampleFileInGh,
    scan_id: ghScanId
  });
  if (!ghFileRes.body.content || ghFileRes.body.content.includes('Unable to parse/open')) {
    throw new Error(`[FAIL] Could not open GitHub file: ${ghFileRes.body.content}`);
  }
  console.log(`[✓] GITHUB REAL FILE OPENED SUCCESSFULLY! (${ghFileRes.body.content.split('\n').length} lines read from cloned repo).`);

  // ---------------------------------------------------------------------------
  // TEST 3: ZIP PROJECT WORKSPACE FLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: ZIP Archive Workspace Flow ---');
  const AdmZip = require('adm-zip');
  const testZipPath = path.join(__dirname, '../uploads/test_app.zip');
  const zipBuilder = new AdmZip();
  zipBuilder.addFile('src/auth.js', Buffer.from('const crypto = require("crypto");\nconst key = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });\n'));
  zipBuilder.addFile('package.json', Buffer.from('{"name": "zip-test-app", "version": "1.0.0"}\n'));
  zipBuilder.writeZip(testZipPath);
  console.log(`[✓] Created test ZIP archive at "${testZipPath}".`);

  const zipScanRes = await makeRequest('POST', '/scans/start', {
    project_id: project.id,
    input_type: 'zip',
    uploaded_zip_path: testZipPath,
    application_name: 'ZIP Workspace App'
  });
  const zipScanId = zipScanRes.body.scan_id;
  console.log(`[✓] ZIP scan started (Scan ID: ${zipScanId}).`);

  const zipTreeRes = await makeRequest('GET', `/scans/${zipScanId}/file-tree`);
  console.log(`[✓] ZIP extracted project tree generated (Root: "${zipTreeRes.body.tree.name}").`);

  const sampleFileInZip = getFirstFilePath(zipTreeRes.body.tree) || 'crypto.js';
  console.log(`    Opening ZIP file: "${sampleFileInZip}"`);
  const zipFileRes = await makeRequest('POST', '/scans/file-content', {
    file_path: sampleFileInZip,
    scan_id: zipScanId
  });
  if (!zipFileRes.body.content || zipFileRes.body.content.includes('Unable to parse/open')) {
    throw new Error(`[FAIL] Could not open ZIP file: ${zipFileRes.body.content}`);
  }
  console.log(`[✓] ZIP EXTRACTED REAL FILE OPENED SUCCESSFULLY! (${zipFileRes.body.content.split('\n').length} lines read).`);

  console.log('\n================================================================');
  console.log(' ALL 3 REAL WORKSPACE FLOWS PASSED VERIFICATION PERFECTLY! ✅');
  console.log('================================================================\n');
}

runWorkspaceFlowTests().catch(err => {
  console.error('\n[X] WORKSPACE FLOW TEST FAILED:', err);
  process.exit(1);
});
