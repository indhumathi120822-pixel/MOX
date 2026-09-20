const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const BASE_URL = 'http://localhost:5000/api';

function makeRequest(urlPath, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + urlPath);
    const postData = data ? JSON.stringify(data) : null;
    
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, error: parsed.error || body });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) reject({ status: res.statusCode, error: body });
          else resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function pollScan(token, scanId) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await makeRequest(`/scans/${scanId}`, 'GET', null, { Authorization: `Bearer ${token}` });
        if (res.scan.status === 'completed') {
          clearInterval(interval);
          resolve(res);
        } else if (res.scan.status === 'failed') {
          clearInterval(interval);
          reject(new Error(res.scan.scan_log || 'Scan failed'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 1000);
  });
}

async function testAllThreeInputs() {
  console.log('=== STARTING ACCEPTANCE TEST FOR ALL 3 SCAN INPUT METHODS ===\n');

  // 1. Login or Register
  let token = '';
  try {
    const regRes = await makeRequest('/auth/register', 'POST', {
      username: 'testanalyst_' + Date.now(),
      email: 'testanalyst_' + Date.now() + '@mbox.local',
      password: 'password123'
    });
    token = regRes.token;
  } catch (err) {
    const loginRes = await makeRequest('/auth/login', 'POST', {
      email: 'testanalyst@mbox.local',
      password: 'password123'
    });
    token = loginRes.token;
  }
  console.log('✓ Auth Token Obtained successfully.');

  // TEST A: LOCAL PROJECT
  console.log('\n--- TEST A: Local Project Scan ---');
  const localScan = await makeRequest('/scans/start', 'POST', {
    input_type: 'local',
    target_path: 'sample_targets'
  }, { Authorization: `Bearer ${token}` });

  console.log(`Local Scan launched with ID #${localScan.scan_id}. Polling...`);
  const localResult = await pollScan(token, localScan.scan_id);
  console.log(`✓ TEST A PASSED: Discovered ${localResult.assets.length} assets, ${localResult.findings.length} findings, Risk: ${localResult.scan.risk_score}/10`);

  // TEST B: ZIP FILE SCAN
  console.log('\n--- TEST B: ZIP File Upload Scan ---');
  const tempZipPath = path.join(__dirname, 'sample_test_archive.zip');
  const zip = new AdmZip();
  zip.addFile('CryptoApp.java', Buffer.from(`
    import javax.crypto.Cipher;
    public class CryptoApp {
      public static void main(String[] args) throws Exception {
        Cipher c = Cipher.getInstance("DES");
      }
    }
  `));
  zip.writeZip(tempZipPath);

  const zipScan = await makeRequest('/scans/start', 'POST', {
    input_type: 'zip',
    uploaded_zip_path: tempZipPath
  }, { Authorization: `Bearer ${token}` });

  console.log(`ZIP Scan launched with ID #${zipScan.scan_id}. Polling...`);
  const zipResult = await pollScan(token, zipScan.scan_id);
  console.log(`✓ TEST B PASSED: Discovered ${zipResult.assets.length} assets, ${zipResult.findings.length} findings, Risk: ${zipResult.scan.risk_score}/10`);
  if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);

  // TEST C: GITHUB REPOSITORY SCAN
  console.log('\n--- TEST C: GitHub Repository Scan ---');
  const githubScan = await makeRequest('/scans/start', 'POST', {
    input_type: 'github',
    github_url: 'https://github.com/octocat/Hello-World'
  }, { Authorization: `Bearer ${token}` });

  console.log(`GitHub Scan launched with ID #${githubScan.scan_id}. Polling...`);
  const githubResult = await pollScan(token, githubScan.scan_id);
  console.log(`✓ TEST C PASSED: Status = ${githubResult.scan.status}, Discovered ${githubResult.assets.length} assets, ${githubResult.findings.length} findings.`);

  console.log('\n==================================================');
  console.log('ALL 3 SCANNER INPUT METHODS PASSED 100% SUCCESSFULLY!');
  console.log('==================================================');
}

testAllThreeInputs().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
