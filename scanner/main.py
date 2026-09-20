import os
import sys
import json
import argparse
import sqlite3

# Add parent path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanner.source.source_scanner import SourceScanner
from scanner.libraries.library_scanner import LibraryScanner
from scanner.binaries.binary_scanner import BinaryScanner
from scanner.containers.container_scanner import ContainerScanner
from scanner.certificates.certificate_scanner import CertificateScanner
from scanner.protocols.protocol_scanner import ProtocolScanner
from scanner.cloud.cloud_hardware_scanner import CloudHardwareScanner
from scanner.cbom_generator import CBOMGenerator
from rules.quantum.mosca_engine import MoscaEngine
from rules.nist.nist_engine import NISTEngine
from rules.quantum.pqc_recommender import PQCRecommender

def fetch_cve_cache(db_path):
    cves = []
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cve_cache")
            rows = cursor.fetchall()
            for r in rows:
                cves.append(dict(r))
            conn.close()
        except Exception:
            pass
    return cves

def run_scan(target_path, db_path=None, project_name="Enterprise Application"):
    cves = fetch_cve_cache(db_path) if db_path else []

    source_scanner = SourceScanner()
    library_scanner = LibraryScanner(cve_db=cves)
    binary_scanner = BinaryScanner()
    container_scanner = ContainerScanner()
    cert_scanner = CertificateScanner()
    protocol_scanner = ProtocolScanner()
    cloud_scanner = CloudHardwareScanner()
    mosca_engine = MoscaEngine()
    pqc_recommender = PQCRecommender()

    all_findings = []

    if os.path.isfile(target_path):
        # Single file scan
        all_findings.extend(source_scanner.scan_file(target_path))
        all_findings.extend(binary_scanner.scan_file(target_path))
        all_findings.extend(cert_scanner.scan_file(target_path))
        all_findings.extend(protocol_scanner.scan_config_file(target_path))
        all_findings.extend(cloud_scanner.scan_file(target_path))
    else:
        # Directory scan across all 7 categories
        all_findings.extend(source_scanner.scan_directory(target_path))
        all_findings.extend(library_scanner.scan_directory(target_path))
        all_findings.extend(binary_scanner.scan_directory(target_path))
        all_findings.extend(container_scanner.scan_directory(target_path))
        all_findings.extend(cert_scanner.scan_directory(target_path))
        all_findings.extend(protocol_scanner.scan_directory(target_path))
        all_findings.extend(cloud_scanner.scan_directory(target_path))

    # Enrich findings with Mosca Risk calculation and PQC Recommendations
    enriched_findings = []
    for f in all_findings:
        algo = f.get("algorithm", "Unknown")
        mosca_res = mosca_engine.calculate_risk(algo, data_lifetime_x=5, migration_time_y=2)
        pqc_rec = pqc_recommender.generate_recommendation(algo)

        f["mosca_risk"] = mosca_res
        f["pqc_recommendation"] = pqc_rec
        enriched_findings.append(f)

    # Generate Semantic CBOM
    cbom_gen = CBOMGenerator()
    cbom_data = cbom_gen.generate_cbom(enriched_findings, scan_id=1, project_name=project_name)

    # Calculate summary metrics
    total_findings = len(enriched_findings)
    categories = list(set(f.get("category", "") for f in enriched_findings))
    critical_count = sum(1 for f in enriched_findings if f.get("severity") == "Critical")
    high_count = sum(1 for f in enriched_findings if f.get("severity") == "High")
    medium_count = sum(1 for f in enriched_findings if f.get("severity") == "Medium")
    low_count = sum(1 for f in enriched_findings if f.get("severity") == "Low")

    risk_score = round(min(10.0, (critical_count * 3.0 + high_count * 2.0 + medium_count * 1.0) / max(1, total_findings) * 3.0), 1)

    result = {
        "status": "completed",
        "target_path": target_path,
        "total_findings": total_findings,
        "total_assets": len(categories) + total_findings,
        "risk_score": risk_score,
        "summary": {
            "critical": critical_count,
            "high": high_count,
            "medium": medium_count,
            "low": low_count
        },
        "findings": enriched_findings,
        "cbom": cbom_data
    }

    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ECDAT Cryptographic Scanner CLI")
    parser.add_argument("--target", required=True, help="Target directory or file path to scan")
    parser.add_argument("--db", help="Path to SQLite database for CVE cache")
    parser.add_argument("--name", default="Enterprise App", help="Project name")
    args = parser.parse_args()

    res = run_scan(args.target, db_path=args.db, project_name=args.name)
    print(json.dumps(res, indent=2))
