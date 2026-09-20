import os
import re

class SourceScanner:
    def __init__(self):
        self.rules = [
            {
                "id": "SRC-MD5",
                "pattern": r"(?i)\b(MD5|MessageDigest\.getInstance\s*\(\s*[\"']MD5[\"']\)|hashlib\.md5|crypto\.createHash\s*\(\s*[\"']md5[\"']\))",
                "algorithm": "MD5",
                "severity": "High",
                "title": "Use of Broken Cryptographic Hash Algorithm (MD5)",
                "category": "Source Code",
                "classical_risk": "High - Cryptographically broken, vulnerable to collision attacks.",
                "quantum_risk": "High - Vulnerable to Grover's algorithm and collision attacks.",
                "nist_rule_id": "NIST-SP-800-57p1",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "recommendation": "Replace MD5 with SHA-256, SHA-384, or SHA-512 for cryptographic integrity and collision resistance."
            },
            {
                "id": "SRC-SHA1",
                "pattern": r"(?i)\b(SHA-?1|MessageDigest\.getInstance\s*\(\s*[\"']SHA-?1[\"']\)|hashlib\.sha1|crypto\.createHash\s*\(\s*[\"']sha1[\"']\))",
                "algorithm": "SHA-1",
                "severity": "Medium",
                "title": "Use of Deprecated Cryptographic Hash Algorithm (SHA-1)",
                "category": "Source Code",
                "classical_risk": "Medium - Deprecated for digital signatures due to collision vulnerabilities.",
                "quantum_risk": "Medium - Vulnerable to Grover search acceleration.",
                "nist_rule_id": "NIST-SP-800-57p1",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "recommendation": "Upgrade to SHA-256 or SHA-3 for digital signatures and digest verification."
            },
            {
                "id": "SRC-DES-3DES",
                "pattern": r"(?i)\b(DES|3DES|TripleDES|Cipher\.getInstance\s*\(\s*[\"']DES[\"']\)|DESede)",
                "algorithm": "DES / 3DES",
                "severity": "Critical",
                "title": "Use of Legacy/Weak Block Cipher (DES/3DES)",
                "category": "Source Code",
                "classical_risk": "Critical - Small 64-bit block size vulnerable to Sweet32 meet-in-the-middle attacks.",
                "quantum_risk": "Critical - Key length insufficient against Grover's algorithm.",
                "nist_rule_id": "NIST-SP-800-57p1",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "recommendation": "Migrate from DES/3DES to AES-256-GCM or AES-256-CBC."
            },
            {
                "id": "SRC-AES-ECB",
                "pattern": r"(?i)\b(AES/ECB|Cipher\.getInstance\s*\(\s*[\"']AES/ECB[\"']\)|createCipheriv\s*\(\s*[\"']aes-128-ecb[\"']\))",
                "algorithm": "AES-ECB",
                "severity": "High",
                "title": "Insecure AES Block Cipher Mode (ECB)",
                "category": "Source Code",
                "classical_risk": "High - Electronic Codebook mode does not hide data patterns across blocks.",
                "quantum_risk": "High - Quantum computers can accelerate pattern analysis on deterministic ciphers.",
                "nist_rule_id": "NIST-SP-800-57p1",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "recommendation": "Use AEAD modes like AES-GCM (Galois/Counter Mode) with unique nonces."
            },
            {
                "id": "SRC-RSA-SMALL",
                "pattern": r"(?i)(KeyPairGenerator\.getInstance\s*\(\s*[\"']RSA[\"']\).*initialize\s*\(\s*(1024|512)\s*\)|RSAKeyGen\s*\(\s*(1024|512)\s*\))",
                "algorithm": "RSA",
                "key_size": 1024,
                "severity": "Critical",
                "title": "Insecure RSA Key Size (< 2048 bits)",
                "category": "Source Code",
                "classical_risk": "Critical - RSA keys under 2048 bits can be factored by classical supercomputers.",
                "quantum_risk": "Critical - Completely broken by Shor's algorithm on CRQC.",
                "nist_rule_id": "NIST-SP-800-57p1",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "recommendation": "Upgrade to RSA 3072/4048 bits for classical protection, or transition to FIPS 203 ML-KEM / FIPS 204 ML-DSA for post-quantum safety."
            },
            {
                "id": "SRC-RSA-CLASSICAL",
                "pattern": r"(?i)(KeyPairGenerator\.getInstance\s*\(\s*[\"']RSA[\"']\)|rsa\.generate_private_key|generateKeyPair\s*\(\s*[\"']rsa[\"']\))",
                "algorithm": "RSA",
                "key_size": 2048,
                "severity": "Medium",
                "title": "Quantum-Vulnerable RSA Public Key Cryptography",
                "category": "Source Code",
                "classical_risk": "Low - Classically secure at 2048+ bits.",
                "quantum_risk": "High - Shor's polynomial-time algorithm factors RSA keys on a CRQC.",
                "nist_rule_id": "NIST-FIPS-203",
                "nist_reference": "NIST FIPS 203 (ML-KEM) & FIPS 204 (ML-DSA)",
                "recommendation": "Plan migration from RSA to ML-KEM-768 (key exchange) or ML-DSA-65 (digital signatures)."
            },
            {
                "id": "SRC-ECDH-CLASSICAL",
                "pattern": r"(?i)(ECDH|EllipticCurve|KeyAgreement\.getInstance\s*\(\s*[\"']ECDH[\"']\)|createECDH)",
                "algorithm": "ECDH",
                "severity": "Medium",
                "title": "Quantum-Vulnerable Elliptic Curve Diffie-Hellman (ECDH)",
                "category": "Source Code",
                "classical_risk": "Low - Classically strong security at 256+ bit curves.",
                "quantum_risk": "Critical - Shor's algorithm solves discrete logarithms on elliptic curves in polynomial time.",
                "nist_rule_id": "NIST-FIPS-203",
                "nist_reference": "NIST FIPS 203 (ML-KEM)",
                "recommendation": "Migrate key encapsulation to FIPS 203 ML-KEM-768 or deploy a hybrid ML-KEM + ECDH scheme."
            }
        ]
        self.supported_extensions = {'.java', '.js', '.ts', '.py', '.c', '.cpp', '.h', '.hpp', '.go', '.cs', '.php', '.rs'}

    def scan_file(self, file_path):
        findings = []
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.supported_extensions:
            return findings

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()

            for line_idx, line in enumerate(lines, 1):
                for rule in self.rules:
                    if re.search(rule["pattern"], line):
                        findings.append({
                            "title": rule["title"],
                            "category": rule["category"],
                            "severity": rule["severity"],
                            "algorithm": rule["algorithm"],
                            "key_size": rule.get("key_size", None),
                            "location": file_path,
                            "line_number": line_idx,
                            "evidence": line.strip()[:200],
                            "confidence": "HIGH",
                            "classical_risk": rule["classical_risk"],
                            "quantum_risk": rule["quantum_risk"],
                            "nist_rule_id": rule["nist_rule_id"],
                            "nist_reference": rule["nist_reference"],
                            "recommendation": rule["recommendation"],
                            "asset_name": os.path.basename(file_path),
                            "asset_type": f"Source File ({ext.upper()})"
                        })
        except Exception as e:
            pass
        return findings

    def scan_directory(self, root_dir):
        all_findings = []
        for dirpath, _, filenames in os.walk(root_dir):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                res = self.scan_file(fpath)
                if res:
                    all_findings.extend(res)
        return all_findings
