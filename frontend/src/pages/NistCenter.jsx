import React, { useState, useEffect } from 'react';
import api from '../api';
import { BookOpen, ShieldCheck, CheckCircle2, AlertTriangle, HelpCircle, Layers, Cpu, Server, Key, Network, Lock, FileCode, Search, Database } from 'lucide-react';

export default function NistCenter({ theme = 'dark' }) {
  const [rules, setRules] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeTab, setActiveTab] = useState('catalog90'); // 'catalog90' | 'categories7' | 'registry' | 'comparison'
  const [selectedCategory, setSelectedCategory] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');

  const isDark = theme === 'dark';

  useEffect(() => {
    api.get('/nist/rules').then(res => {
      setRules(res.data.rules || []);
      setLastUpdated(res.data.last_updated || new Date().toISOString().split('T')[0]);
    }).catch(() => {});

    api.get('/nist/catalog').then(res => {
      setCatalog(res.data.algorithms || []);
    }).catch(() => {});
  }, []);

  const pipelineCategories = [
    {
      id: 1,
      name: '1. Source Code Pipeline',
      icon: FileCode,
      desc: 'AST Analysis for Java, JS/TS, Python, C/C++, Go, Rust',
      publication: 'NIST SP 800-218 (SSDF) / FIPS 203 & 204',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'RSA-2048 / RSA-4096 Keypair Generation', status: 'Quantum Vulnerable (PQC Migration Required)', ref: 'NIST FIPS 204 Transition' },
        { name: 'ECDSA (secp256r1 / P-256) Signatures', status: 'Quantum Vulnerable', ref: 'NIST FIPS 204' },
        { name: 'ML-KEM-768 (Kyber) Encapsulation', status: 'NIST Approved PQC Standard', ref: 'NIST FIPS 203' },
        { name: 'AES-256-GCM Symmetric Encryption', status: 'Approved (Quantum Resistant)', ref: 'NIST SP 800-38D' }
      ]
    },
    {
      id: 2,
      name: '2. Libraries / Dependencies',
      icon: Layers,
      desc: 'Package Manifests, OpenSSL, BouncyCastle & CVE Correlation',
      publication: 'NIST SP 800-161 (C-SCRM) / NVD CVE Database',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'OpenSSL 1.1.1 Legacy Cryptography', status: 'Deprecated / End-of-Life', ref: 'CVE-2023-0286' },
        { name: 'BouncyCastle PQC Beta Modules', status: 'Migration Evaluation', ref: 'NIST FIPS 203/204' },
        { name: 'CryptoJS / Node Crypto Primitives', status: 'Implementation Review Needed', ref: 'NIST CSF 2.0 PR.DS' }
      ]
    },
    {
      id: 3,
      name: '3. Binaries / Executables',
      icon: Cpu,
      desc: 'Static PE/ELF Header & Export Symbol Table Inspection',
      publication: 'NIST SP 800-115 / Binary Hardening Guidelines',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'Static libcrypto.so Symbol Linkage', status: 'Audit Required', ref: 'NIST SP 800-115' },
        { name: 'Hardcoded Cryptographic Constants', status: 'Disallowed Security Defect', ref: 'NIST SP 800-57 Part 1' },
        { name: 'Embedded RSA/DES Binary Symbols', status: 'Legacy Vulnerable', ref: 'NIST SP 800-131A' }
      ]
    },
    {
      id: 4,
      name: '4. Containers / Images',
      icon: Server,
      desc: 'Dockerfile & Base OS Crypto Package Inspection',
      publication: 'NIST SP 800-190 (Application Container Security)',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'Alpine/Debian OS Base OpenSSL Config', status: 'Compliant Baseline', ref: 'NIST SP 800-190' },
        { name: 'Deprecated Base Image Crypto Libraries', status: 'Vulnerable Baseline', ref: 'NIST SP 800-190 Sec 3.1' }
      ]
    },
    {
      id: 5,
      name: '5. Certificates / PKI / Keys',
      icon: Key,
      desc: 'X.509 Certificate Chain, Key Sizes & Private Key Inspection',
      publication: 'NIST SP 800-57 Part 1 / FIPS 186-5',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'X.509 RSA-2048 Server Certificate', status: 'Quantum Vulnerable (PQC Transition)', ref: 'NIST FIPS 186-5' },
        { name: 'ECDSA P-384 Root CA Certificate', status: 'Quantum Vulnerable (PQC Dual-Sig Needed)', ref: 'NIST SP 800-57' },
        { name: 'ML-DSA-65 Post-Quantum Certificate', status: 'NIST Approved PQC Standard', ref: 'NIST FIPS 204' }
      ]
    },
    {
      id: 6,
      name: '6. Protocols / TLS',
      icon: Network,
      desc: 'NIST SP 800-52 Rev. 2 TLS & Cipher Suite Configuration',
      publication: 'NIST SP 800-52 Rev. 2 (Guidelines for TLS)',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'TLS 1.3 with ECDHE + AES-256-GCM', status: 'Approved (Hybrid PQC Recommended)', ref: 'NIST SP 800-52r2' },
        { name: 'TLS 1.0 / TLS 1.1 Protocols', status: 'Disallowed by NIST', ref: 'NIST SP 800-52r2 Sec 3.1' },
        { name: 'Hybrid X25519 + ML-KEM-768 TLS Handshake', status: 'Post-Quantum Recommended', ref: 'NIST FIPS 203 / IETF Draft' }
      ]
    },
    {
      id: 7,
      name: '7. Cloud / Hardware Modules',
      icon: Lock,
      desc: 'AWS KMS, Azure Key Vault, GCP KMS & PKCS#11 HSM Providers',
      publication: 'NIST SP 800-53 Rev. 5 (SC-12/SC-13 Cryptographic Protection)',
      status: 'ACTIVE STANDARD',
      algorithms: [
        { name: 'Cloud KMS AES-256 Symmetric Key Policy', status: 'Approved Baseline', ref: 'NIST SP 800-53 SC-13' },
        { name: 'PKCS#11 Hardware Security Module (HSM)', status: 'Approved FIPS 140-3 Hardware', ref: 'NIST FIPS 140-3' }
      ]
    }
  ];

  const comparisonCategories = [
    {
      category: '1. Supported / Approved Standards',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      status: 'APPROVED BY NIST',
      icon: CheckCircle2,
      algorithms: [
        { name: 'AES-256-GCM / AES-128-GCM', ref: 'NIST SP 800-38D', note: 'Standard symmetric AEAD algorithm for data at rest and in transit.' },
        { name: 'SHA-256 / SHA-384 / SHA-512', ref: 'NIST FIPS 180-4', note: 'Approved cryptographic hashing standards.' },
        { name: 'ML-KEM-512 / 768 / 1024', ref: 'NIST FIPS 203', note: 'Primary post-quantum key encapsulation standard.' },
        { name: 'ML-DSA-44 / 65 / 87', ref: 'NIST FIPS 204', note: 'Primary post-quantum digital signature standard.' },
        { name: 'SLH-DSA-128f / 128s', ref: 'NIST FIPS 205', note: 'Stateless hash-based post-quantum signature standard.' }
      ]
    },
    {
      category: '2. Deprecated / Legacy / Disallowed',
      color: 'text-red-400 border-red-500/30 bg-red-500/10',
      status: 'DISALLOWED BY NIST',
      icon: AlertTriangle,
      algorithms: [
        { name: 'MD5 Hash Algorithm', ref: 'NIST SP 800-57 Part 1', note: 'Cryptographically broken. Prone to collision attacks.' },
        { name: 'SHA-1 Hash Algorithm', ref: 'NIST SP 800-57 Part 1', note: 'Deprecated for digital signatures since 2011.' },
        { name: 'DES / Triple-DES (3DES)', ref: 'NIST SP 800-131A', note: 'Sweet32 vulnerability; disallowed for encryption.' },
        { name: 'RSA Key Length < 2048-bit', ref: 'NIST SP 800-57 Part 1', note: 'Classically factorable and insecure.' },
        { name: 'TLS 1.0 / TLS 1.1 Protocols', ref: 'NIST SP 800-52 Rev. 2', note: 'Deprecated network protocol versions.' }
      ]
    },
    {
      category: '3. Migration Consideration (Quantum Vulnerable)',
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      status: 'PQC MIGRATION REQUIRED',
      icon: Layers,
      algorithms: [
        { name: 'RSA-2048 / RSA-3072 / RSA-4096', ref: 'NIST FIPS 203/204 Transition', note: 'Classically strong but completely broken by Shor\'s algorithm on CRQC.' },
        { name: 'ECDSA P-256 / P-384 (secp256r1)', ref: 'NIST FIPS 204 Transition', note: 'Quantum vulnerable elliptic curve signature scheme.' },
        { name: 'ECDH / Diffie-Hellman Key Exchange', ref: 'NIST FIPS 203 Transition', note: 'Requires hybrid ML-KEM key exchange implementation.' }
      ]
    }
  ];

  const currentCat = pipelineCategories.find(c => c.id === selectedCategory) || pipelineCategories[0];

  const filteredCatalog = catalog.filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroupFilter === 'ALL' || item.category === selectedGroupFilter;
    return matchesSearch && matchesGroup;
  });

  const uniqueCategories = Array.from(new Set(catalog.map(i => i.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6 text-blue-500" />
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Local Cryptographic Reference Knowledge Base
            </h1>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Machine-Readable 90-Algorithm Cryptographic Knowledge Base (data/crypto_algorithms.json) & NIST Baseline
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full font-mono font-semibold flex items-center gap-1.5">
            <Database className="w-4 h-4" />
            <span>90 REFERENCE ENTRIES</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-full font-mono font-semibold">
            ✓ 100% OFFLINE CACHE
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('catalog90')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'catalog90'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>90-Algorithm Knowledge Base</span>
        </button>

        <button
          onClick={() => setActiveTab('categories7')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'categories7'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          7 Category Pipeline Standard Reference
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'registry'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          NIST Authoritative Publications
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'comparison'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Detected Cryptography vs Reference Comparison
        </button>
      </div>

      {/* TAB 0: 90-Algorithm Knowledge Base View */}
      {activeTab === 'catalog90' && (
        <div className="space-y-6">
          {/* Controls: Search and Filter Bar */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search 90 algorithms, primitive types..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border outline-none ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setSelectedGroupFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  selectedGroupFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'bg-slate-950 text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                All ({catalog.length})
              </button>
              {uniqueCategories.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedGroupFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                    selectedGroupFilter === cat
                      ? 'bg-blue-600 text-white'
                      : isDark ? 'bg-slate-950 text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {cat} ({catalog.filter(i => i.category === cat).length})
                </button>
              ))}
            </div>
          </div>

          {/* 90-Algorithm Catalog Table */}
          <div className={`border rounded-xl overflow-hidden shadow-xl ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-mono uppercase tracking-wider ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Algorithm Name</th>
                    <th className="p-3">Category / Group</th>
                    <th className="p-3">Primitive Type</th>
                    <th className="p-3">Security Status</th>
                    <th className="p-3">Quantum Status</th>
                    <th className="p-3">Recommended Replacement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredCatalog.map((algo, index) => {
                    const statusUpper = (algo.status || '').toUpperCase();
                    const qStatusUpper = (algo.quantum_status || '').toUpperCase();

                    let statusBadge = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
                    if (statusUpper.includes('BROKEN')) statusBadge = 'bg-red-500/10 text-red-400 border-red-500/30';
                    else if (statusUpper.includes('DEPRECATED')) statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                    else if (statusUpper.includes('POST_QUANTUM')) statusBadge = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
                    else if (statusUpper.includes('CURRENT')) statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                    let qBadge = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
                    if (qStatusUpper.includes('POST_QUANTUM')) qBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                    else if (qStatusUpper.includes('RESISTANT')) qBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                    else if (qStatusUpper.includes('VULNERABLE')) qBadge = 'bg-red-500/10 text-red-400 border-red-500/30';

                    return (
                      <tr key={algo.id || index} className={`hover:bg-slate-800/30 transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-800'
                      }`}>
                        <td className="p-3 text-slate-500">{index + 1}</td>
                        <td className="p-3 font-bold text-white">
                          {algo.name}
                          {algo.aliases && algo.aliases.length > 0 && (
                            <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                              Aliases: {algo.aliases.slice(0, 3).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{algo.category}</td>
                        <td className="p-3 text-slate-300">{algo.type}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] rounded border font-bold ${statusBadge}`}>
                            {algo.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] rounded border font-bold ${qBadge}`}>
                            {algo.quantum_status}
                          </span>
                        </td>
                        <td className="p-3 text-emerald-400 text-[11px]">
                          {algo.recommended_replacement ? algo.recommended_replacement.join(', ') : 'None'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: 7 Category Pipeline Standard View */}
      {activeTab === 'categories7' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {pipelineCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                      : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                  <div>
                    <div className="font-bold text-xs leading-snug">{cat.name}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={`border rounded-xl p-6 shadow-xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl text-blue-400">
                  {React.createElement(currentCat.icon, { className: 'w-6 h-6' })}
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentCat.name}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{currentCat.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-full font-mono font-bold">
                  {currentCat.status}
                </span>
                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full font-mono">
                  Ref: {currentCat.publication}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Applicable Standards, Guidelines & Algorithms
              </h3>
              <div className="space-y-2">
                {currentCat.algorithms.map((algo, idx) => (
                  <div key={idx} className={`p-4 border rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <div className={`font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {algo.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">NIST Specification: <span className="text-blue-400">{algo.ref}</span></div>
                    </div>

                    <span className={`px-3 py-1 rounded text-xs font-mono font-semibold border ${
                      algo.status.includes('Vulnerable') || algo.status.includes('Deprecated')
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : algo.status.includes('Approved') || algo.status.includes('Compliant')
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {algo.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NIST Publications */}
      {activeTab === 'registry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className={`border rounded-xl p-5 shadow-lg space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-extrabold uppercase">
                  {rule.category}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{rule.publication} {rule.section}</span>
              </div>

              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{rule.title}</h3>
              <p className="text-xs text-slate-300">{rule.summary}</p>

              <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <strong className="text-emerald-400">Recommended Action:</strong>
                <div>{rule.recommended_action}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Comparison View */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {comparisonCategories.map((group, idx) => {
            const Icon = group.icon;
            return (
              <div key={idx} className={`border rounded-xl p-5 shadow-lg space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {group.category}
                    </h2>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${group.color}`}>
                    {group.status}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.algorithms.map((algo, aIdx) => (
                    <div key={aIdx} className={`p-3 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <div className={`font-bold font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {algo.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{algo.note}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded shrink-0 self-start md:self-auto">
                        Ref: {algo.ref}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
