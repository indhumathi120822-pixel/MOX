# Centralized Data-Driven NIST Cryptographic Reference Catalogue
# Extensible catalog covering all cryptographic algorithm families, NIST statuses, publications, and parameters

CRYPTO_CATALOG = {
    # Symmetric Encryption / Block Ciphers
    "AES": {
        "family": "Symmetric Block Cipher",
        "purpose": "Symmetric Encryption / Data Protection",
        "modes": ["GCM", "CBC", "CTR", "CCM", "ECB"],
        "key_sizes": [128, 192, 256],
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 197 & SP 800-38A",
        "nist_doc": "NIST FIPS 197 (Advanced Encryption Standard)",
        "quantum_status": "Quantum-resistant", # 256-bit AES retains 128-bit security against Grover
        "migration_target": "Upgrade AES-128/ECB to AES-256-GCM"
    },
    "DES": {
        "family": "Symmetric Block Cipher (Legacy)",
        "purpose": "Symmetric Encryption",
        "modes": ["ECB", "CBC"],
        "key_sizes": [56],
        "nist_status": "DISALLOWED",
        "nist_ref": "NIST SP 800-131A Rev. 2",
        "nist_doc": "NIST SP 800-131A Rev. 2 Section 3",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "AES-256-GCM"
    },
    "3DES": {
        "family": "Triple Data Encryption Algorithm",
        "purpose": "Symmetric Encryption",
        "modes": ["CBC", "ECB"],
        "key_sizes": [112, 168],
        "nist_status": "DEPRECATED",
        "nist_ref": "NIST SP 800-131A Rev. 2",
        "nist_doc": "NIST SP 800-131A Rev. 2 (Disallowed after 2023)",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "AES-256-GCM"
    },
    "RC4": {
        "family": "Stream Cipher",
        "purpose": "Symmetric Stream Encryption",
        "nist_status": "DISALLOWED",
        "nist_ref": "NIST SP 800-52 Rev. 2",
        "nist_doc": "RFC 7465 / NIST SP 800-52 Rev. 2 Section 3.3",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "AES-256-GCM or ChaCha20-Poly1305"
    },
    "CHACHA20": {
        "family": "Stream Cipher",
        "purpose": "Symmetric Stream Encryption & AEAD",
        "nist_status": "INFORMATIONAL",
        "nist_ref": "NIST SP 800-52 Rev. 2 & RFC 8439",
        "nist_doc": "RFC 8439 (ChaCha20 and Poly1305)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "ChaCha20-Poly1305 or AES-256-GCM"
    },

    # Hash Functions
    "MD5": {
        "family": "Cryptographic Hash",
        "purpose": "Message Digest / Integrity",
        "nist_status": "DISALLOWED",
        "nist_ref": "NIST SP 800-131A Rev. 2",
        "nist_doc": "NIST SP 800-131A Rev. 2 Section 9",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "SHA-256 / SHA-512 / SHA3-256"
    },
    "SHA-1": {
        "family": "Secure Hash Algorithm 1",
        "purpose": "Message Digest",
        "nist_status": "DEPRECATED",
        "nist_ref": "NIST SP 800-131A Rev. 2",
        "nist_doc": "NIST SP 800-131A Rev. 2 (Disallowed for digital signatures)",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "SHA-256 / SHA-384 / SHA-512"
    },
    "SHA-256": {
        "family": "Secure Hash Algorithm 2",
        "purpose": "Message Digest / Hashing",
        "digest_bits": 256,
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 180-4",
        "nist_doc": "NIST FIPS 180-4 (Secure Hash Standard)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Maintain SHA-256 or SHA3-256"
    },
    "SHA-512": {
        "family": "Secure Hash Algorithm 2",
        "purpose": "Message Digest / High Strength Hashing",
        "digest_bits": 512,
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 180-4",
        "nist_doc": "NIST FIPS 180-4 (Secure Hash Standard)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Maintain SHA-512"
    },
    "SHA3-256": {
        "family": "Keccak Hash Algorithm Family",
        "purpose": "Permutation-Based Hash Function",
        "digest_bits": 256,
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 202",
        "nist_doc": "NIST FIPS 202 (SHA-3 Standard)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Maintain SHA3-256"
    },

    # MAC / Authentication
    "HMAC-SHA256": {
        "family": "Hash-Based Message Authentication Code",
        "purpose": "Data Origin Authentication / MAC",
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 198-1",
        "nist_doc": "NIST FIPS 198-1 (The Keyed-Hash Message Authentication Code)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Maintain HMAC-SHA256"
    },

    # Asymmetric / Key Exchange / Public Key Encryption
    "RSA": {
        "family": "Rivest-Shamir-Adleman",
        "purpose": "Digital Signatures & Public-Key Encryption",
        "key_sizes": [1024, 2048, 3072, 4096],
        "nist_status": "DEPRECATED", # Deprecated for PQC transition
        "nist_ref": "NIST FIPS 204 & SP 800-57 Part 1",
        "nist_doc": "NIST SP 800-57 Part 1 Rev. 5 & FIPS 204",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "ML-KEM-768 (KEM) / ML-DSA-65 (Signatures)"
    },
    "ECDH": {
        "family": "Elliptic Curve Diffie-Hellman",
        "purpose": "Asymmetric Key Agreement",
        "curves": ["P-256", "P-384", "P-521", "X25519"],
        "nist_status": "DEPRECATED",
        "nist_ref": "NIST FIPS 203 & SP 800-56A Rev. 3",
        "nist_doc": "NIST SP 800-56A Rev. 3 & FIPS 203",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "FIPS 203 ML-KEM-768 or Hybrid ECDH + ML-KEM"
    },
    "ECDSA": {
        "family": "Elliptic Curve Digital Signature Algorithm",
        "purpose": "Digital Signatures / Authentication",
        "curves": ["P-256", "P-384", "P-521", "Ed25519"],
        "nist_status": "DEPRECATED",
        "nist_ref": "NIST FIPS 204 & FIPS 186-5",
        "nist_doc": "NIST FIPS 186-5 & FIPS 204",
        "quantum_status": "Quantum-vulnerable",
        "migration_target": "FIPS 204 ML-DSA-65 / FIPS 205 SLH-DSA"
    },

    # Post-Quantum Cryptography (PQC Finalized & Candidate Standards)
    "ML-KEM": {
        "family": "Module-Lattice Key Encapsulation",
        "purpose": "Post-Quantum Key Establishment / Encapsulation",
        "parameter_sets": ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 203",
        "nist_doc": "NIST FIPS 203 (Module-Lattice-Based Key-Encapsulation Mechanism)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Primary PQC standard for key encapsulation"
    },
    "ML-DSA": {
        "family": "Module-Lattice Digital Signatures",
        "purpose": "Post-Quantum General Digital Signatures",
        "parameter_sets": ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 204",
        "nist_doc": "NIST FIPS 204 (Module-Lattice-Based Digital Signature Standard)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Primary PQC standard for digital signatures"
    },
    "SLH-DSA": {
        "family": "Stateless Hash-Based Digital Signatures",
        "purpose": "Post-Quantum Hash-Based Digital Signatures",
        "parameter_sets": ["SLH-DSA-SHA2-128f", "SLH-DSA-SHAKE-128f", "SLH-DSA-SHA2-256f"],
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST FIPS 205",
        "nist_doc": "NIST FIPS 205 (Stateless Hash-Based Digital Signature Standard)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Fallback lattice-independent PQC signature standard"
    },
    "HQC": {
        "family": "Hamming Quasi-Cyclic Code-Based KEM",
        "purpose": "Code-Based Key Encapsulation",
        "nist_status": "SELECTED_FOR_STANDARDIZATION",
        "nist_ref": "NIST PQC Round 4",
        "nist_doc": "NIST Post-Quantum Cryptography Standardization Round 4",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Alternative code-based KEM for lattice backup"
    },
    "HYBRID-KEM": {
        "family": "Hybrid Classical + Post-Quantum Scheme",
        "purpose": "Key Encapsulation Backwards Compatibility",
        "nist_status": "INFORMATIONAL",
        "nist_ref": "NIST SP 800-227 Draft & IETF TLS 1.3 PQC",
        "nist_doc": "NIST Recommendation for Hybrid Key Establishment Schemes",
        "quantum_status": "Hybrid",
        "migration_target": "Deploy X25519 + ML-KEM-768 for transitional TLS handshakes"
    },

    # Key Derivation Functions (KDF)
    "PBKDF2": {
        "family": "Password-Based Key Derivation",
        "purpose": "Password Hashing & Key Derivation",
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST SP 800-132",
        "nist_doc": "NIST SP 800-132 (Recommendation for Password-Based Key Derivation)",
        "quantum_status": "Quantum-resistant",
        "migration_target": "PBKDF2 with SHA-256 / Argon2id"
    },
    "HKDF": {
        "family": "HMAC-based Extract-and-Expand KDF",
        "purpose": "Key Derivation in Protocols",
        "nist_status": "FINAL_STANDARD",
        "nist_ref": "NIST SP 800-56C Rev. 2",
        "nist_doc": "NIST SP 800-56C Rev. 2 Section 4",
        "quantum_status": "Quantum-resistant",
        "migration_target": "Maintain HKDF-SHA256"
    }
}

def lookup_crypto_catalog(algo_name):
    name_upper = algo_name.upper()
    for key, item in CRYPTO_CATALOG.items():
        if key in name_upper:
            return item
    return {
        "family": "Cryptographic Primitive",
        "purpose": "General Cryptography",
        "nist_status": "INFORMATIONAL",
        "nist_ref": "NIST SP 800-57 Part 1",
        "nist_doc": "NIST SP 800-57 Part 1 Rev. 5",
        "quantum_status": "Unknown / needs review",
        "migration_target": "Review cryptographic usage against NIST SP 800-57 guidance"
    }
