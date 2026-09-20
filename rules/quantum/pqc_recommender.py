class PQCRecommender:
    """
    PQC Recommendation Engine
    Produces actionable NIST-referenced post-quantum recommendations considering:
    - Security level
    - Performance / Latency impact
    - Key size expansion
    - Compatibility & Operational Complexity
    """

    def generate_recommendation(self, current_algo, purpose="General"):
        current = current_algo.upper()

        if "RSA" in current or "ECDH" in current or "DH" in current:
            return {
                "target_pqc_standard": "FIPS 203 (ML-KEM)",
                "recommended_algorithm": "ML-KEM-768 (NIST Category 3 Security - Equivalent to AES-192)",
                "hybrid_option": "Hybrid X25519 + ML-KEM-768",
                "nist_reference": "NIST FIPS 203 Section 1.1",
                "trade_offs": {
                    "security": "Post-Quantum Secure against lattice attacks.",
                    "latency": "Minimal computational overhead; fast encapsulation/decapsulation.",
                    "key_size": "Public Key: 1,184 bytes | Ciphertext: 1,088 bytes (larger than RSA/ECDH).",
                    "compatibility": "Requires TLS 1.3 key_share extension or software library update (OpenSSL 3.2+ / OQS).",
                    "operational_complexity": "Medium (Hybrid transition mode recommended for backwards compatibility)."
                },
                "action_steps": [
                    "Step 1: Deploy hybrid key exchange (X25519 + ML-KEM-768) to maintain classical fallback.",
                    "Step 2: Upgrade application crypto dependencies to OQS-enabled releases.",
                    "Step 3: Monitor IETF TLS 1.3 PQC key exchange standardization."
                ]
            }
        elif "ECDSA" in current or "DSA" in current or "RSA-SIGN" in current:
            return {
                "target_pqc_standard": "FIPS 204 (ML-DSA) / FIPS 205 (SLH-DSA)",
                "recommended_algorithm": "ML-DSA-65 (NIST Category 3 Security)",
                "hybrid_option": "Dual-Signature Hybrid (ECDSA P-256 + ML-DSA-65)",
                "nist_reference": "NIST FIPS 204 & FIPS 205",
                "trade_offs": {
                    "security": "Post-Quantum Secure digital signatures.",
                    "latency": "Fast signature generation and verification.",
                    "key_size": "Public Key: 1,952 bytes | Signature: 3,309 bytes.",
                    "compatibility": "X.509 dual-signature extension support required in PKI stack.",
                    "operational_complexity": "High (PKI certificate authority and trust store upgrades needed)."
                },
                "action_steps": [
                    "Step 1: Issue dual-signed X.509 certificates (ECDSA + ML-DSA-65).",
                    "Step 2: Update trust stores and TLS handshakes to verify ML-DSA signatures.",
                    "Step 3: Keep SLH-DSA (FIPS 205) as secondary fallback signature provider."
                ]
            }
        else:
            return {
                "target_pqc_standard": "NIST SP 800-57 Part 1 Rev. 5",
                "recommended_algorithm": "AES-256-GCM / SHA-384",
                "hybrid_option": "N/A (Symmetric Primitive)",
                "nist_reference": "NIST SP 800-57 Part 1 Rev. 5 Section 5.6",
                "trade_offs": {
                    "security": "256-bit key provides 128-bit quantum security against Grover's search.",
                    "latency": "Hardware-accelerated AES-NI yields zero performance overhead.",
                    "key_size": "32 bytes (256 bits).",
                    "compatibility": "Universal support across all platforms.",
                    "operational_complexity": "Low."
                },
                "action_steps": [
                    "Step 1: Enforce 256-bit symmetric keys across data-at-rest and data-in-transit.",
                    "Step 2: Configure hardware AES-NI acceleration."
                ]
            }
