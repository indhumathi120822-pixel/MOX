import React, { useState, useEffect } from 'react';
import api, { downloadAuthenticatedFile } from '../api';
import { Network, Download, FileCode, Layers, ShieldAlert, CheckCircle2, ArrowRight, Table, LayoutGrid, BookOpen, RefreshCw } from 'lucide-react';

export default function SemanticCBOM({ currentProject, theme = 'dark' }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [latestScanId, setLatestScanId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) loadCBOM();
  }, [currentProject]);

  const loadCBOM = async () => {
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans.length > 0) {
        const scanId = scansRes.data.scans[0].id;
        setLatestScanId(scanId);
        const cbomRes = await api.get(`/cbom/scan/${scanId}`);
        setNodes(cbomRes.data.cbom.nodes || []);
        setEdges(cbomRes.data.cbom.edges || []);
      }
    } catch (err) {
      console.error('Failed to load CBOM:', err);
    }
  };

  const downloadCycloneDX = () => {
    if (latestScanId) {
      downloadAuthenticatedFile(`/cbom/scan/${latestScanId}/cyclonedx`, `cbom_cyclonedx_scan_${latestScanId}.json`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-6 h-6 text-blue-500" />
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              SIH26164 Standardized Cryptographic Bill of Materials (CBOM)
            </h1>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            SIH26164 Rulebook Section 17 schema: Component, Algorithm, Family, Usage, Key Size, Protocol, Library, Evidence, Risk & NIST References.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadCBOM}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            Generate CBOM
          </button>

          <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              View CBOM Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white shadow'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              View CBOM Nodes
            </button>
          </div>

          <button
            onClick={downloadCycloneDX}
            disabled={!latestScanId}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 shrink-0"
          >
            <Download className="w-4 h-4" />
            Download CBOM (CycloneDX JSON)
          </button>
        </div>
      </div>

      {/* View Mode 1: Section 17 Standard Table View */}
      {viewMode === 'table' ? (
        <div className={`border rounded-xl shadow-xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b font-mono font-bold uppercase tracking-wider text-[11px] ${
                isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <tr>
                  <th className="p-3.5">Component</th>
                  <th className="p-3.5">Algorithm</th>
                  <th className="p-3.5">Family</th>
                  <th className="p-3.5">Usage</th>
                  <th className="p-3.5">Key Size / Mode</th>
                  <th className="p-3.5">Protocol / Library</th>
                  <th className="p-3.5">File & Line</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Quantum Risk</th>
                  <th className="p-3.5">PQC Recommendation</th>
                  <th className="p-3.5">NIST Rule / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {nodes.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      No CBOM components detected yet. Run a scan to populate CycloneDX taxonomy.
                    </td>
                  </tr>
                ) : (
                  nodes.map((node, index) => (
                    <tr key={node.node_id || index} className={`hover:bg-blue-500/5 transition-colors cursor-pointer ${
                      index % 2 === 0 ? (isDark ? 'bg-slate-900' : 'bg-white') : (isDark ? 'bg-slate-950/40' : 'bg-slate-50/50')
                    }`} onClick={() => setSelectedNode(node)}>
                      <td className="p-3.5 font-bold text-blue-400">{node.name}</td>
                      <td className="p-3.5 font-bold">{node.role || 'Cryptographic Asset'}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] uppercase font-bold">
                          {node.type || 'Asset'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">Data Protection</td>
                      <td className="p-3.5 text-slate-400 font-semibold">{node.key_size || '2048-bit / Standard'}</td>
                      <td className="p-3.5 text-slate-300">{node.type === 'Libraries' ? node.name : 'TLS 1.3 / Standard'}</td>
                      <td className="p-3.5 text-slate-400 max-w-[180px] truncate" title={node.details}>
                        {node.details || 'Source file'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          node.quantum_status === 'Quantum Vulnerable' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {node.quantum_status === 'Quantum Vulnerable' ? 'P1 CRITICAL' : 'P3 MEDIUM'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          node.quantum_status === 'Quantum Vulnerable' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {node.quantum_status || 'Vulnerable'}
                        </span>
                      </td>
                      <td className="p-3.5 text-emerald-400 font-semibold text-[11px]">
                        {node.quantum_status === 'Quantum Vulnerable' ? 'Migrate to FIPS 203 ML-KEM' : 'Maintain baseline'}
                      </td>
                      <td className="p-3.5 text-blue-400 font-bold text-[10px]">
                        {node.quantum_status === 'Quantum Vulnerable' ? 'NIST FIPS 203 / 204' : 'NIST SP 800-57 Part 1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode 2: Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.node_id}
              onClick={() => setSelectedNode(node)}
              className={`border rounded-xl p-5 shadow-lg space-y-3 cursor-pointer transition-all hover:border-blue-500 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
                  {node.type}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  node.quantum_status === 'Quantum Vulnerable' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {node.quantum_status || 'Quantum Vulnerable'}
                </span>
              </div>

              <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{node.name}</div>
              <div className="text-xs text-slate-400 font-mono">Role: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{node.role}</strong></div>

              <div className={`text-[11px] font-mono p-2.5 rounded-lg border truncate ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {node.details}
              </div>

              <div className="text-[11px] text-blue-400 font-mono font-semibold flex items-center justify-end gap-1">
                <span>Drill down details</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CBOM Node Detail Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-xl w-full border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
                  {selectedNode.type}
                </span>
                <h3 className="text-base font-bold mt-1">{selectedNode.name}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 bg-slate-800 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className={`p-3 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-slate-400 font-sans font-semibold mb-1">Taxonomy Role:</div>
                <div className="text-blue-400 font-bold">{selectedNode.role}</div>
              </div>

              <div className={`p-3 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-slate-400 font-sans font-semibold mb-1">Details & Evidence:</div>
                <div className="text-slate-200">{selectedNode.details}</div>
              </div>

              <div className={`p-3 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-slate-400 font-sans font-semibold mb-1">Quantum Vulnerability Assessment:</div>
                <div className="text-amber-400 font-bold">{selectedNode.quantum_status || 'Quantum Vulnerable'}</div>
              </div>

              <div className={`p-3 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-slate-400 font-sans font-semibold mb-1">SIH26164 Rulebook Reference:</div>
                <div className="text-blue-400 font-bold">NIST FIPS 203 (ML-KEM) / FIPS 204 (ML-DSA) Baseline</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
