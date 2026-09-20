import os
import json
import re

class LibraryScanner:
    def __init__(self, cve_db=None):
        self.cve_db = cve_db or []
        self.known_crypto_libs = {
            "bouncycastle": {"name": "Bouncy Castle Java Crypto Provider", "algo": "RSA/ECC/AES", "risk": "Medium (Classical)"},
            "org.bouncycastle": {"name": "Bouncy Castle Java Crypto Provider", "algo": "RSA/ECC/AES", "risk": "Medium (Classical)"},
            "crypto-js": {"name": "CryptoJS JavaScript Library", "algo": "AES/DES/SHA", "risk": "Medium (Client-side)"},
            "pycryptodome": {"name": "PyCryptodome Python Toolkit", "algo": "AES/RSA/ECC", "risk": "Medium (Classical)"},
            "pycrypto": {"name": "PyCrypto (Deprecated)", "algo": "DES/RSA/AES", "risk": "High (Unmaintained)"},
            "openssl-sys": {"name": "OpenSSL Rust Crate Bindings", "algo": "TLS/RSA/ECDSA", "risk": "Medium"},
            "commons-crypto": {"name": "Apache Commons Crypto", "algo": "AES/GCM", "risk": "Medium"},
            "cryptography": {"name": "Python Cryptography Authority", "algo": "AES/RSA/ECDSA/Ed25519", "risk": "Low (Maintained)"}
        }

    def scan_package_json(self, file_path):
        findings = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            for pkg, ver in deps.items():
                pkg_lower = pkg.lower()
                for key, info in self.known_crypto_libs.items():
                    if key in pkg_lower:
                        cve_match = self._check_cve(pkg_lower, ver)
                        findings.append({
                            "title": f"Cryptographic Library Dependency: {pkg} ({ver})",
                            "category": "Libraries / Dependencies",
                            "severity": "High" if cve_match else "Medium",
                            "algorithm": info["algo"],
                            "location": file_path,
                            "evidence": f"Package: {pkg}, Version: {ver}",
                            "confidence": "HIGH",
                            "classical_risk": info["risk"],
                            "quantum_risk": "Medium - Public key operations in library require PQC migration.",
                            "nist_rule_id": "NIST-SP-800-57p1",
                            "nist_reference": "NIST SP 800-57 Part 1 Rev. 5",
                            "recommendation": f"Monitor {pkg} for post-quantum hybrid algorithm support (ML-KEM/ML-DSA).",
                            "cve_id": cve_match["cve_id"] if cve_match else None,
                            "asset_name": f"{pkg}@{ver}",
                            "asset_type": "npm Package"
                        })
        except Exception:
            pass
        return findings

    def scan_requirements_txt(self, file_path):
        findings = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = re.split(r'==|>=|<=', line)
                pkg = parts[0].strip()
                ver = parts[1].strip() if len(parts) > 1 else "latest"
                pkg_lower = pkg.lower()
                for key, info in self.known_crypto_libs.items():
                    if key in pkg_lower:
                        cve_match = self._check_cve(pkg_lower, ver)
                        findings.append({
                            "title": f"Cryptographic Python Dependency: {pkg} ({ver})",
                            "category": "Libraries / Dependencies",
                            "severity": "High" if cve_match else "Medium",
                            "algorithm": info["algo"],
                            "location": file_path,
                            "evidence": f"Dependency: {line}",
                            "confidence": "HIGH",
                            "classical_risk": info["risk"],
                            "quantum_risk": "Medium - Ensure underlying crypto backends support PQC primitives.",
                            "nist_rule_id": "NIST-SP-800-57p1",
                            "nist_reference": "NIST SP 800-57 Part 1 Rev. 5",
                            "recommendation": f"Update {pkg} to latest security releases.",
                            "cve_id": cve_match["cve_id"] if cve_match else None,
                            "asset_name": f"{pkg} ({ver})",
                            "asset_type": "PyPI Package"
                        })
        except Exception:
            pass
        return findings

    def _check_cve(self, pkg, version):
        for cve in self.cve_db:
            if cve.get("component", "").lower() in pkg:
                return cve
        return None

    def scan_directory(self, root_dir):
        all_findings = []
        for dirpath, _, filenames in os.walk(root_dir):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                if fname == "package.json":
                    all_findings.extend(self.scan_package_json(fpath))
                elif fname in ["requirements.txt", "Pipfile"]:
                    all_findings.extend(self.scan_requirements_txt(fpath))
        return all_findings
