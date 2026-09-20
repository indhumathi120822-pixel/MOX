class MoscaEngine:
    """
    Mosca-Style Quantum Risk Engine
    
    Evaluates Mosca Inequality: X + Y > Z
    X = Data Lifetime (years data must remain secure)
    Y = Migration Time (years required to transition system to PQC)
    Z = Time until Cryptographically Relevant Quantum Computer (CRQC) (years, default estimate 10)
    
    HNDL (Harvest Now, Decrypt Later) Risk:
    If asymmetric encryption (RSA/ECDH) is used AND X + Y > Z, adversary can intercept
    encrypted ciphertext today and decrypt it once CRQC becomes available.
    """

    def __init__(self, default_z_years=10):
        self.default_z = default_z_years

    def calculate_risk(self, algorithm, data_lifetime_x, migration_time_y, z_years=None):
        z = z_years if z_years is not None else self.default_z
        total_time = data_lifetime_x + migration_time_y

        is_asymmetric_quantum_vulnerable = any(
            algo in algorithm.upper() for algo in ["RSA", "ECDH", "ECDSA", "DH", "DSA"]
        )

        hndl_exposed = is_asymmetric_quantum_vulnerable and (total_time > z)

        if not is_asymmetric_quantum_vulnerable:
            if "AES-256" in algorithm.upper() or "SHA-256" in algorithm.upper() or "SHA-512" in algorithm.upper():
                risk_level = "Low"
                reason = "Symmetric 256-bit algorithm or SHA-256 digest retains security against Grover's quantum algorithm."
            else:
                risk_level = "Medium"
                reason = "Classical symmetric cipher or digest requiring security parameter review."
        else:
            if total_time > z:
                risk_level = "Critical"
                reason = (
                    f"Mosca Inequality Violated: X ({data_lifetime_x} yrs data lifetime) + Y ({migration_time_y} yrs migration time) "
                    f"= {total_time} years, exceeding Z ({z} years to CRQC). High Harvest-Now-Decrypt-Later (HNDL) exposure!"
                )
            elif total_time == z or (z - total_time) <= 2:
                risk_level = "High"
                reason = (
                    f"Mosca Inequality Warning: X ({data_lifetime_x} yrs) + Y ({migration_time_y} yrs) = {total_time} years, "
                    f"nearing expected CRQC timeframe ({z} yrs). Immediate migration planning required."
                )
            else:
                risk_level = "Medium"
                reason = (
                    f"Quantum Vulnerable Algorithm: Asymmetric primitive vulnerable to Shor's algorithm on CRQC. "
                    f"Migration window currently available ({z - total_time} years remaining before critical threshold)."
                )

        return {
            "risk_level": risk_level,
            "data_lifetime_x": data_lifetime_x,
            "migration_time_y": migration_time_y,
            "crqc_time_z": z,
            "mosca_sum_x_plus_y": total_time,
            "mosca_violated": total_time > z,
            "hndl_exposure": hndl_exposed,
            "reason": reason
        }
