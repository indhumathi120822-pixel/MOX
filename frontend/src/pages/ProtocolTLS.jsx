import React, { useState, useEffect } from 'react';
import api from '../api';
import { Lock, Shield, Server, CheckCircle2 } from 'lucide-react';

export default function ProtocolTLS({ currentProject }) {
  const [tlsFindings, setTlsFindings] = useState([]);

  useEffect(() => {
    if (currentProject) {
      api.get(`/scans/project/${currentProject.id}`).then(res => {
        if (res.data.scans.length > 0) {
          const scanId = res.data.scans[0].id;
          api.get(`/scans/${scanId}`).then(scanRes => {
            const list = scanRes.data.findings.filter(f => f.category === 'Protocols / Network / TLS');
            setTlsFindings(list);
          });
        }
      });
    }
  }, [currentProject]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">TLS & Network Protocol Analysis</h1>
            <p className="text-xs text-slate-400">
              NIST SP 800-52 Rev. 2 Protocol Selection & Configuration Enforcement
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs rounded-full font-bold">
            NIST SP 800-52r2
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {tlsFindings.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">{t.title}</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">
                CONFIGURED STATE ONLY
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
              <div className="text-slate-500 font-sans">File: {t.location}:{t.line_number || 1}</div>
              <div className="text-amber-400 mt-1">{t.evidence}</div>
            </div>

            <div className="text-xs text-slate-300">
              <strong className="text-slate-400">NIST SP 800-52 Rev. 2 Action:</strong> {t.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
