export const CRYPTO_CATALOG_FRONTEND = [
  {
    id: 'AES',
    family: 'Symmetric Block Cipher',
    purpose: 'Symmetric Encryption / Data Protection',
    nist_status: 'FINAL_STANDARD',
    nist_ref: 'NIST FIPS 197 & SP 800-38A',
    quantum_status: 'Quantum-resistant',
    recommended_action: 'Upgrade AES-128/ECB to AES-256-GCM'
  },
  {
    id: 'DES',
    family: 'Symmetric Block Cipher (Legacy)',
    purpose: 'Symmetric Encryption',
    nist_status: 'DISALLOWED',
    nist_ref: 'NIST SP 800-131A Rev. 2',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Migrate immediately to AES-256-GCM'
  },
  {
    id: '3DES',
    family: 'Triple Data Encryption Algorithm',
    purpose: 'Symmetric Encryption',
    nist_status: 'DEPRECATED',
    nist_ref: 'NIST SP 800-131A Rev. 2',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Migrate to AES-256-GCM'
  },
  {
    id: 'MD5',
    family: 'Cryptographic Hash',
    purpose: 'Message Digest / Integrity',
    nist_status: 'DISALLOWED',
    nist_ref: 'NIST SP 800-131A Rev. 2',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Replace MD5 with SHA-256 / SHA-512 / SHA3-256'
  },
  {
    id: 'SHA-1',
    family: 'Secure Hash Algorithm 1',
    purpose: 'Message Digest',
    nist_status: 'DEPRECATED',
    nist_ref: 'NIST SP 800-131A Rev. 2',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Upgrade to SHA-256 or SHA-3'
  },
  {
    id: 'RSA',
    family: 'Rivest-Shamir-Adleman',
    purpose: 'Digital Signatures & Public-Key Encryption',
    nist_status: 'DEPRECATED',
    nist_ref: 'NIST FIPS 204 & SP 800-57 Part 1',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Migrate RSA to FIPS 203 ML-KEM-768 / FIPS 204 ML-DSA-65'
  },
  {
    id: 'ECDH',
    family: 'Elliptic Curve Diffie-Hellman',
    purpose: 'Asymmetric Key Agreement',
    nist_status: 'DEPRECATED',
    nist_ref: 'NIST FIPS 203 & SP 800-56A Rev. 3',
    quantum_status: 'Quantum-vulnerable',
    recommended_action: 'Migrate ECDH to FIPS 203 ML-KEM-768 or Hybrid ECDH + ML-KEM'
  },
  {
    id: 'ML-KEM',
    family: 'Module-Lattice Key Encapsulation',
    purpose: 'Post-Quantum Key Establishment',
    nist_status: 'FINAL_STANDARD',
    nist_ref: 'NIST FIPS 203',
    quantum_status: 'Quantum-resistant',
    recommended_action: 'Primary PQC standard for key encapsulation (FIPS 203)'
  },
  {
    id: 'ML-DSA',
    family: 'Module-Lattice Digital Signatures',
    purpose: 'Post-Quantum General Digital Signatures',
    nist_status: 'FINAL_STANDARD',
    nist_ref: 'NIST FIPS 204',
    quantum_status: 'Quantum-resistant',
    recommended_action: 'Primary PQC standard for digital signatures (FIPS 204)'
  },
  {
    id: 'SLH-DSA',
    family: 'Stateless Hash-Based Digital Signatures',
    purpose: 'Post-Quantum Hash-Based Signatures',
    nist_status: 'FINAL_STANDARD',
    nist_ref: 'NIST FIPS 205',
    quantum_status: 'Quantum-resistant',
    recommended_action: 'Fallback lattice-independent PQC signature standard (FIPS 205)'
  },
  {
    id: 'HQC',
    family: 'Hamming Quasi-Cyclic Code-Based KEM',
    purpose: 'Code-Based Key Encapsulation',
    nist_status: 'SELECTED_FOR_STANDARDIZATION',
    nist_ref: 'NIST PQC Round 4',
    quantum_status: 'Quantum-resistant',
    recommended_action: 'Alternative code-based KEM for lattice backup'
  }
];
