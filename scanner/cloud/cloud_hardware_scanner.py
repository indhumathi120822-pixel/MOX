import os
import re
import json

class CloudHardwareScanner:
    def __init__(self):
        pass

    def scan_file(self, file_path):
        findings = []
        ext = os.path.splitext(file_path)[1].lower()
        fname = os.path.basename(file_path).lower()

        if not (ext in ['.tf', '.json', '.yaml', '.yml', '.cfg', '.conf'] or 'hsm' in fname or 'kms' in fname or 'pkcs11' in fname):
            return findings

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # AWS/Azure/GCP KMS key spec inspection
            if "aws_kms_key" in content or "google_kms_crypto_key" in content or "azurerm_key_vault_key" in content:
                if "SYMMETRIC_DEFAULT" in content or "AES_256" in content:
                    findings.append({
                        "title": "Cloud KMS Key Configured: AES-256 Symmetric Key",
                        "category": "Cloud Services / Hardware Modules",
                        "severity": "Low",
                        "algorithm": "AES-256 (KMS Managed)",
                        "key_size": 256,
                        "location": file_path,
                        "evidence": "Cloud KMS resource definition detected with AES-256 symmetric encryption.",
                        "confidence": "HIGH",
                        "classical_risk": "Low - AES-256 provides strong classical encryption.",
                        "quantum_risk": "Low - AES-256 retains 128-bit security against Grover's quantum search algorithm.",
                        "nist_rule_id": "NIST-SP-800-57p1",
                        "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                        "recommendation": "Maintain KMS automatic key rotation policies.",
                        "asset_name": os.path.basename(file_path),
                        "asset_type": "Cloud KMS Definition"
                    })
                elif "RSA_2048" in content or "RSA_3072" in content or "ASYMMETRIC" in content:
                    findings.append({
                        "title": "Cloud KMS Asymmetric Key: RSA Quantum-Vulnerable Config",
                        "category": "Cloud Services / Hardware Modules",
                        "severity": "High",
                        "algorithm": "RSA (KMS Asymmetric)",
                        "location": file_path,
                        "evidence": "Cloud KMS resource configured with asymmetric RSA key pair.",
                        "confidence": "HIGH",
                        "classical_risk": "Low - Secure key stored within cloud FIPS 140-2 Level 3 HSM.",
                        "quantum_risk": "High - Asymmetric cloud KMS keys are vulnerable to quantum decryption.",
                        "nist_rule_id": "NIST-FIPS-203",
                        "nist_reference": "NIST FIPS 203 (ML-KEM) & FIPS 204 (ML-DSA)",
                        "recommendation": "Prepare KMS key migration to PQC-enabled cloud HSM endpoints.",
                        "asset_name": os.path.basename(file_path),
                        "asset_type": "Cloud KMS Definition"
                    })

            # PKCS#11 Hardware Security Module config
            if "pkcs11" in content.lower() or "slot" in content.lower() and "hsm" in content.lower():
                findings.append({
                    "title": "PKCS#11 Hardware Security Module (HSM) Configured",
                    "category": "Cloud Services / Hardware Modules",
                    "severity": "Info",
                    "algorithm": "HSM PKCS#11 Provider",
                    "location": file_path,
                    "evidence": "PKCS#11 token interface definition detected for hardware crypto acceleration.",
                    "confidence": "HIGH",
                    "classical_risk": "Low - Hardware tampered boundary enforces cryptographic key protection.",
                    "quantum_risk": "Medium - Ensure HSM firmware updates support PQC algorithms (FIPS 203/204).",
                    "nist_rule_id": "NIST-SP-800-57p1",
                    "nist_reference": "NIST SP 800-57 Part 1 Rev. 5",
                    "recommendation": "Verify vendor HSM firmware roadmap for FIPS 203/204 algorithm support.",
                    "asset_name": os.path.basename(file_path),
                    "asset_type": "HSM PKCS#11 Provider"
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
