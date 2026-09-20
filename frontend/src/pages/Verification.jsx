import React, { useState, useEffect } from 'react';
import api from '../api';
import { CheckCircle2, ShieldCheck, ArrowDownRight, RefreshCw } from 'lucide-react';

export default function Verification({ currentProject }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (currentProject) loadVerification();
  }, [currentProject]);

  const loadVerification = async () => {
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans.length > 0) {
        const scanId = scansRes.data.scans[0].id;
        const res = await api.get(`/remediation/verify/${scanId}`);
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load verification:', err);
    }
  };

  if (!data) return <div className="p-8 text-center text-slate-400">Loading post-remediation verification data...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Post-Remediation Verification Dashboard</h1>
          <p className="text-xs text-slate-400">
            Empirical runtime re-scan verification comparing pre- vs post-remediation security metrics
          </p>
        </div>

        <button
          onClick={loadVerification}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Re-Run Verification Check
        </button>
      </div>

      {/* Before vs After Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-center">
          <div className="text-xs text-slate-400 uppercase font-semibold">Total Findings Before</div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">{data.total_findings_before}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-center">
          <div className="text-xs text-slate-400 uppercase font-semibold">Remediated & Resolved</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">{data.remediated_findings}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-center">
          <div className="text-xs text-slate-400 uppercase font-semibold">Remaining Findings</div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">{data.remaining_findings}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-center">
          <div className="text-xs text-slate-400 uppercase font-semibold">Risk Delta</div>
          <div className="text-3xl font-extrabold text-blue-400 mt-2 font-mono flex items-center justify-center gap-1">
            <ArrowDownRight className="w-6 h-6 text-emerald-400" />
            {data.risk_score_after}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
        <h3 className="text-base font-bold text-white">Verification Status</h3>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <div>
            <div className="font-bold text-white text-sm">
              Status: <span className="text-emerald-400">{data.verification_status}</span>
            </div>
            <p className="text-xs text-slate-400">
              {data.verification_status === 'COMPLETE'
                ? 'All discovered cryptographic vulnerabilities have been successfully remediated and verified.'
                : 'Partial remediation complete. Additional open findings remain in the scan baseline.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
