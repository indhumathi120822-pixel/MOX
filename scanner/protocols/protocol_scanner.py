import os
import re

class ProtocolScanner:
    def __init__(self):
        pass

    def scan_config_file(self, file_path):
        findings = []
        fname = os.path.basename(file_path).lower()
        if not (fname.endswith('.conf') or fname.endswith('.cfg') or 'nginx' in fname or 'httpd' in fname or 'ssl' in fname):
            return findings

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()

            for idx, line in enumerate(lines, 1):
                # Deprecated TLS protocols (CONFIGURED)
                if re.search(r"(?i)\b(TLSv1|TLSv1\.1|SSLv2|SSLv3)\b", line) and not line.strip().startswith('#'):
                    findings.append({
                        "title": "CONFIGURED Deprecated TLS Protocol Version (TLS 1.0/1.1)",
                        "category": "Protocols / Network / TLS",
                        "severity": "High",
                        "protocol": "TLS 1.0 / TLS 1.1",
                        "location": file_path,
                        "line_number": idx,
                        "evidence": f"[CONFIGURED STATE] {line.strip()}",
                        "confidence": "HIGH",
                        "classical_risk": "High - Deprecated protocol vulnerable to BEAST, POODLE, and Lucky13 attacks.",
                        "quantum_risk": "Critical - Key exchange in legacy TLS lacks PQC hybrid extensions.",
                        "nist_rule_id": "NIST-SP-800-52r2",
                        "nist_reference": "NIST SP 800-52 Rev. 2 Section 3.1",
                        "recommendation": "Disable TLS 1.0 and TLS 1.1 in web server configuration. Enforce TLS 1.3 or TLS 1.2 with approved AEAD ciphers.",
                        "asset_name": fname,
                        "asset_type": "TLS Configuration"
                    })
                # Weak cipher suites (CONFIGURED)
                elif re.search(r"(?i)\b(RC4|3DES|CBC|NULL|EXPORT)\b", line) and not line.strip().startswith('#'):
                    findings.append({
                        "title": "CONFIGURED Weak/Non-AEAD TLS Cipher Suite",
                        "category": "Protocols / Network / TLS",
                        "severity": "High",
                        "protocol": "TLS Cipher Suite",
                        "location": file_path,
                        "line_number": idx,
                        "evidence": f"[CONFIGURED STATE] {line.strip()}",
                        "confidence": "HIGH",
                        "classical_risk": "High - CBC and stream ciphers are susceptible to padding oracle attacks.",
                        "quantum_risk": "High - Symmetric keys < 256 bits suffer security reduction from Grover search.",
                        "nist_rule_id": "NIST-SP-800-52r2",
                        "nist_reference": "NIST SP 800-52 Rev. 2 Section 3.3",
                        "recommendation": "Configure cipher suite preference to ECDHE-ECDSA-AES256-GCM-SHA384 or TLS_AES_256_GCM_SHA384.",
                        "asset_name": fname,
                        "asset_type": "TLS Configuration"
                    })
        except Exception:
            pass
        return findings

    def scan_directory(self, root_dir):
        all_findings = []
        for dirpath, _, filenames in os.walk(root_dir):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                res = self.scan_config_file(fpath)
                if res:
                    all_findings.extend(res)
        return all_findings
