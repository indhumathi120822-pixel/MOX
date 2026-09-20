import os
import json

class CBOMGenerator:
    def __init__(self):
        pass

    def generate_cbom(self, findings, scan_id=1, project_name="Enterprise App"):
        nodes = []
        edges = []

        # Top-level Application Node
        app_node_id = f"app_{scan_id}"
        nodes.append({
            "node_id": app_node_id,
            "type": "Application",
            "name": project_name,
            "version": "1.0.0",
            "role": "Root Application Context",
            "quantum_status": "Mixed",
            "details": "Root application boundary housing scanned cryptographic assets."
        })

        asset_map = {}
        for idx, finding in enumerate(findings, 1):
            category = finding.get("category", "Source Code")
            algo = finding.get("algorithm", "Unknown")
            location = finding.get("location", "")
            asset_name = finding.get("asset_name", os.path.basename(location))
            quantum_risk = finding.get("quantum_risk", "")

            # Determine quantum status label
            if "Critical" in quantum_risk or "High" in quantum_risk:
                q_status = "Quantum Vulnerable"
            elif "Low" in quantum_risk:
                q_status = "Quantum Resistant"
            else:
                q_status = "Classical Weak"

            # Create specific nodes based on category
            if "Source Code" in category:
                func_node_id = f"func_{idx}"
                api_node_id = f"api_{idx}"
                algo_node_id = f"algo_{idx}"

                nodes.append({
                    "node_id": func_node_id,
                    "type": "Function",
                    "name": f"Function in {asset_name}:L{finding.get('line_number', 1)}",
                    "version": "1.0",
                    "role": "Signer" if "RSA" in algo or "SHA" in algo else "Verifier",
                    "quantum_status": q_status,
                    "details": finding.get("evidence", "")
                })

                nodes.append({
                    "node_id": api_node_id,
                    "type": "Crypto API",
                    "name": f"API ({algo})",
                    "version": "Standard",
                    "role": "Crypto Provider",
                    "quantum_status": q_status,
                    "details": f"Location: {location}"
                })

                nodes.append({
                    "node_id": algo_node_id,
                    "type": "Algorithm",
                    "name": algo,
                    "version": f"{finding.get('key_size', '')} bits" if finding.get('key_size') else "Default",
                    "role": "Encapsulation / Hash",
                    "quantum_status": q_status,
                    "details": finding.get("recommendation", "")
                })

                # Edges: App -> Function -> API -> Algo
                edges.append({"source_node": app_node_id, "target_node": func_node_id, "relationship": "CONTAINS"})
                edges.append({"source_node": func_node_id, "target_node": api_node_id, "relationship": "CALLS"})
                edges.append({"source_node": api_node_id, "target_node": algo_node_id, "relationship": "USES_ALGORITHM"})

            elif "Libraries" in category:
                lib_node_id = f"lib_{idx}"
                nodes.append({
                    "node_id": lib_node_id,
                    "type": "Library",
                    "name": asset_name,
                    "version": "Detected",
                    "role": "Crypto Dependency",
                    "quantum_status": q_status,
                    "details": finding.get("evidence", "")
                })
                edges.append({"source_node": app_node_id, "target_node": lib_node_id, "relationship": "DEPENDS_ON"})

            elif "Certificates" in category or "Keys" in category:
                cert_node_id = f"cert_{idx}"
                nodes.append({
                    "node_id": cert_node_id,
                    "type": "Certificate",
                    "name": asset_name,
                    "version": "X.509",
                    "role": "CA / Identity Provider",
                    "quantum_status": q_status,
                    "details": finding.get("evidence", "")
                })
                edges.append({"source_node": app_node_id, "target_node": cert_node_id, "relationship": "CERTIFIES"})

            elif "Protocols" in category:
                proto_node_id = f"proto_{idx}"
                nodes.append({
                    "node_id": proto_node_id,
                    "type": "Protocol",
                    "name": finding.get("protocol", "TLS"),
                    "version": "Configured",
                    "role": "TLS Terminator",
                    "quantum_status": q_status,
                    "details": finding.get("evidence", "")
                })
                edges.append({"source_node": app_node_id, "target_node": proto_node_id, "relationship": "PROTECTS"})

            elif "Cloud" in category or "Hardware" in category:
                srv_node_id = f"srv_{idx}"
                nodes.append({
                    "node_id": srv_node_id,
                    "type": "Service",
                    "name": asset_name,
                    "version": "Cloud / HSM",
                    "role": "KMS Provider",
                    "quantum_status": q_status,
                    "details": finding.get("evidence", "")
                })
                edges.append({"source_node": app_node_id, "target_node": srv_node_id, "relationship": "DELEGATES_TO"})

        return {"nodes": nodes, "edges": edges}

    def export_cyclonedx_json(self, cbom_data, project_name="Enterprise Application"):
        cyclonedx = {
            "$schema": "http://cyclonedx.org/schema/bom-1.5.cdx.json",
            "bomFormat": "CycloneDX",
            "specVersion": "1.5",
            "serialNumber": "urn:uuid:ecdat-cbom-gen-2026",
            "version": 1,
            "metadata": {
                "timestamp": "2026-09-16T15:25:00Z",
                "tools": [
                    {
                        "vendor": "ECDAT",
                        "name": "Enterprise Cryptographic Discovery & Analysis Tool",
                        "version": "1.0.0"
                    }
                ],
                "component": {
                    "type": "application",
                    "name": project_name,
                    "version": "1.0.0"
                }
            },
            "components": [
                {
                    "type": node["type"].lower() if node["type"] in ["Application", "Library", "Service"] else "cryptographic-asset",
                    "name": node["name"],
                    "version": node.get("version", "1.0.0"),
                    "description": node.get("details", ""),
                    "properties": [
                        {"name": "ecdat:role", "value": node.get("role", "Provider")},
                        {"name": "ecdat:quantum_status", "value": node.get("quantum_status", "Unknown")}
                    ]
                }
                for node in cbom_data.get("nodes", [])
            ],
            "dependencies": [
                {
                    "ref": edge["source_node"],
                    "dependsOn": [edge["target_node"]]
                }
                for edge in cbom_data.get("edges", [])
            ]
        }
        return json.dumps(cyclonedx, indent=2)
