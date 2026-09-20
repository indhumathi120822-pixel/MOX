import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  Shield, ShieldAlert, Cpu, Award, Zap, FileText, CheckCircle2, ArrowRight,
  Layers, Lock, Network, Key, Server, FileCode, Folder, FolderOpen, File,
  X, AlertTriangle, AlertCircle, Info, RefreshCw, Eye, Edit3, Save, Download,
  CornerDownRight, Check, Activity, GitBranch, GitCommit, Code, HelpCircle, Filter
} from 'lucide-react';

// Helpers for Quantum Risk Calculation
function calculateFindingQuantumScore(f) {
  if (!f || !f.algorithm || f.algorithm === 'N/A' || f.algorithm === 'Unknown') {
    return { scoreStr: 'Insufficient evidence', level: 'Insufficient evidence', scoreVal: 0 };
  }
  const algo = (f.algorithm || '').toUpperCase();
  const isAsym = /RSA|ECC|ECDSA|DH|DSA|ECDH|ELGAMAL|ECIES|X25519|X448|ED25519|ED448/i.test(algo);
  const isWeakSym = /DES|3DES|RC4|BLOWFISH|MD5|SHA-1|SHA1/i.test(algo);
  const isPqc = /ML-KEM|ML-DSA|SLH-DSA|KYBER|DILITHIUM|SPHINCS/i.test(algo);
  const isHybrid = /HYBRID|X25519\+MLKEM/i.test(algo);
  const isQuantumSafe = /AES-256|SHA-384|SHA-512|CHACHA20/i.test(algo);

  let score = 50;
  let level = 'Medium';

  if (isAsym) {
    score = 85;
    if (f.key_size && parseInt(f.key_size) < 2048) score = 95;
    level = score >= 85 ? 'Critical' : 'High';
  } else if (isWeakSym) {
    score = 70;
    level = 'High';
  } else if (isHybrid) {
    score = 25;
    level = 'Low';
  } else if (isPqc) {
    score = 0;
    level = 'Safe';
  } else if (isQuantumSafe) {
    score = 15;
    level = 'Low';
  } else if (f.priority === 'P1') {
    score = 90;
    level = 'Critical';
  } else if (f.priority === 'P2') {
    score = 75;
    level = 'High';
  } else if (f.priority === 'P3') {
    score = 50;
    level = 'Medium';
  } else {
    score = 20;
    level = 'Low';
  }

  return { scoreStr: `${score} / 100`, level, scoreVal: score };
}

function calculateOverallQuantumScore(findings) {
  if (!findings || findings.length === 0) {
    return { scoreStr: '0 / 100', level: 'SAFE', scoreVal: 0 };
  }

  const validFindings = findings.map(f => calculateFindingQuantumScore(f)).filter(res => res.scoreStr !== 'Insufficient evidence');

  if (validFindings.length === 0) {
    return { scoreStr: 'Insufficient evidence', level: 'Insufficient evidence', scoreVal: 0 };
  }

  const maxScore = Math.max(...validFindings.map(v => v.scoreVal));
  let overallLevel = 'LOW';
  if (maxScore >= 85) overallLevel = 'CRITICAL';
  else if (maxScore >= 70) overallLevel = 'HIGH';
  else if (maxScore >= 45) overallLevel = 'MEDIUM';
  else if (maxScore > 0) overallLevel = 'LOW';
  else overallLevel = 'SAFE';

  return { scoreStr: `${maxScore} / 100`, level: overallLevel, scoreVal: maxScore };
}

function getMoscaAssessment(f) {
  if (!f || !f.algorithm || f.algorithm === 'N/A' || f.algorithm === 'Unknown') {
    return 'Insufficient evidence for MOSCA assessment';
  }
  const algo = (f.algorithm || '').toUpperCase();
  const isAsym = /RSA|ECC|ECDSA|DH|DSA|ECDH|ELGAMAL|ECIES|X25519|X448|ED25519|ED448/i.test(algo);
  if (isAsym) {
    const dataLifetime = f.data_lifetime || 5;
    const migrationTime = f.migration_time || 2;
    const crqcTime = 10;
    if (dataLifetime + migrationTime > crqcTime) {
      return `Violated (X:${dataLifetime}yr + Y:${migrationTime}yr > Z:${crqcTime}yr — HNDL Exposed)`;
    }
    return `Compliant (X:${dataLifetime}yr + Y:${migrationTime}yr <= Z:${crqcTime}yr — Shor Exposed)`;
  }
  return `Compliant (Symmetric / Quantum Resistant)`;
}

