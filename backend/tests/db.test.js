const { initDB, get, all } = require('../db');
const { runScanJS } = require('../scanner_js');
const path = require('path');

async function testBackend() {
  console.log('[TEST] Initializing ECDAT SQLite database...');
  await initDB();

  const rules = await all(`SELECT * FROM nist_rules`);
  console.log(`[TEST] NIST rules count in offline cache: ${rules.length}`);
  if (rules.length === 0) throw new Error('NIST rules not seeded');

  const cves = await all(`SELECT * FROM cve_cache`);
  console.log(`[TEST] CVE cache count: ${cves.length}`);
  if (cves.length === 0) throw new Error('CVE cache not seeded');

  console.log('[TEST] Testing scanner engine on sample_targets...');
  const samplePath = path.join(__dirname, '../../sample_targets');
  const result = runScanJS(samplePath, "Test Enterprise Project", cves);
  
  console.log(`[TEST] Total scan findings discovered: ${result.total_findings}`);
  console.log(`[TEST] Total CBOM graph nodes: ${result.cbom.nodes.length}`);
  console.log(`[TEST] Calculated Quantum Risk Score: ${result.risk_score}/10`);

  if (result.total_findings === 0) throw new Error('Scanner failed to discover findings');

  console.log('[TEST] ALL BACKEND TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

testBackend().catch(err => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
