import React, { useState, useEffect } from 'react';
import api from '../api';
import { Award, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function CertificatesPKI({ currentProject }) {
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    if (currentProject) {
      api.get(`/scans/project/${currentProject.id}`).then(res => {
        if (res.data.scans.length > 0) {
          const scanId = res.data.scans[0].id;
          api.get(`/scans/${scanId}`).then(scanRes => {
            const list = scanRes.data.findings.filter(f => f.category === 'Certificates / PKI / Keys');
            setCerts(list);
          });
        }
      });
    }
  }, [currentProject]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-1">Certificates, PKI & Key Analysis</h1>
        <p className="text-xs text-slate-400">
          X.509 Certificate Chain, Public Metadata & Redacted Private Key Detection
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">{c.title}</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                c.severity === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {c.severity}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
              <div className="text-slate-500">Location: {c.location}</div>
              <div className="text-blue-400 mt-1 font-bold">{c.evidence}</div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div><strong>Classical Risk:</strong> {c.classical_risk}</div>
              <div><strong>Post-Quantum Target:</strong> FIPS 204 (ML-DSA) Dual-Signature Hybrid X.509</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
