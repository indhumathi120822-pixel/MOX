// Centralized Data-Driven Cryptographic Reference Catalogue (Node.js Engine)
// Loads data/crypto_algorithms.json dynamically (90 Reference Entries)

const fs = require('fs');
const path = require('path');

let CRYPTO_DATABASE = [];

function loadCryptoDatabase() {
  const possiblePaths = [
    path.join(__dirname, '../data/crypto_algorithms.json'),
    path.join(__dirname, 'data/crypto_algorithms.json'),
    path.join(process.cwd(), 'data/crypto_algorithms.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        CRYPTO_DATABASE = JSON.parse(raw);
        return CRYPTO_DATABASE;
      } catch (err) {
        console.error(`[CryptoCatalog] Error parsing ${p}:`, err.message);
      }
    }
  }
  return CRYPTO_DATABASE;
}

loadCryptoDatabase();

function getCryptoDatabase() {
  return loadCryptoDatabase();
}

function lookupCryptoCatalog(algoName, keySize = null) {
  const db = getCryptoDatabase();
  const nameUpper = (algoName || "").toUpperCase().trim();

  let matched = null;
  for (const item of db) {
    if (item.name.toUpperCase() === nameUpper) { matched = item; break; }
    if (item.aliases && item.aliases.some(alias => alias.toUpperCase() === nameUpper || nameUpper.includes(alias.toUpperCase()))) { matched = item; break; }
  }
  if (!matched) {
    for (const item of db) {
      if (nameUpper.includes(item.name.toUpperCase())) { matched = item; break; }
    }
  }

  const isAsym = /RSA|ECC|ECDSA|DH|DSA|ECDH|ELGAMAL|ECIES|X25519|X448|ED25519|ED448/i.test(nameUpper);
  const isWeakSym = /DES|3DES|RC4|BLOWFISH|MD5|SHA-1|SHA1/i.test(nameUpper);
  const isPqc = /ML-KEM|ML-DSA|SLH-DSA|KYBER|DILITHIUM|SPHINCS/i.test(nameUpper);

  let nistRef = "NIST SP 800-57 Part 1 Rev. 5 (Recommendation for Key Management)";
  let nistUrl = "https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final";
  let nistDoc = "NIST SP 800-57 Part 1";

  if (isAsym) {
    nistRef = "NIST FIPS 203 (ML-KEM) & FIPS 204 (ML-DSA) PQC Standards";
    nistUrl = "https://csrc.nist.gov/pubs/fips/203/final";
    nistDoc = "NIST FIPS 203 / FIPS 204";
  } else if (/AES/i.test(nameUpper)) {
    nistRef = "NIST FIPS 197 (Advanced Encryption Standard - AES) & SP 800-38D (GCM)";
    nistUrl = "https://csrc.nist.gov/pubs/fips/197/final";
    nistDoc = "NIST FIPS 197";
  } else if (/SHA-2|SHA-256|SHA-384|SHA-512|SHA-3/i.test(nameUpper)) {
    nistRef = "NIST FIPS 180-4 (Secure Hash Standard) & FIPS 202 (SHA-3 Standard)";
    nistUrl = "https://csrc.nist.gov/pubs/fips/180-4/upd1/final";
    nistDoc = "NIST FIPS 180-4";
  } else if (isWeakSym) {
    nistRef = "NIST SP 800-131A Rev. 2 (Transitioning the Use of Cryptographic Algorithms)";
    nistUrl = "https://csrc.nist.gov/pubs/sp/800/131a/r2/final";
    nistDoc = "NIST SP 800-131A Rev. 2";
  } else if (/TLS|SSL/i.test(nameUpper)) {
    nistRef = "NIST SP 800-52 Rev. 2 (Guidelines for Selection, Configuration, and Use of TLS)";
    nistUrl = "https://csrc.nist.gov/pubs/sp/800/52/r2/final";
    nistDoc = "NIST SP 800-52 Rev. 2";
  } else if (!matched) {
    nistRef = "NIST-specific reference not established for this finding";
    nistUrl = null;
    nistDoc = "NIST Reference Not Established";
  }

  return {
    ...(matched || {}),
    id: matched?.id || "unknown",
    name: algoName || "Unknown Primitive",
    category: matched?.category || "General Cryptography",
    status: matched?.status || "INFORMATIONAL",
    quantum_status: matched?.quantum_status || (isAsym ? "Quantum Vulnerable (Shor Exposed)" : isPqc ? "Quantum Safe (PQC)" : "Quantum Resistant"),
    classical_security: matched?.classical_security || (isWeakSym ? "Deprecated / Vulnerable" : "Secure"),
    risk_level: matched?.risk_level || (isAsym ? "Critical" : isWeakSym ? "High" : "Low"),
    nist_ref: nistRef,
    nist_url: nistUrl,
    nist_doc: nistDoc,
    migration_target: isAsym ? "NIST FIPS 203 ML-KEM-768 or FIPS 204 ML-DSA-65" : isWeakSym ? "AES-256-GCM / SHA-384" : "NIST SP 800-57 Compliant"
  };
}

module.exports = {
  loadCryptoDatabase,
  getCryptoDatabase,
  lookupCryptoCatalog
};
