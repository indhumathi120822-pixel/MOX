const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'ecdat.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log(`[ECDAT DB] Connected to local SQLite database at: ${dbPath}`);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDB() {
  await run(`PRAGMA foreign_keys = ON;`);

  // Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'analyst',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects table
  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      application_type TEXT DEFAULT 'Web Service',
      business_criticality TEXT DEFAULT 'Medium',
      local_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Scans table
  await run(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      target_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, running, completed, failed
      scan_type TEXT DEFAULT 'full', -- full, source, binary, cert, tls, container, cloud
      application_name TEXT,
      application_type TEXT DEFAULT 'Web Service',
      business_criticality TEXT DEFAULT 'Medium',
      total_assets INTEGER DEFAULT 0,
      total_findings INTEGER DEFAULT 0,
      p1_count INTEGER DEFAULT 0,
      p2_count INTEGER DEFAULT 0,
      p3_count INTEGER DEFAULT 0,
      p4_count INTEGER DEFAULT 0,
      risk_score REAL DEFAULT 0.0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      scan_log TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Migration column additions for backward compatibility
  const alterColumns = [
    `ALTER TABLE projects ADD COLUMN application_type TEXT DEFAULT 'Web Service'`,
    `ALTER TABLE projects ADD COLUMN business_criticality TEXT DEFAULT 'Medium'`,
    `ALTER TABLE scans ADD COLUMN application_name TEXT`,
    `ALTER TABLE scans ADD COLUMN application_type TEXT DEFAULT 'Web Service'`,
    `ALTER TABLE scans ADD COLUMN business_criticality TEXT DEFAULT 'Medium'`,
    `ALTER TABLE scans ADD COLUMN p1_count INTEGER DEFAULT 0`,
    `ALTER TABLE scans ADD COLUMN p2_count INTEGER DEFAULT 0`,
    `ALTER TABLE scans ADD COLUMN p3_count INTEGER DEFAULT 0`,
    `ALTER TABLE scans ADD COLUMN p4_count INTEGER DEFAULT 0`,
    `ALTER TABLE findings ADD COLUMN priority TEXT DEFAULT 'P3'`,
    `ALTER TABLE findings ADD COLUMN priority_reason TEXT`,
    `ALTER TABLE findings ADD COLUMN why_detected TEXT`,
    `ALTER TABLE findings ADD COLUMN business_impact TEXT`,
    `ALTER TABLE findings ADD COLUMN remediation_reason TEXT`,
    `ALTER TABLE assets ADD COLUMN analyzer TEXT`
  ];

  for (const alterSql of alterColumns) {
    try { await run(alterSql); } catch (e) {}
  }

  // Assets table (7 categories)
  await run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      scan_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT,
      location TEXT NOT NULL,
      application TEXT,
      algorithm TEXT,
      key_size INTEGER,
      protocol TEXT,
      mode TEXT,
      evidence TEXT,
      confidence TEXT DEFAULT 'HIGH',
      business_criticality TEXT DEFAULT 'Medium',
      business_criticality_reason TEXT,
      data_lifetime INTEGER DEFAULT 5,
      protection_period INTEGER DEFAULT 5,
      migration_time INTEGER DEFAULT 2,
      quantum_risk TEXT DEFAULT 'Low',
      cve_exposure TEXT,
      nist_reference TEXT,
      remediation_status TEXT DEFAULT 'Unresolved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(scan_id) REFERENCES scans(id) ON DELETE CASCADE
    )
  `);

  // Findings table
  await run(`
    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL,
      asset_id INTEGER,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL, -- Critical, High, Medium, Low, Info
      priority TEXT DEFAULT 'P3', -- P1, P2, P3, P4
      algorithm TEXT,
      key_size INTEGER,
      location TEXT NOT NULL,
      line_number INTEGER,
      evidence TEXT NOT NULL,
      confidence TEXT DEFAULT 'HIGH',
      classical_risk TEXT,
      quantum_risk TEXT,
      nist_rule_id TEXT,
      nist_reference TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      cve_id TEXT,
      remediation_status TEXT DEFAULT 'Unresolved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL
    )
  `);

  // Semantic CBOM Nodes table
  await run(`
    CREATE TABLE IF NOT EXISTS cbom_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL,
      asset_id INTEGER,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL, -- Application, Function, Crypto API, Algorithm, Key, Certificate, Protocol, Library, Service
      name TEXT NOT NULL,
      version TEXT,
      mode TEXT,
      role TEXT, -- Signer, Verifier, KEM Client, KEM Server, TLS Terminator, CA
      quantum_status TEXT, -- Quantum Vulnerable, Quantum Resistant, Hybrid, Classical Weak
      details TEXT,
      FOREIGN KEY(scan_id) REFERENCES scans(id) ON DELETE CASCADE
    )
  `);

  // Semantic CBOM Edges table
  await run(`
    CREATE TABLE IF NOT EXISTS cbom_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL,
      source_node TEXT NOT NULL,
      target_node TEXT NOT NULL,
      relationship TEXT NOT NULL, -- USES, IMPLEMENTS, DEPENDS_ON, ENCRYPTS_WITH, CERTIFIES, PROTECTS
      FOREIGN KEY(scan_id) REFERENCES scans(id) ON DELETE CASCADE
    )
  `);

  // NIST Rules Offline Cache
  await run(`
    CREATE TABLE IF NOT EXISTS nist_rules (
      id TEXT PRIMARY KEY,
      publication TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT,
      summary TEXT NOT NULL,
      guidance TEXT NOT NULL,
      category TEXT NOT NULL, -- PQC, TLS, Key Management, CSF 2.0
      recommended_action TEXT NOT NULL,
      last_updated DATE DEFAULT CURRENT_DATE
    )
  `);

  // CVE Dataset Cache
  await run(`
    CREATE TABLE IF NOT EXISTS cve_cache (
      cve_id TEXT PRIMARY KEY,
      component TEXT NOT NULL,
      affected_versions TEXT NOT NULL,
      severity TEXT NOT NULL,
      cvss_score REAL,
      summary TEXT NOT NULL,
      nist_ref TEXT,
      published_date TEXT
    )
  `);

  // Remediation Tasks
  await run(`
    CREATE TABLE IF NOT EXISTS remediation_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      finding_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      original_code TEXT NOT NULL,
      proposed_code TEXT NOT NULL,
      diff_patch TEXT NOT NULL,
      status TEXT DEFAULT 'Pending Approval', -- Pending Approval, Approved, Applied, Verified, Rejected
      applied_at DATETIME,
      verified_at DATETIME,
      user_notes TEXT,
      FOREIGN KEY(finding_id) REFERENCES findings(id) ON DELETE CASCADE
    )
  `);

  // Migration Waves
  await run(`
    CREATE TABLE IF NOT EXISTS migration_waves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      wave_number INTEGER NOT NULL,
      wave_title TEXT NOT NULL,
      priority TEXT NOT NULL,
      assets_count INTEGER DEFAULT 0,
      description TEXT,
      target_completion_date TEXT,
      status TEXT DEFAULT 'Planned',
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Monitored Projects Watchlist
  await run(`
    CREATE TABLE IF NOT EXISTS monitored_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL, -- github, local, upload
      source_reference TEXT NOT NULL, -- repo url, local path, or upload name
      branch TEXT DEFAULT 'main',
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, ERROR, SOURCE_UNAVAILABLE, WAITING_FOR_CHECK, STATIC_UPLOAD
      risk_level TEXT DEFAULT 'Low', -- Critical, High, Medium, Low, Info
      quantum_status TEXT DEFAULT 'Quantum Safe', -- Quantum Safe, Quantum Vulnerable, Mixed, PQC Post-Quantum
      total_findings INTEGER DEFAULT 0,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      last_scan_id INTEGER,
      last_scan_time DATETIME,
      last_check_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_change_detected DATETIME,
      last_commit_hash TEXT,
      notification_status TEXT DEFAULT 'OK', -- OK, NEW_SECURITY_EVENT, ATTENTION_REQUIRED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Monitoring Baselines Snapshot
  await run(`
    CREATE TABLE IF NOT EXISTS monitored_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitored_project_id INTEGER NOT NULL,
      scan_id INTEGER NOT NULL,
      baseline_hash TEXT NOT NULL,
      baseline_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(monitored_project_id) REFERENCES monitored_projects(id) ON DELETE CASCADE
    )
  `);

  // Monitoring Security Events & Notifications
  await run(`
    CREATE TABLE IF NOT EXISTS monitoring_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitored_project_id INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- NEW_ALGORITHM, REMOVED_ALGORITHM, ALGORITHM_REPLACEMENT, WEAK_ALGORITHM_INTRODUCED, KEY_SIZE_REDUCTION, PQC_MIGRATION, RISK_ESCALATION, CERT_EXPIRY, NEW_DEPENDENCY
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'Medium', -- Critical, High, Medium, Low, Info
      priority TEXT DEFAULT 'P3', -- P1, P2, P3, P4
      previous_state TEXT,
      current_state TEXT,
      file_path TEXT,
      commit_hash TEXT,
      recommendation TEXT,
      status TEXT DEFAULT 'UNREAD', -- UNREAD, REVIEWED, DISMISSED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(monitored_project_id) REFERENCES monitored_projects(id) ON DELETE CASCADE
    )
  `);

  // Audit Logs
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed NIST Rules if empty
  const nistCount = await get(`SELECT COUNT(*) as count FROM nist_rules`);
  if (nistCount.count === 0) {
    await seedNistRules();
  }

  // Seed CVE Data if empty
  const cveCount = await get(`SELECT COUNT(*) as count FROM cve_cache`);
  if (cveCount.count === 0) {
    await seedCveCache();
  }
}

async function seedNistRules() {
  const rules = [
    {
      id: 'NIST-FIPS-203',
      publication: 'FIPS 203',
      title: 'Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM)',
      section: 'Section 1.1',
      summary: 'Primary NIST finalized standard for general encryption and key establishment against quantum computers.',
      guidance: 'Replace RSA, DH, and ECDH with ML-KEM-512, ML-KEM-768, or ML-KEM-1024 for public-key encapsulation.',
      category: 'PQC',
      recommended_action: 'Migrate asymmetric key exchange to FIPS 203 ML-KEM or hybrid ML-KEM + ECDH.'
    },
    {
      id: 'NIST-FIPS-204',
      publication: 'FIPS 204',
      title: 'Module-Lattice-Based Digital Signature Algorithm (ML-DSA)',
      section: 'Section 1.1',
      summary: 'Primary NIST finalized standard for general digital signatures against quantum computers.',
      guidance: 'Replace RSA, DSA, and ECDSA with ML-DSA-44, ML-DSA-65, or ML-DSA-87 for authentication and signing.',
      category: 'PQC',
      recommended_action: 'Migrate digital signatures and X.509 certificate signatures to FIPS 204 ML-DSA.'
    },
    {
      id: 'NIST-FIPS-205',
      publication: 'FIPS 205',
      title: 'Stateless Hash-Based Digital Signature Algorithm (SLH-DSA)',
      section: 'Section 1.1',
      summary: 'State-backup-resilient hash-based digital signature standard for secure signing.',
      guidance: 'Use SLH-DSA-SHA2-128f, SLH-DSA-SHAKE-128f, or higher variants when lattice-independent security is required.',
      category: 'PQC',
      recommended_action: 'Apply SLH-DSA for secondary/fallback signature verification and high-assurance code signing.'
    },
    {
      id: 'NIST-SP-800-52r2',
      publication: 'NIST SP 800-52 Rev. 2',
      title: 'Guidelines for the Selection, Configuration, and Use of TLS Options',
      section: 'Section 3.1 & 3.3',
      summary: 'Mandates TLS 1.3 as preferred protocol for federal systems and restricts insecure legacy cipher suites.',
      guidance: 'Deprecated TLS 1.0, 1.1, SSL 2.0, SSL 3.0. Mandates TLS 1.2+ with approved AEAD ciphers (AES-GCM, CHACHA20-POLY1305).',
      category: 'TLS',
      recommended_action: 'Disable TLS 1.0/1.1, require TLS 1.3 or TLS 1.2 with ECDHE-RSA-AES128-GCM-SHA256 or higher.'
    },
    {
      id: 'NIST-SP-800-57p1',
      publication: 'NIST SP 800-57 Part 1 Rev. 5',
      title: 'Recommendation for Key Management: General',
      section: 'Section 5.6',
      summary: 'Establishes cryptographic key length equivalencies and minimum security strengths.',
      guidance: 'Minimum symmetric key length is 128 bits (AES-128), 256 bits recommended for quantum resilience. RSA >= 2048 (3072 bits recommended), ECC >= 256 bits.',
      category: 'Key Management',
      recommended_action: 'Deprecate RSA < 2048, AES < 128, SHA-1 for digital signatures. Upgrade symmetric keys to AES-256 for post-quantum safety.'
    },
    {
      id: 'NIST-CSF-2.0-PR.DS',
      publication: 'NIST Cybersecurity Framework 2.0',
      title: 'Protect - Data Security (PR.DS-01/02)',
      summary: 'Data-at-rest and data-in-transit protection requirements.',
      guidance: 'Assets must classify sensitive data, enforce cryptographic protections according to data lifetime and business impact.',
      category: 'CSF 2.0',
      recommended_action: 'Inventory all cryptographic assets and apply NIST-referenced controls matched to business criticality.'
    },
    {
      id: 'NIST-SP-800-227',
      publication: 'NIST SP 800-227',
      title: 'Recommendations for Key Encapsulation Mechanisms (KEMs)',
      section: 'Section 1.1 (FINAL 18 Sep 2025)',
      summary: 'KEM definitions, security properties, encapsulation bounds and secure-use recommendations for post-quantum key establishment.',
      guidance: 'Use FIPS 203 (ML-KEM) for primary KEM key establishment with appropriate encapsulation domain bounds.',
      category: 'PQC / KEM',
      recommended_action: 'Enforce NIST SP 800-227 KEM guidelines for public-key encapsulation and hybrid key exchange.'
    },
    {
      id: 'NIST-SP-800-131A-R2',
      publication: 'NIST SP 800-131A Rev. 2',
      title: 'Transitioning the Use of Cryptographic Algorithms and Key Lengths',
      section: 'Section 3.1 & 4.2',
      summary: 'Authoritative transition guidance declaring legacy algorithm deprecation and key length phase-outs.',
      guidance: 'Disallows 64-bit block ciphers (3DES/DES) and specifies transition milestones for RSA/ECC to PQC.',
      category: 'Transition Guidance',
      recommended_action: 'Phase out legacy ciphers and transition key lengths per SP 800-131A Rev. 2 schedule.'
    },
    {
      id: 'NIST-HQC-FUTURE',
      publication: 'HQC (NIST PQC Tracked Candidate)',
      title: 'Hamming Quasi-Cyclic Code-Based KEM (Selected for Future Standardization)',
      section: 'Selected 11 Mar 2025',
      summary: 'Code-based key encapsulation mechanism selected by NIST on 11 March 2025 for future standardization.',
      guidance: 'Track as future-standardization candidate. Do not label as finalized FIPS standard in 2025 baseline.',
      category: 'Future PQC',
      recommended_action: 'Track HQC progress as an alternative code-based KEM for future hybrid migration architectures.'
    }
  ];

  for (const r of rules) {
    await run(
      `INSERT INTO nist_rules (id, publication, title, section, summary, guidance, category, recommended_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.publication, r.title, r.section, r.summary, r.guidance, r.category, r.recommended_action]
    );
  }
}

