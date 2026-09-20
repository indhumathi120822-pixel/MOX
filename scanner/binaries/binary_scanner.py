import os
import re

class BinaryScanner:
    def __init__(self):
        self.crypto_symbols = [
            {"symbol": "EVP_DecryptInit", "algo": "OpenSSL EVP Cipher API", "severity": "Medium"},
            {"symbol": "DES_ncbc_encrypt", "algo": "DES Cipher (OpenSSL)", "severity": "Critical"},
            {"symbol": "MD5_Init", "algo": "MD5 Hash Function", "severity": "High"},
            {"symbol": "SHA1_Init", "algo": "SHA-1 Hash Function", "severity": "Medium"},
            {"symbol": "RSA_generate_key", "algo": "RSA Key Generation", "severity": "Medium"},
            {"symbol": "EC_KEY_new_by_curve_name", "algo": "Elliptic Curve Key Creation", "severity": "Medium"},
            {"symbol": "CryptEncrypt", "algo": "Windows CryptoAPI", "severity": "Medium"},
            {"symbol": "BCryptEncrypt", "algo": "Windows CNG API", "severity": "Medium"}
        ]
        self.supported_exts = {'.exe', '.dll', '.so', '.dylib', '.elf', '.bin', '.a'}

    def scan_file(self, file_path):
        findings = []
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.supported_exts:
            return findings

        try:
            with open(file_path, 'rb') as f:
                content = f.read(1024 * 1024 * 5) # Read first 5MB for static symbols

            content_str = content.decode('latin-1', errors='ignore')

            detected_symbols = []
            for item in self.crypto_symbols:
                if item["symbol"] in content_str:
                    detected_symbols.append(item)

            if detected_symbols:
                for sym in detected_symbols:
                    findings.append({
                        "title": f"Static Binary Symbol Detected: {sym['symbol']} ({sym['algo']})",
                        "category": "Binaries / Executables",
                        "severity": sym["severity"],
                        "algorithm": sym["algo"],
                        "location": file_path,
                        "evidence": f"Static analysis only. Exported/Imported Symbol: {sym['symbol']}",
                        "confidence": "MEDIUM",
                        "classical_risk": "Medium - Legacy binary imports cryptographic symbols statically linked.",
                        "quantum_risk": "High - Asymmetric binary crypto symbols (RSA/EC) are quantum vulnerable.",
                        "nist_rule_id": "NIST-SP-800-57p1",
                        "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                        "recommendation": "Recompile binary with modern post-quantum cryptography library wrappers.",
                        "asset_name": os.path.basename(file_path),
                        "asset_type": f"Binary Executable ({ext.upper()})"
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
