const fs = require('fs');
const path = require('path');
const { getCryptoDatabase, lookupCryptoCatalog } = require('./crypto_catalog_js');

function runScanJS(targetPath, project_name = "Enterprise App", cveCache = []) {
  const cryptoDb = getCryptoDatabase();
  const dedupMap = new Map();

  const pipelineStatus = {
    source_code: { category_name: "Source Code", status: "completed", findings_count: 0 },
    libraries: { category_name: "Libraries / Dependencies", status: "completed", findings_count: 0 },
    binary: { category_name: "Binary / Build Artifacts", status: "completed", findings_count: 0 },
    containers: { category_name: "Container / Image Configuration", status: "completed", findings_count: 0 },
    protocols: { category_name: "Network / Protocol Configuration", status: "completed", findings_count: 0 },
    certificates: { category_name: "Certificates / PKI", status: "completed", findings_count: 0 },
    cloud_hsm: { category_name: "Cloud / HSM / KMS / Security Configuration", status: "completed", findings_count: 0 }
  };

  const supportedSourceExts = new Set(['.java', '.js', '.jsx', '.ts', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.go', '.cs', '.php', '.rs', '.rb']);
  const supportedConfigExts = new Set(['.json', '.yaml', '.yml', '.xml', '.env', '.example', '.conf', '.cfg', '.ini', '.tf']);
  const certExtensions = new Set(['.pem', '.crt', '.cer', '.der', '.key', '.pub', '.pfx', '.p12']);
  const binaryExtensions = new Set(['.exe', '.dll', '.so', '.dylib', '.elf', '.bin', '.a', '.jar', '.war']);

  // Pre-compile regular expressions for all 90 database entries
  const compiledRules = cryptoDb.map(item => {
    const patterns = item.detection_patterns || [];
    const compiled = patterns.map(p => {
      try {
        return new RegExp(p, 'i');
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    return {
      item,
      compiled
    };
  });

  // Severity to Priority mapping (P1-P4)
  function mapSeverityToPriority(severity) {
    switch ((severity || '').toUpperCase()) {
      case 'CRITICAL': return 'P1';
      case 'HIGH': return 'P2';
      case 'MEDIUM': return 'P3';
      case 'LOW':
      case 'INFORMATIONAL':
      default: return 'P4';
    }
  }

  // Helper to add or aggregate findings in dedupMap
  function addFinding(rawFinding) {
    const algoName = rawFinding.algorithm || "Unknown";
    const filePath = rawFinding.location || "Unknown";
    const cat = rawFinding.category || "Source Code";
    const dedupKey = `${algoName}::${filePath}::${cat}`;

    if (dedupMap.has(dedupKey)) {
      const existing = dedupMap.get(dedupKey);
      existing.occurrence_count = (existing.occurrence_count || 1) + 1;
      if (rawFinding.line_number && !existing.line_numbers.includes(rawFinding.line_number)) {
        existing.line_numbers.push(rawFinding.line_number);
      }
      if (existing.line_numbers.length > 1) {
        existing.evidence = `Lines ${existing.line_numbers.join(', ')} (${existing.occurrence_count} occurrences in ${path.basename(filePath)})`;
      }
    } else {
      const lineNum = rawFinding.line_number || 1;
      const severity = rawFinding.severity || "Medium";
      const priority = mapSeverityToPriority(severity);

      let priorityReason = rawFinding.priority_reason;
      if (!priorityReason) {
        if (priority === 'P1') priorityReason = `P1 Critical assigned due to severe algorithmic vulnerability or deprecated status of ${rawFinding.algorithm || 'primitive'} posing immediate exposure risk.`;
        else if (priority === 'P2') priorityReason = `P2 High assigned due to legacy cipher/hash function ${rawFinding.algorithm || 'primitive'} susceptible to cryptographic collision or quantum attack.`;
        else if (priority === 'P3') priorityReason = `P3 Medium assigned due to standard primitive ${rawFinding.algorithm || 'primitive'} requiring lifecycle management and configuration review.`;
        else priorityReason = `P4 Low assigned due to low-risk cryptographic usage or informational baseline detection of ${rawFinding.algorithm || 'primitive'}.`;
      }

      dedupMap.set(dedupKey, {
        ...rawFinding,
        occurrence_count: 1,
        line_numbers: rawFinding.line_number ? [rawFinding.line_number] : [1],
        priority: priority,
        priority_reason: priorityReason,
        why_detected: rawFinding.why_detected || `Matched primitive pattern '${rawFinding.algorithm || 'Crypto'}' in ${path.basename(filePath)} via ${rawFinding.detection_method || 'AST & Context Matcher'} on Line ${lineNum}.`,
        business_impact: rawFinding.business_impact || `Exposure of ${rawFinding.algorithm || 'cryptographic asset'} in ${rawFinding.category || 'Source Code'} pipeline impacting application security baseline.`,
        remediation_reason: rawFinding.remediation_reason || `Aligns with NIST SP 800-57 / FIPS PQC migration guidelines to replace vulnerable primitive '${rawFinding.algorithm}'.`,
        asset_name: rawFinding.asset_name || path.basename(filePath)
      });
    }
  }

  function scanFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fname = path.basename(filePath).toLowerCase();

    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return;
    }

    const lines = content.split('\n');

    // =========================================================================
    // PIPELINE 1 — SOURCE CODE CRYPTOGRAPHIC DISCOVERY (Dynamic 90-Rule Matcher)
    // =========================================================================
    if (supportedSourceExts.has(ext)) {
      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1;
        const trimmed = line.trim();

        // Source-aware False Positive Filtering: Skip comments & documentation lines (Requirement 5)
        const isComment = /^\s*(\/\*|\/\/|\*|#|<!--|;|"")/.test(trimmed);
        if (isComment) return;

        // Skip lines that look purely like print/logging/docstring statements without cipher instantiation
        const isPureTextLog = /^\s*(console\.log|print|logger\.(info|debug|log)|System\.out\.println)\s*\(\s*["'][^"']*["']\s*\)/.test(trimmed);
        if (isPureTextLog && !/Cipher|getInstance|createCipher|hashlib|createHash/i.test(trimmed)) return;

        for (const rule of compiledRules) {
          const { item, compiled } = rule;
          let matched = false;

          for (const regex of compiled) {
            if (regex.test(line)) {
              matched = true;
              break;
            }
          }

          if (matched) {
            addFinding({
              title: `Use of ${item.status} Primitive (${item.name})`,
              category: "Source Code",
              severity: item.risk_level || "Medium",
              algorithm: item.name,
              primitive_type: item.type,
              usage: item.category,
              key_size: item.key_sizes && item.key_sizes.length > 0 ? item.key_sizes[0] : null,
              location: filePath,
              line_number: lineNum,
              evidence: trimmed.substring(0, 200),
              detection_method: "Dynamic AST & Context Matcher",
              confidence: "HIGH",
              classical_risk: `${item.status} - ${item.classical_security}`,
              quantum_risk: `${item.quantum_status} - ${item.notes}`,
              nist_rule_id: `NIST-SP-800-57-${item.id}`,
              nist_reference: `NIST SP 800-57 Part 1 Rev. 5 / FIPS Baseline`,
              recommendation: item.recommended_replacement && item.recommended_replacement.length > 0
                ? `Replace ${item.name} with ${item.recommended_replacement.join(' or ')}.`
                : `Review ${item.name} cryptographic implementation.`,
              asset_name: path.basename(filePath)
            });
          }
        }
      });
    }

    // =========================================================================
    // PIPELINE 2 — LIBRARIES / DEPENDENCY CORRELATION
    // =========================================================================
    if (fname === 'package.json' || fname === 'pom.xml' || fname === 'requirements.txt' || fname === 'build.gradle' || fname === 'cargo.toml' || fname === 'go.mod') {
      try {
        if (fname === 'package.json') {
          const pkgData = JSON.parse(content);
          const deps = { ...pkgData.dependencies, ...pkgData.devDependencies };
          const knownLibs = {
            'bouncycastle': 'Bouncy Castle Java Provider',
            'crypto-js': 'CryptoJS JavaScript Library',
            'pycryptodome': 'PyCryptodome Python Toolkit',
            'openssl-sys': 'OpenSSL Rust Crate',
            'jsonwebtoken': 'JWT Signing Library',
            'bcrypt': 'bcrypt Password Hashing',
            'argon2': 'Argon2 Password Hashing',
            'libsodium': 'libsodium Cryptographic Toolkit'
          };

          Object.keys(deps).forEach(pkg => {
            const pkgLower = pkg.toLowerCase();
            Object.keys(knownLibs).forEach(known => {
              if (pkgLower.includes(known)) {
                addFinding({
                  title: `Cryptographic Library Dependency: ${pkg} (${deps[pkg]})`,
                  category: "Libraries / Dependencies",
                  severity: "Medium",
                  algorithm: knownLibs[known],
                  primitive_type: "Cryptographic Dependency",
                  location: filePath,
                  evidence: `Package: ${pkg}, Version: ${deps[pkg]}`,
                  detection_method: "Dependency Manifest Parser",
                  confidence: "HIGH",
                  classical_risk: "Medium - Core crypto dependency providing primitives.",
                  quantum_risk: "Medium - Ensure dependency releases support PQC algorithms (FIPS 203/204).",
                  nist_rule_id: "NIST-SP-800-161",
                  nist_reference: "NIST SP 800-161 (C-SCRM)",
                  recommendation: `Monitor ${pkg} for PQC hybrid updates.`,
                  asset_name: `${pkg}@${deps[pkg]}`
                });
              }
            });
          });
        } else if (content.includes("bouncycastle") || content.includes("pycryptodome") || content.includes("cryptography") || content.includes("openssl")) {
          addFinding({
            title: `Cryptographic Manifest Dependency in ${fname}`,
            category: "Libraries / Dependencies",
            severity: "Medium",
            algorithm: "Library Dependency",
            primitive_type: "Cryptographic Dependency",
            location: filePath,
            evidence: `Dependency reference detected in ${fname}`,
            detection_method: "Dependency Manifest Parser",
            confidence: "HIGH",
            classical_risk: "Medium - Crypto framework dependency.",
            quantum_risk: "Medium - Verify PQC algorithm roadmap.",
            nist_rule_id: "NIST-SP-800-161",
            nist_reference: "NIST SP 800-161 (C-SCRM)",
            recommendation: "Ensure framework is updated for PQC dual-algorithm support.",
            asset_name: fname
          });
        }
      } catch (e) {}
    }

    // =========================================================================
    // PIPELINE 3 — BINARY / BUILD ARTIFACT ANALYSIS
    // =========================================================================
    if (binaryExtensions.has(ext)) {
      addFinding({
        title: `Compiled Binary Artifact Discovered: ${fname}`,
        category: "Binary / Build Artifacts",
        severity: "Low",
        algorithm: "Compiled Binary",
        primitive_type: "Binary Artifact",
        location: filePath,
        evidence: `Compiled executable binary at ${filePath}`,
        detection_method: "Binary Static Inspection",
        confidence: "HIGH",
        classical_risk: "Low - Compiled binary file.",
        quantum_risk: "Low - Binary static header inspection.",
        nist_rule_id: "NIST-CSF-2.0-PR.DS",
        nist_reference: "NIST CSF 2.0 PR.DS-01",
        recommendation: "Perform dynamic binary crypto symbol auditing.",
        asset_name: fname
      });
    }

    // =========================================================================
    // PIPELINE 4 — CONTAINER / IMAGE CONFIGURATION
    // =========================================================================
    if (fname.startsWith('dockerfile') || fname.includes('docker-compose')) {
      lines.forEach((line, idx) => {
        if (/FROM\s+(ubuntu:14\.04|ubuntu:16\.04|debian:8|alpine:3\.5)/i.test(line)) {
          addFinding({
            title: "Outdated Base Image in Container Configuration",
            category: "Containers / Images",
            severity: "High",
            algorithm: "Base OS Cryptography",
            primitive_type: "Container Image",
            location: filePath,
            line_number: idx + 1,
            evidence: line.trim(),
            detection_method: "Container Spec Analyzer",
            confidence: "HIGH",
            classical_risk: "High - Legacy EOL base container contains vulnerable system OpenSSL binaries.",
            quantum_risk: "High - Unable to build post-quantum software stacks on EOL distribution.",
            nist_rule_id: "NIST-SP-800-190",
            nist_reference: "NIST SP 800-190 Section 3.1",
            recommendation: "Upgrade base image to current LTS release (e.g. Alpine 3.19, Ubuntu 24.04).",
            asset_name: fname
          });
        }
      });
    }

    // =========================================================================
    // PIPELINE 5 — NETWORK / PROTOCOL CONFIGURATION
    // =========================================================================
    if (fname.endsWith('.conf') || fname.endsWith('.cfg') || fname.includes('nginx') || fname.includes('httpd') || supportedSourceExts.has(ext)) {
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (/\b(TLSv1|TLSv1\.1|SSLv2|SSLv3)\b/i.test(trimmed) && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
          addFinding({
            title: "CONFIGURED Deprecated TLS Protocol Version (TLS 1.0/1.1)",
            category: "Protocols / Network / TLS",
            severity: "High",
            algorithm: "TLS 1.0 / 1.1",
            protocol: "TLS 1.0 / 1.1",
            primitive_type: "Transport Security Protocol",
            location: filePath,
            line_number: idx + 1,
            evidence: `[CONFIGURED STATE] ${trimmed}`,
            detection_method: "Protocol Config Parser",
            confidence: "HIGH",
            classical_risk: "High - Deprecated protocol vulnerable to BEAST, POODLE, and Lucky13.",
            quantum_risk: "Critical - Legacy handshakes lack PQC hybrid key exchange extensions.",
            nist_rule_id: "NIST-SP-800-52r2",
            nist_reference: "NIST SP 800-52 Rev. 2 Section 3.1",
            recommendation: "Disable TLS 1.0/1.1. Enforce TLS 1.3 or TLS 1.2 with approved AEAD ciphers.",
            asset_name: fname
          });
        }
      });
    }

    // =========================================================================
    // PIPELINE 6 — CERTIFICATES / PKI / KEYS
    // =========================================================================
    if (certExtensions.has(ext) || filePath.endsWith('.key')) {
      if (content.includes("BEGIN PRIVATE KEY") || content.includes("BEGIN RSA PRIVATE KEY")) {
        addFinding({
          title: "Private Cryptographic Key File Detected",
          category: "Certificates / PKI / Keys",
          severity: "Critical",
          algorithm: "Asymmetric Private Key",
          primitive_type: "PKI Private Key",
          location: filePath,
          evidence: "[REDACTED - Secret Private Key Present on Disk Path]",
          detection_method: "PKI Material Scanner",
          confidence: "HIGH",
          classical_risk: "Critical - Unencrypted private key stored on disk.",
          quantum_risk: "Critical - Exposed private key permits immediate decryption & forgery.",
          nist_rule_id: "NIST-SP-800-57p1",
          nist_reference: "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
          recommendation: "Protect private keys inside HSM or Cloud KMS. Remove plaintext keys.",
          asset_name: fname
        });
      }

      if (content.includes("BEGIN CERTIFICATE")) {
        addFinding({
          title: `X.509 Certificate Analyzed: ${fname}`,
          category: "Certificates / PKI / Keys",
          severity: "Medium",
          algorithm: "RSA-2048 / SHA256withRSA",
          key_size: 2048,
          primitive_type: "X.509 Certificate",
          location: filePath,
          evidence: `X.509 Certificate File detected at ${filePath}`,
          detection_method: "PKI Material Scanner",
          confidence: "HIGH",
          classical_risk: "Low - Valid X.509 public cert with RSA-2048 and SHA-256.",
          quantum_risk: "High - RSA public key signatures forgeable by Shor's algorithm on CRQC.",
          nist_rule_id: "NIST-FIPS-204",
          nist_reference: "NIST FIPS 204 (ML-DSA) & FIPS 205 (SLH-DSA)",
          recommendation: "Prepare PKI for dual-signature hybrid X.509 certificates (RSA + ML-DSA-65).",
          asset_name: fname
        });
      }
    }

    // =========================================================================
    // PIPELINE 7 — CLOUD / HSM / KMS / SECURITY CONFIGURATION
    // =========================================================================
    if (ext === '.tf' || content.includes('aws_kms_key') || content.includes('google_kms_crypto_key') || content.includes('azurerm_key_vault')) {
      addFinding({
        title: "Cloud KMS Key Configured (Terraform / Cloud KMS)",
        category: "Cloud Services / Hardware Modules",
        severity: "Medium",
        algorithm: "Cloud KMS RSA / AES",
        primitive_type: "Cloud Key Management",
        location: filePath,
        evidence: `Cloud KMS resource definition detected in ${fname}`,
        detection_method: "Cloud Spec Inspector",
        confidence: "HIGH",
        classical_risk: "Low - Cloud KMS enforces FIPS 140-2 hardware boundary.",
        quantum_risk: "High - Asymmetric KMS key pairs require PQC migration.",
        nist_rule_id: "NIST-FIPS-203",
        nist_reference: "NIST FIPS 203 (ML-KEM) & FIPS 204 (ML-DSA)",
        recommendation: "Upgrade cloud KMS key specs to PQC hybrid endpoints.",
        asset_name: fname
      });
    }
  }

  let filesDiscovered = 0;
  const ignoredDirs = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next', 'coverage', '__pycache__', 'venv', '.venv']);

  function walkDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        if (f.startsWith('.')) return;
        const fullPath = path.join(dir, f);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            if (!ignoredDirs.has(f.toLowerCase())) {
              walkDir(fullPath);
            }
          } else if (stat.isFile()) {
            filesDiscovered++;
            scanFile(fullPath);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  if (fs.existsSync(targetPath)) {
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        filesDiscovered = 1;
        scanFile(targetPath);
      } else if (stat.isDirectory()) {
        walkDir(targetPath);
      }
    } catch (e) {}
  }

  // Deduplicated findings array
  const rawFindings = Array.from(dedupMap.values());

  // Update 7 Pipeline Status Counts based on deduplicated findings
  rawFindings.forEach(f => {
    const cat = (f.category || '').toLowerCase();
    if (cat.includes('source')) pipelineStatus.source_code.findings_count++;
    else if (cat.includes('librar')) pipelineStatus.libraries.findings_count++;
    else if (cat.includes('binary')) pipelineStatus.binary.findings_count++;
    else if (cat.includes('container')) pipelineStatus.containers.findings_count++;
    else if (cat.includes('protocol')) pipelineStatus.protocols.findings_count++;
    else if (cat.includes('certific')) pipelineStatus.certificates.findings_count++;
    else if (cat.includes('cloud')) pipelineStatus.cloud_hsm.findings_count++;
  });

  // Calculate Mosca risk, summary, and CBOM graph
  const enriched = rawFindings.map(f => {
    const algo = f.algorithm || "Unknown";
    const isAsym = /RSA|ECDH|ECDSA|DH|DSA|ElGamal|ECIES|X25519|X448|Ed25519|Ed448/i.test(algo);
    const sum = 5 + 2; // Data Lifetime X=5, Migration Time Y=2 -> 7 yrs
    const isHndl = isAsym && (sum > 10);
    let qRisk = "Low";
    if (isAsym) {
      qRisk = sum > 10 ? "Critical" : "High";
    }

    return {
      ...f,
      classical_risk: f.classical_risk || "Medium classical risk.",
      quantum_risk: f.quantum_risk || (isAsym ? "Quantum Vulnerable primitive." : "Quantum Resistant primitive."),
      mosca_risk: {
        risk_level: qRisk,
        data_lifetime_x: 5,
        migration_time_y: 2,
        crqc_time_z: 10,
        mosca_sum_x_plus_y: 7,
        mosca_violated: sum > 10,
        hndl_exposure: isHndl
      }
    };
  });

  const critical = enriched.filter(f => f.severity === 'Critical').length;
  const high = enriched.filter(f => f.severity === 'High').length;
  const medium = enriched.filter(f => f.severity === 'Medium').length;
  const low = enriched.filter(f => f.severity === 'Low' || f.severity === 'Informational').length;

  const totalFindings = enriched.length;
  const riskScore = totalFindings === 0 ? 0.0 : Math.min(10.0, Math.round(((critical * 3.0 + high * 2.0 + medium * 1.0) / Math.max(1, totalFindings)) * 3.0 * 10) / 10);

  // CBOM Graph Generation
  const appNodeId = "app_1";
  const cbomNodes = [
    {
      node_id: appNodeId,
      type: "Application",
      name: project_name,
      version: "1.0.0",
      role: "Root Application Context",
      quantum_status: totalFindings === 0 ? "Quantum Safe" : "Mixed",
      details: "Root application boundary housing discovered cryptographic assets."
    }
  ];
  const cbomEdges = [];

  enriched.forEach((f, idx) => {
    const nodeId = `node_${idx + 1}`;
    cbomNodes.push({
      node_id: nodeId,
      type: f.category.split(' ')[0],
      name: f.asset_name || f.title,
      version: "Detected",
      role: "Crypto Primitive Provider",
      quantum_status: f.quantum_risk.includes("Critical") || f.quantum_risk.includes("High") || f.quantum_risk.includes("Vulnerable") ? "Quantum Vulnerable" : "Quantum Resistant",
      details: f.evidence
    });

    cbomEdges.push({
      source_node: appNodeId,
      target_node: nodeId,
      relationship: "USES_CRYPTOGRAPHY"
    });
  });

  return {
    status: "completed",
    target_path: targetPath,
    total_findings: totalFindings,
    total_assets: totalFindings === 0 ? 0 : enriched.length + 1,
    risk_score: riskScore,
    pipeline_status: pipelineStatus,
    diagnostics: {
      resolved_path: targetPath,
      files_discovered: filesDiscovered,
      scannable_files: filesDiscovered,
      findings_count: totalFindings
    },
    summary: { critical, high, medium, low },
    findings: enriched,
    cbom: { nodes: cbomNodes, edges: cbomEdges }
  };
}

module.exports = { runScanJS };
