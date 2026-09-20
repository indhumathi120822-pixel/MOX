import React, { useState, useEffect } from 'react';
import api from '../api';
import { Lightbulb, ArrowRight, BookOpen, Layers } from 'lucide-react';

export default function Recommendations({ currentProject }) {
  const [findings, setFindings] = useState([]);

  useEffect(() => {
    if (currentProject) {
      api.get(`/scans/project/${currentProject.id}`).then(res => {
        if (res.data.scans.length > 0) {
          const scanId = res.data.scans[0].id;
          api.get(`/scans/${scanId}`).then(scanRes => {
            setFindings(scanRes.data.findings || []);
          });
        }
      });
    }
  }, [currentProject]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-1">PQC & Cryptographic Recommendation Engine</h1>
        <p className="text-xs text-slate-400">
          Structured 7-step migration advice referencing finalized NIST PQC standards (FIPS 203 / 204 / 205)
        </p>
      </div>

      <div className="space-y-6">
        {findings.map((f) => (
          <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Lightbulb className="w-6 h-6 text-yellow-400" />
              <div>
                <h3 className="text-lg font-bold text-white">{f.title}</h3>
                <div className="text-xs text-slate-400 font-mono">Location: {f.location}</div>
              </div>
            </div>

            {/* 7-Step Structured Advice Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">1. Current State</div>
                <div className="text-blue-400 font-mono font-bold">{f.algorithm} ({f.key_size || 'Default'} bits)</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">2. Problem & Vulnerability</div>
                <div className="text-red-400">{f.quantum_risk}</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">3. Evidence</div>
                <div className="text-slate-300 font-mono text-[11px] truncate">{f.evidence}</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">4. Applicable NIST Guidance</div>
                <div className="text-emerald-400 font-mono font-bold">{f.nist_reference}</div>
              </div>
            </div>

            {/* Trade-Off Analysis */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
              <div className="text-slate-300 font-bold">5 & 6. PQC Replacement & Trade-Off Analysis</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-400">
                <div><strong className="text-slate-200">Security:</strong> Category 3 PQC</div>
                <div><strong className="text-slate-200">Latency:</strong> &lt; 0.5ms overhead</div>
                <div><strong className="text-slate-200">Key Expansion:</strong> ~1.1 KB PK</div>
                <div><strong className="text-slate-200">Complexity:</strong> Medium (Hybrid mode)</div>
              </div>
            </div>

            <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
              <strong className="text-white">7. Action Plan:</strong> {f.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