async function seedCveCache() {
  const cves = [
    {
      cve_id: 'CVE-2022-0778',
      component: 'openssl',
      affected_versions: '1.0.2 - 1.0.2zd, 1.1.1 - 1.1.1m, 3.0.0 - 3.0.1',
      severity: 'High',
      cvss_score: 7.5,
      summary: 'Infinite loop in BN_mod_sqrt() parsing invalid EC public key parameters causing Denial of Service.',
      nist_ref: 'NIST SP 800-57 Part 1',
      published_date: '2022-03-15'
    },
    {
      cve_id: 'CVE-2023-0286',
      component: 'openssl',
      affected_versions: '3.0.0 - 3.0.7, 1.1.1 - 1.1.1t',
      severity: 'High',
      cvss_score: 7.4,
      summary: 'Type confusion vulnerability in X.509 GeneralName revocation checking leading to memory disclosure or DoS.',
      nist_ref: 'NIST SP 800-52 Rev. 2',
      published_date: '2023-02-07'
    },
    {
      cve_id: 'CVE-2021-3450',
      component: 'openssl',
      affected_versions: '1.1.1h - 1.1.1j',
      severity: 'High',
      cvss_score: 7.4,
      summary: 'CA certificate check bypass in X.509 path validation allow untrusted certs to be trusted as CAs.',
      nist_ref: 'NIST SP 800-57 Part 1',
      published_date: '2021-03-25'
    },
    {
      cve_id: 'CVE-2022-37434',
      component: 'zlib',
      affected_versions: '< 1.2.13',
      severity: 'Critical',
      cvss_score: 9.8,
      summary: 'Heap-based buffer overflow in inflate via large extra field in gzip header.',
      nist_ref: 'NIST CSF 2.0 PR.DS',
      published_date: '2022-08-05'
    },
    {
      cve_id: 'CVE-2023-38408',
      component: 'openssh',
      affected_versions: '< 9.3p2',
      severity: 'Critical',
      cvss_score: 9.8,
      summary: 'Remote Code Execution vulnerability in OpenSSH PKCS#11 provider loading via ssh-agent.',
      nist_ref: 'NIST SP 800-57 Part 1',
      published_date: '2023-07-20'
    }
  ];

  for (const c of cves) {
    await run(
      `INSERT INTO cve_cache (cve_id, component, affected_versions, severity, cvss_score, summary, nist_ref, published_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.cve_id, c.component, c.affected_versions, c.severity, c.cvss_score, c.summary, c.nist_ref, c.published_date]
    );
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDB
};