export default function Dashboard({ currentProject, setActiveTab, onOpenCodeEdit, theme = 'dark' }) {
  // Real Scan State
  const [latestScan, setLatestScan] = useState(null);
  const [findings, setFindings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Priority Counts (Strictly from real scan findings)
  const [priorityCounts, setPriorityCounts] = useState({ p1: 0, p2: 0, p3: 0, p4: 0 });

  // Filter State
  const [filterPriority, setFilterPriority] = useState('ALL');

  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) {
      loadDashboardData();
    }
  }, [currentProject]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans && scansRes.data.scans.length > 0) {
        const latest = scansRes.data.scans[0];
        setLatestScan(latest);

        const res = await api.get(`/scans/${latest.id}`);
        const scanFindings = res.data.findings || [];
        const scanAssets = res.data.assets || [];
        setFindings(scanFindings);
        setAssets(scanAssets);

        // Calculate REAL P1-P4 counts from findings
        const p1 = scanFindings.filter(f => (f.priority || 'P3') === 'P1').length;
        const p2 = scanFindings.filter(f => (f.priority || 'P3') === 'P2').length;
        const p3 = scanFindings.filter(f => (f.priority || 'P3') === 'P3').length;
        const p4 = scanFindings.filter(f => (f.priority || 'P3') === 'P4').length;
        setPriorityCounts({ p1, p2, p3, p4 });
      } else {
        setLatestScan(null);
        setFindings([]);
        setAssets([]);
        setPriorityCounts({ p1: 0, p2: 0, p3: 0, p4: 0 });
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCodeEdit = (finding, prioFilter) => {
    if (onOpenCodeEdit) {
      onOpenCodeEdit(finding, prioFilter);
    } else if (setActiveTab) {
      setActiveTab('code_edit');
    }
  };

  const quantumVulnFindings = findings.filter(f =>
    (f.quantum_risk && (f.quantum_risk.toLowerCase().includes('vulnerable') || f.quantum_risk.toLowerCase().includes('high'))) ||
    (f.algorithm && (f.algorithm.includes('RSA') || f.algorithm.includes('ECC') || f.algorithm.includes('ECDSA') || f.algorithm.includes('DH')))
  );
  const overallQuantum = calculateOverallQuantumScore(findings);

  // Filtered Findings
  const filteredFindings = filterPriority === 'ALL'
    ? findings
    : findings.filter(f => (f.priority || 'P3') === filterPriority);

  // SVG Donut Gauge Parameters for Quantum Risk Graph
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallQuantum.scoreVal / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className={`border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
      }`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className={`text-2xl font-extrabold tracking-wide ${isDark ? 'text-[#E6EBF5]' : 'text-[#0F172A]'}`}>
              MOX Discovery Dashboard
            </h1>
            <span className="px-2.5 py-0.5 bg-[#4CB782]/10 border border-[#4CB782]/30 text-[#4CB782] text-xs rounded-full font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4CB782] animate-pulse"></span>
              REAL SCAN ENGINE
            </span>
          </div>
          <p className={`text-xs ${isDark ? 'text-[#93A0B8]' : 'text-[#5A6A85]'}`}>
            Project: <span className="font-bold text-[#2BB6A3]">{currentProject?.name || 'Default Project'}</span>
            {latestScan && (
              <span className="ml-2 font-mono text-[11px] text-[#93A0B8]">
                (Source Type: <span className="text-[#F59E0B]">{latestScan.scan_type || 'local_project'}</span>)
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => setActiveTab('scan')}
          className="bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow flex items-center gap-2 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Launch Discovery Scan
        </button>
      </div>

      {/* ==================================================
          3. DASHBOARD TOP — TOTAL FINDINGS & 4 PRIORITY CARDS
         ================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* TOTAL CRYPTOGRAPHIC FINDINGS CARD */}
        <div className={`p-5 border rounded-xl shadow-sm ${
          isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-[#93A0B8]">
            <span>TOTAL FINDINGS</span>
            <Shield className="w-4 h-4 text-[#2BB6A3]" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#E6EBF5]">
            {findings.length}
          </div>
          <div className="text-[11px] text-[#93A0B8] mt-1.5 font-mono">
            {findings.length === 0 ? 'Not detected' : 'Discovered Findings'}
          </div>
        </div>

        {/* P1 CARD — Critical */}
        <div
          onClick={() => handleOpenCodeEdit(null, 'P1')}
          className={`p-5 border rounded-xl shadow-sm cursor-pointer transition-all ${
            filterPriority === 'P1'
              ? 'border-[#F0504A] bg-[#F0504A]/10'
              : isDark ? 'bg-[#111A2B] border-[#22304A] hover:border-[#F0504A]/50' : 'bg-white border-[#D0D9E5]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-[#F0504A]">
            <span>P1 — CRITICAL</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#F0504A]">
            {priorityCounts.p1}
          </div>
          <div className="w-full bg-[#16223A] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#F0504A] h-full rounded-full transition-all"
              style={{ width: `${findings.length > 0 ? (priorityCounts.p1 / findings.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* P2 CARD — High */}
        <div
          onClick={() => handleOpenCodeEdit(null, 'P2')}
          className={`p-5 border rounded-xl shadow-sm cursor-pointer transition-all ${
            filterPriority === 'P2'
              ? 'border-[#F59E0B] bg-[#F59E0B]/10'
              : isDark ? 'bg-[#111A2B] border-[#22304A] hover:border-[#F59E0B]/50' : 'bg-white border-[#D0D9E5]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-[#F59E0B]">
            <span>P2 — HIGH</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#F59E0B]">
            {priorityCounts.p2}
          </div>
          <div className="w-full bg-[#16223A] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#F59E0B] h-full rounded-full transition-all"
              style={{ width: `${findings.length > 0 ? (priorityCounts.p2 / findings.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* P3 CARD — Medium */}
        <div
          onClick={() => handleOpenCodeEdit(null, 'P3')}
          className={`p-5 border rounded-xl shadow-sm cursor-pointer transition-all ${
            filterPriority === 'P3'
              ? 'border-[#E0C14B] bg-[#E0C14B]/10'
              : isDark ? 'bg-[#111A2B] border-[#22304A] hover:border-[#E0C14B]/50' : 'bg-white border-[#D0D9E5]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-[#E0C14B]">
            <span>P3 — MEDIUM</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#E0C14B]">
            {priorityCounts.p3}
          </div>
          <div className="w-full bg-[#16223A] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#E0C14B] h-full rounded-full transition-all"
              style={{ width: `${findings.length > 0 ? (priorityCounts.p3 / findings.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* P4 CARD — Low */}
        <div
          onClick={() => handleOpenCodeEdit(null, 'P4')}
          className={`p-5 border rounded-xl shadow-sm cursor-pointer transition-all ${
            filterPriority === 'P4'
              ? 'border-[#4CB782] bg-[#4CB782]/10'
              : isDark ? 'bg-[#111A2B] border-[#22304A] hover:border-[#4CB782]/50' : 'bg-white border-[#D0D9E5]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-[#4CB782]">
            <span>P4 — LOW</span>
            <Info className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#4CB782]">
            {priorityCounts.p4}
          </div>
          <div className="w-full bg-[#16223A] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#4CB782] h-full rounded-full transition-all"
              style={{ width: `${findings.length > 0 ? (priorityCounts.p4 / findings.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ==================================================
          4 & 5. QUANTUM RISK — GRAPH ONLY (DONUT GAUGE)
         ================================================== */}
      <div className={`border rounded-xl p-6 shadow-sm ${
        isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
      }`}>
        <div className="flex items-center gap-2 border-b border-[#22304A] pb-3 mb-5">
          <Cpu className="w-5 h-5 text-[#F59E0B]" />
          <h2 className={`text-base font-bold ${isDark ? 'text-[#E6EBF5]' : 'text-[#0F172A]'}`}>
            Quantum Risk Graphic & Evidence Rationale
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* SVG Donut / Gauge Graphic */}
          <div className="flex flex-col items-center justify-center p-4 bg-[#0B1220] border border-[#22304A] rounded-xl relative">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-[#16223A]"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className={
                    overallQuantum.level === 'CRITICAL' ? 'text-[#F0504A]' :
                    overallQuantum.level === 'HIGH' ? 'text-[#F59E0B]' :
                    overallQuantum.level === 'MEDIUM' ? 'text-[#E0C14B]' : 'text-[#4CB782]'
                  }
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-2xl font-black font-mono text-[#E6EBF5]">{overallQuantum.scoreVal}</div>
                <div className="text-[10px] font-mono text-[#93A0B8] uppercase">/ 100</div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <div className="text-[10px] text-[#93A0B8] font-mono uppercase tracking-wider">QUANTUM RISK</div>
              <div className={`text-sm font-extrabold font-mono uppercase ${
                overallQuantum.level === 'CRITICAL' ? 'text-[#F0504A]' :
                overallQuantum.level === 'HIGH' ? 'text-[#F59E0B]' :
                overallQuantum.level === 'MEDIUM' ? 'text-[#E0C14B]' : 'text-[#4CB782]'
              }`}>
                {overallQuantum.level} RISK
              </div>
            </div>
          </div>

          {/* Why this score? */}
          <div className="p-4 bg-[#0B1220] border border-[#22304A] rounded-xl space-y-2 text-xs">
            <div className="font-bold text-[#F59E0B] uppercase text-[11px] flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              Why this score?
            </div>
            {quantumVulnFindings.length > 0 ? (
              <ul className="space-y-2 text-[#E6EBF5] list-disc list-inside leading-relaxed">
                <li>Detected {quantumVulnFindings.length} asymmetric primitives (RSA / ECC / ECDSA) vulnerable to Shor's algorithm polynomial time decryption.</li>
                <li>Mosca Theorem X + Y &gt; Z condition evaluates Harvest Now Decrypt Later (HNDL) exposure for stored ciphertext payloads.</li>
              </ul>
            ) : (
              <ul className="space-y-2 text-[#E6EBF5] list-disc list-inside leading-relaxed">
                <li>No asymmetric quantum vulnerabilities detected in current workspace scan.</li>
                <li>All discovered cryptographic algorithms comply with classical and PQC baselines.</li>
              </ul>
            )}
          </div>

          {/* Remediation */}
          <div className="p-4 bg-[#4CB782]/10 border border-[#4CB782]/30 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-[#4CB782] uppercase text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Remediation Action
            </div>
            <ul className="space-y-2 text-[#4CB782] list-disc list-inside leading-relaxed">
              <li>Migrate asymmetric key exchange to NIST FIPS 203 (ML-KEM) and signatures to FIPS 204 (ML-DSA).</li>
              <li>Re-scan project workspace after code updates to verify primitive removal.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ==================================================
          SECURITY FINDINGS EVIDENCE TABLE
         ================================================== */}
      <div className={`border rounded-xl shadow-sm overflow-hidden ${
        isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
      }`}>
        <div className="p-5 border-b border-[#22304A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-[#E6EBF5]' : 'text-[#0F172A]'}`}>
              Security Findings Evidence Table
            </h2>
            <p className="text-xs text-[#93A0B8] mt-0.5">
              Mapped directly from real scan output. Click [Code Edit] to open complete file.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#0B1220] p-1 rounded-xl border border-[#22304A] text-xs">
            {['ALL', 'P1', 'P2', 'P3', 'P4'].map((prio) => (
              <button
                key={prio}
                onClick={() => setFilterPriority(prio)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterPriority === prio
                    ? prio === 'P1' ? 'bg-[#F0504A] text-white' :
                      prio === 'P2' ? 'bg-[#F59E0B] text-white' :
                      prio === 'P3' ? 'bg-[#E0C14B] text-slate-950' :
                      'bg-[#4CB782] text-white'
                    : 'text-[#93A0B8] hover:text-[#E6EBF5]'
                }`}
              >
                {prio}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-mono uppercase tracking-wider text-[11px] ${
              isDark ? 'bg-[#0B1220] border-[#22304A] text-[#93A0B8]' : 'bg-[#F4F6F9] border-[#D0D9E5] text-[#5A6A85]'
            }`}>
              <tr>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Algorithm</th>
                <th className="p-3.5">Line</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22304A]/60">
              {filteredFindings.length > 0 ? (
                filteredFindings.map((finding) => {
                  const prio = finding.priority || 'P3';

                  return (
                    <tr
                      key={finding.id}
                      onClick={() => handleOpenCodeEdit(finding)}
                      className={`hover:bg-[#16223A] cursor-pointer transition-colors ${
                        isDark ? 'text-[#E6EBF5]' : 'text-[#0F172A]'
                      }`}
                    >
                      {/* Priority */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase font-mono tracking-wide ${
                          prio === 'P1' ? 'bg-[#F0504A] text-white' :
                          prio === 'P2' ? 'bg-[#F59E0B] text-white' :
                          prio === 'P3' ? 'bg-[#E0C14B] text-slate-950' :
                          'bg-[#4CB782] text-white'
                        }`}>
                          {prio} {prio === 'P1' ? 'CRITICAL' : prio === 'P2' ? 'HIGH' : prio === 'P3' ? 'MEDIUM' : 'LOW'}
                        </span>
                      </td>

                      {/* Algorithm */}
                      <td className="p-3.5 whitespace-nowrap font-mono font-bold text-[#2BB6A3]">
                        {finding.algorithm || 'Not detected'}
                      </td>

                      {/* Line */}
                      <td className="p-3.5 whitespace-nowrap font-mono font-bold text-[#F59E0B]">
                        Line {finding.line_number || 1}
                      </td>

                      {/* Code Edit Button */}
                      <td className="p-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCodeEdit(finding);
                          }}
                          className="px-3.5 py-1.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Code Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-[#93A0B8]">
                    <CheckCircle2 className="w-10 h-10 text-[#4CB782] mx-auto mb-2" />
                    <span>No findings detected for current project. Run a Discovery Scan to inspect.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
