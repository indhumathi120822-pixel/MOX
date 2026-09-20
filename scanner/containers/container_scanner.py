import os
import re

class ContainerScanner:
    def __init__(self):
        pass

    def scan_dockerfile(self, file_path):
        findings = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()

            for idx, line in enumerate(lines, 1):
                # Outdated base image or crypto packages
                if re.search(r"(?i)\bFROM\s+(ubuntu:14\.04|ubuntu:16\.04|debian:8|alpine:3\.5)\b", line):
                    findings.append({
                        "title": "Use of Outdated Container Base Image",
                        "category": "Containers / Images",
                        "severity": "High",
                        "algorithm": "Base Image OS Cryptography",
                        "location": file_path,
                        "line_number": idx,
                        "evidence": line.strip(),
                        "confidence": "HIGH",
                        "classical_risk": "High - Deprecated OS base image contains vulnerable system OpenSSL binaries.",
                        "quantum_risk": "High - Unable to support PQC software stacks on EOL base distributions.",
                        "nist_rule_id": "NIST-CSF-2.0-PR.DS",
                        "nist_reference": "NIST CSF 2.0 PR.DS-01",
                        "recommendation": "Upgrade base container image to current LTS release (e.g. Alpine 3.19, Debian 12, Ubuntu 24.04).",
                        "asset_name": os.path.basename(file_path),
                        "asset_type": "Dockerfile Base Image"
                    })
                elif re.search(r"(?i)\b(openssl-dev|libssl-dev|ca-certificates)\b", line):
                    findings.append({
                        "title": "Container SSL/TLS Package Installation Detected",
                        "category": "Containers / Images",
                        "severity": "Medium",
                        "algorithm": "OpenSSL / System PKI",
                        "location": file_path,
                        "line_number": idx,
                        "evidence": line.strip(),
                        "confidence": "HIGH",
                        "classical_risk": "Medium - System library provides crypto primitives.",
                        "quantum_risk": "Medium - System OpenSSL must be upgraded to versions supporting ML-KEM/ML-DSA (OpenSSL 3.2+ / OQS).",
                        "nist_rule_id": "NIST-SP-800-52r2",
                        "nist_reference": "NIST SP 800-52 Rev. 2",
                        "recommendation": "Ensure container crypto dependencies are updated continuously.",
                        "asset_name": os.path.basename(file_path),
                        "asset_type": "Container Configuration"
                    })
        except Exception:
            pass
        return findings

    def scan_directory(self, root_dir):
        all_findings = []
        for dirpath, _, filenames in os.walk(root_dir):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                if fname.lower().startswith("dockerfile") or fname.endswith(".dockerfile"):
                    all_findings.extend(self.scan_dockerfile(fpath))
        return all_findings
