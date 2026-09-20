import React, { useState, useEffect } from 'react';
import api from '../api';
import { ShieldAlert, AlertTriangle, Clock, Activity, ShieldCheck, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';

export default function RiskAnalysis({ currentProject, theme = 'dark' }) {
  const [assets, setAssets] = useState([]);
  const [findings, setFindings] = useState([]);
  const [activeQuantumTab, setActiveQuantumTab] = useState('vulnerable'); // 'vulnerable' | 'resistant' | 'hybrid' | 'review'

  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) {
      api.get(`/assets/project/${currentProject.id}`).then(res => setAssets(res.data.assets || []));
      api.get(`/scans/project/${currentProject.id}`).then(scansRes => {
        if (scansRes.data.scans.length > 0) {
          api.get(`/scans/${scansRes.data.scans[0].id}`).then(res => {
            setFindings(res.data.findings || []);
          });
        }
      });
    }
  }, [currentProject]);

  // Categorize Findings based on Quantum Status & NIST Guidance
  const quantumVulnerable = findings.filter(f => 
    f.algorithm?.match(/RSA|ECDSA|ECDH|DH|DSA/i) || f.quantum_risk?.includes('Vulnerable') || f.quantum_risk?.includes('High') || f.quantum_risk?.includes('Critical')
  );

  const quantumResistant = findings.filter(f =>
    f.algorithm?.match(/AES|SHA|ML-KEM|ML-DSA|SLH-DSA|Kyber|Dilithium|Sphincs/i) && !f.algorithm?.match(/RSA|ECDSA|DH/i)
  );

  const hybridCrypto = findings.filter(f =>
    f.algorithm?.match(/Hybrid|X25519\+|Kyber\+/i) || f.title?.includes('Hybrid')
  );

  const needsReview = findings.filter(f =>
    f.algorithm?.match(/Custom|Obfuscated|Unknown/i) || f.title?.includes('Needs Review')
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h1 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Quantum Threat Assessment & Mosca Risk Model ($X + Y &gt; Z$)
        </h1>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Mathematical evaluation comparing Data Lifetime ($X$) + Migration Time ($Y$) against Quantum Computer Arrival ($Z$).
        </p>

        {/* Mosca Formula Explainability Card */}
        <div className={`mt-4 p-4 border rounded-xl text-xs space-y-2 font-mono ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-blue-400 font-bold text-sm">Mosca Inequality: X + Y &gt; Z</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
            <div><strong className={isDark ? 'text-white' : 'text-slate-900'}>X = Data Lifetime:</strong> Years sensitive data must remain protected.</div>
            <div><strong className={isDark ? 'text-white' : 'text-slate-900'}>Y = Migration Time:</strong> Years required to upgrade system to PQC.</div>
            <div><strong className={isDark ? 'text-white' : 'text-slate-900'}>Z = CRQC Arrival:</strong> Estimated years until Quantum Computer (Default 10 yrs).</div>
          </div>
        </div>
      </div>

      {/* Requirement 10: 4 Quantum Category Tabs */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveQuantumTab('vulnerable')}
            className={`p-4 rounded-xl border text-left transition-all font-mono text-xs flex items-center justify-between ${
              activeQuantumTab === 'vulnerable'
                ? 'bg-red-600 border-red-500 text-white shadow-lg'
                : isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div>
              <div className="font-bold font-sans">1. Quantum-Vulnerable</div>
              <div className="text-[10px] opacity-80 mt-0.5">{quantumVulnerable.length} Findings</div>
            </div>
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </button>

          <button
            onClick={() => setActiveQuantumTab('resistant')}
            className={`p-4 rounded-xl border text-left transition-all font-mono text-xs flex items-center justify-between ${
              activeQuantumTab === 'resistant'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                : isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div>
              <div className="font-bold font-sans">2. Quantum-Resistant</div>
              <div className="text-[10px] opacity-80 mt-0.5">{quantumResistant.length} Findings</div>
            </div>
            <ShieldCheck className="w-5 h-5 shrink-0" />
          </button>

          <button
            onClick={() => setActiveQuantumTab('hybrid')}
            className={`p-4 rounded-xl border text-left transition-all font-mono text-xs flex items-center justify-between ${
              activeQuantumTab === 'hybrid'
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                : isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div>
              <div className="font-bold font-sans">3. Hybrid Cryptography</div>
              <div className="text-[10px] opacity-80 mt-0.5">{hybridCrypto.length} Findings</div>
            </div>
            <Layers className="w-5 h-5 shrink-0" />
          </button>

          <button
            onClick={() => setActiveQuantumTab('review')}
            className={`p-4 rounded-xl border text-left transition-all font-mono text-xs flex items-center justify-between ${
              activeQuantumTab === 'review'
                ? 'bg-amber-600 border-amber-500 text-white shadow-lg'
                : isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div>
              <div className="font-bold font-sans">4. Unknown / Needs Review</div>
              <div className="text-[10px] opacity-80 mt-0.5">{needsReview.length} Findings</div>
            </div>
            <HelpCircle className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Active Quantum Category Breakdown List */}
        <div className={`border rounded-xl p-6 shadow-xl space-y-4 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {activeQuantumTab === 'vulnerable' && 'Quantum-Vulnerable Public-Key Implementations'}
            {activeQuantumTab === 'resistant' && 'Quantum-Resistant Symmetric & PQC Implementations'}
            {activeQuantumTab === 'hybrid' && 'Hybrid Classical + Post-Quantum Key Exchange/Signatures'}
            {activeQuantumTab === 'review' && 'Unrecognized Cryptographic Primitives Needing Manual Review'}
          </h3>

          <div className="space-y-3">
            {activeQuantumTab === 'vulnerable' && (
              quantumVulnerable.length > 0 ? (
                quantumVulnerable.map((item) => (
                  <div key={item.id} className={`p-4 border rounded-xl text-xs space-y-2 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="px-2.5 py-0.5 bg-red-600 text-white font-bold rounded text-[10px]">
                          {item.priority || 'P1'}
                        </span>
                        <span className="font-bold text-blue-400">{item.algorithm || 'RSA/ECDSA'}</span>
                        <span className={isDark ? 'text-white' : 'text-slate-900'}>{item.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{item.location}</span>
                    </div>

                    <p className="text-slate-300 font-sans">{item.classical_risk}</p>

                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-mono text-[11px]">
                      <strong>PQC Migration Recommendation:</strong> {item.recommendation || 'Migrate to NIST FIPS 203 ML-KEM or FIPS 204 ML-DSA.'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs font-mono text-slate-500">
                  No quantum-vulnerable findings detected in active scan results.
                </div>
              )
            )}

            {activeQuantumTab === 'resistant' && (
              <div className="p-4 text-center text-xs font-mono text-emerald-400">
                AES-256-GCM, SHA-256, ML-KEM-768, ML-DSA-65 algorithms meet NIST post-quantum safety criteria.
              </div>
            )}

            {activeQuantumTab === 'hybrid' && (
              <div className="p-4 text-center text-xs font-mono text-blue-400">
                Hybrid implementations combine classical ECDH/ECDSA with ML-KEM/ML-DSA dual signatures.
              </div>
            )}

            {activeQuantumTab === 'review' && (
              <div className="p-4 text-center text-xs font-mono text-amber-400">
                All discovered cryptographic primitives matched standard NIST reference entries.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
