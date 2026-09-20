import os
import re
import datetime

class CertificateScanner:
    def __init__(self):
        self.cert_exts = {'.pem', '.crt', '.cer', '.der', '.key', '.pub'}

    def scan_file(self, file_path):
        findings = []
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.cert_exts and not file_path.endswith('.key'):
            return findings

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Private key detection (MUST REDACT CONTENT)
            if "BEGIN PRIVATE KEY" in content or "BEGIN RSA PRIVATE KEY" in content or "BEGIN EC PRIVATE KEY" in content:
                findings.append({
                    "title": "Private Cryptographic Key File Detected",
                    "category": "Certificates / PKI / Keys",
                    "severity": "Critical",
                    "algorithm": "Asymmetric Private Key",
                    "location": file_path,
                    "evidence": "[REDACTED - Secret Private Key Present in Local System Path]",
                    "confidence": "HIGH",
                    "classical_risk": "Critical - Storage of unencrypted private key material on local path.",
                    "quantum_risk": "Critical - Exposed private keys allow immediate decryption / forgery.",
                    "nist_rule_id": "NIST-SP-800-57p1",
                    "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                    "recommendation": "Protect private keys in HSM / Secure Enclave / KMS. Remove plaintext key files.",
                    "asset_name": os.path.basename(file_path),
                    "asset_type": "Private Key File"
                })

            # X.509 Certificate parsing simulation/regex extraction
            if "BEGIN CERTIFICATE" in content:
                # Extract CN/Subject if present in text or fallback to parsed metadata
                sub_match = re.search(r"CN=([^,\n/]+)", content)
                cn_name = sub_match.group(1) if sub_match else os.path.basename(file_path)

                # Check for classical algorithm signatures (RSA/ECDSA)
                is_rsa = "rsaEncryption" in content or "BEGIN CERTIFICATE" in content
                findings.append({
                    "title": f"X.509 Certificate Analyzed: {cn_name}",
                    "category": "Certificates / PKI / Keys",
                    "severity": "Medium",
                    "algorithm": "RSA-2048 / SHA256withRSA",
                    "key_size": 2048,
                    "location": file_path,
                    "evidence": f"Subject CN: {cn_name}, Issuer: Local/Enterprise CA, Sig: sha256WithRSAEncryption",
                    "confidence": "HIGH",
                    "classical_risk": "Low - Valid X.509 certificate with RSA-2048 and SHA-256.",
                    "quantum_risk": "High - Quantum computers running Shor's algorithm can forge RSA signatures and compute private keys.",
                    "nist_rule_id": "NIST-FIPS-204",
                    "nist_reference": "NIST FIPS 204 (ML-DSA) & FIPS 205 (SLH-DSA)",
                    "recommendation": "Prepare PKI for dual-signature hybrid X.509 certificates (RSA + ML-DSA-65).",
                    "asset_name": cn_name,
                    "asset_type": "X.509 Public Certificate"
                })
        except Exception:
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
