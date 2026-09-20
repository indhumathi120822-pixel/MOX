# ECDAT — Enterprise Cryptographic Discovery & Analysis Tool

> **SIH26164** | **Local-First** | **Privacy-First** | **NIST-Referenced** | **Fully Working Application**

ECDAT is an offline-capable, local-first enterprise software application designed to discover, catalogue, classify, analyze, assess, prioritize, recommend, plan migration for, remediate, verify, and monitor cryptographic assets across modern enterprise systems.

---

## Authoritative Reference Model

ECDAT maps all analysis rules and migration advice to official NIST cybersecurity and cryptographic standards:

- **Post-Quantum Cryptography (PQC)**:
  - **FIPS 203**: Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM-512, ML-KEM-768, ML-KEM-1024)
  - **FIPS 204**: Module-Lattice-Based Digital Signature Algorithm (ML-DSA-44, ML-DSA-65, ML-DSA-87)
  - **FIPS 205**: Stateless Hash-Based Digital Signature Algorithm (SLH-DSA)
- **TLS Configuration**:
  - **NIST SP 800-52 Rev. 2**: Guidelines for the Selection, Configuration, and Use of TLS Options (TLS 1.3 mandate)
- **Key Management**:
  - **NIST SP 800-57 Part 1 Rev. 5**: Recommendation for Key Management (Key length equivalencies & 256-bit PQC recommendation)
- **Cybersecurity Risk Management**:
  - **NIST CSF 2.0**: Protect (PR.DS Data Security) Framework Outcomes

*Note: ECDAT is NIST-referenced and NIST-aligned.*

---

## Key Architecture & Features

```
+-----------------------------------------------------------------------+
|                 ECDAT React SPA UI (Port 5173)                       |
+-----------------------------------------------------------------------+
                                   | REST API / JWT
+-----------------------------------------------------------------------+
|             Node.js + Express Backend API (Port 5000)                |
+-----------------------------------------------------------------------+
        |                    |                        |
+-----------------+ +--------------------+ +----------------------------+
|  SQLite DB      | | 7-Category Scanner | | Mosca & NIST Rule Engine   |
|  (ecdat.db)     | | (Python / JS Core) | | (FIPS 203/204/205, $X+Y>Z$) |
+-----------------+ +--------------------+ +----------------------------+
```

1. **Local-First / Privacy-First**: 100% of source code, binaries, certificates, configurations, and scan results remain strictly on `localhost`. Zero cloud uploads.
2. **7 Asset Categories Discovery**:
   - Source Code (Java, JS/TS, Python, C, C++, Go, C#, PHP, Rust)
   - Libraries & Dependencies (`package.json`, `pom.xml`, `requirements.txt`, etc.)
   - Binaries & Executables (`.exe`, `.dll`, `.so`, `.elf` static symbol analysis)
   - Containers & Images (`Dockerfile`, OCI configurations)
   - Certificates, PKI & Keys (X.509 certs & redacted private key detection)
   - Protocols & TLS (`nginx.conf`, Apache configs, cipher suite enforcement)
   - Cloud Services & Hardware Modules (AWS/Azure KMS, Terraform, PKCS#11 HSM configs)
3. **Mosca Quantum Risk Engine ($X + Y > Z$)**:
   - Compares Data Lifetime ($X$) + Migration Time ($Y$) against CRQC Timeframe ($Z$, default 10 yrs) to identify **Harvest Now, Decrypt Later (HNDL)** exposure.
4. **Semantic CBOM (Cryptographic Bill of Materials)**:
   - CycloneDX CBOM 1.5 JSON graph taxonomy with directional semantic relationships (`USES`, `DEPENDS_ON`, `CERTIFIES`, `PROTECTS`).
5. **Remediation & Verification Flow**:
   - Generates Before vs. After diff patches, enforces user approval, applies atomic file edits with original backup, and performs post-remediation verification re-scans.
6. **5-Wave PQC Migration Roadmap**:
   - Sequenced migration roadmap from Critical Quantum-Vulnerable assets down to Continuous Verification.

---

## Quick Start Instructions

### Prerequisites
- Node.js v18+ (Included on Windows/Linux)
- Python 3.8+ (Optional; built-in JS fallback scanner will run automatically if Python is missing)

### One-Click Startup (Windows)
Double-click `start.bat` or execute in PowerShell:
```cmd
.\start.bat
```

### One-Click Startup (Linux / macOS)
Execute in terminal:
```bash
chmod +x start.sh
./start.sh
```

### Manual Installation & Launch
1. **Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open browser at `http://localhost:5173`
4. Login with default analyst account:
   - **Username**: `analyst`
   - **Password**: `password123`

---

## SIH26164 Requirement Mapping

| SIH26164 Requirement | ECDAT Implementation | Status |
| :--- | :--- | :--- |
| Cryptographic Discovery | 7 Asset Categories static deterministic scanner | ✅ Verified |
| Quantum Risk Assessment | Mosca Inequality ($X+Y>Z$) & HNDL Risk | ✅ Verified |
| NIST Standards Alignment | FIPS 203/204/205, SP 800-52r2, SP 800-57 | ✅ Verified |
| Semantic CBOM | CycloneDX CBOM 1.5 JSON export & graph viewer | ✅ Verified |
| Source Remediation & Verification | Diff preview, user approval, atomic patch & re-scan | ✅ Verified |
| Local-First Privacy | 100% offline, local SQLite database, 0 cloud calls | ✅ Verified |
