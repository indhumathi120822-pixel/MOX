class NISTEngine:
    """
    NIST-Referenced Compliance Engine
    Maps findings to official NIST standards:
    - FIPS 203 (ML-KEM)
    - FIPS 204 (ML-DSA)
    - FIPS 205 (SLH-DSA)
    - NIST SP 800-52 Rev. 2 (TLS Selection & Configuration)
    - NIST SP 800-57 Part 1 Rev. 5 (Key Management)
    - NIST Cybersecurity Framework 2.0 (CSF 2.0)
    """

    def __init__(self):
        self.reference_map = {
            "PQC-KEM": {
                "standard": "FIPS 203 — Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM)",
                "url": "https://csrc.nist.gov/pubs/fips/203/final",
                "guidance": "Recommended for general public-key encryption and key establishment against quantum attack."
            },
            "PQC-DSA": {
                "standard": "FIPS 204 — Module-Lattice-Based Digital Signature Algorithm (ML-DSA)",
                "url": "https://csrc.nist.gov/pubs/fips/204/final",
                "guidance": "Recommended primary standard for general digital signatures."
            },
            "PQC-SLH": {
                "standard": "FIPS 205 — Stateless Hash-Based Digital Signature Algorithm (SLH-DSA)",
                "url": "https://csrc.nist.gov/pubs/fips/205/final",
                "guidance": "Recommended stateless hash-based digital signature fallback."
            },
            "TLS": {
                "standard": "NIST SP 800-52 Rev. 2 — Guidelines for the Selection, Configuration, and Use of TLS Options",
                "url": "https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final",
                "guidance": "Mandates TLS 1.3 as preferred protocol for federal systems and restricts non-AEAD cipher suites."
            },
            "KEY-MGMT": {
                "standard": "NIST SP 800-57 Part 1 Rev. 5 — Recommendation for Key Management",
                "url": "https://csrc.nist.gov/publications/detail/sp/800-57/part-1/rev-5/final",
                "guidance": "Defines key length equivalencies and minimum security strengths (128-bit min, 256-bit PQC)."
            },
            "CSF": {
                "standard": "NIST Cybersecurity Framework (CSF) 2.0 — Protect (PR.DS)",
                "url": "https://www.nist.gov/cyberframework",
                "guidance": "Framework outcomes for safeguarding data-at-rest and data-in-transit."
            }
        }

    def get_reference(self, rule_type):
        return self.reference_map.get(rule_type, self.reference_map["CSF"])
