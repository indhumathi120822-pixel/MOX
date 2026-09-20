const http = require('http');
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
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testExpressRepo() {
  const regRes = await makeRequest('/auth/register', 'POST', {
    username: 'express_tester_' + Date.now(),
    email: 'express_tester_' + Date.now() + '@mbox.local',
    password: 'password123'
  });
  const token = regRes.token;

  console.log('Testing GitHub repo scan for expressjs/express...');
  const githubScan = await makeRequest('/scans/start', 'POST', {
    input_type: 'github',
    github_url: 'https://github.com/expressjs/express'
  }, { Authorization: `Bearer ${token}` });

  const scanId = githubScan.scan_id;
  console.log(`Scan started ID #${scanId}. Polling status...`);

  const pollInterval = setInterval(async () => {
    const check = await makeRequest(`/scans/${scanId}`, 'GET', null, { Authorization: `Bearer ${token}` });
    if (check.scan.status === 'completed') {
      clearInterval(pollInterval);
      console.log('✓ GitHub Scan Completed Successfully!');
      console.log(`Target path resolved: ${check.scan.target_path}`);
      console.log(`Assets discovered: ${check.assets.length}`);
      console.log(`Findings detected: ${check.findings.length}`);
      console.log(`Scan Log: \n${check.scan.scan_log}`);
    } else if (check.scan.status === 'failed') {
      clearInterval(pollInterval);
      console.error('Scan failed:', check.scan.scan_log);
    }
  }, 1000);
}

testExpressRepo();
