import React, { useState, useEffect } from 'react';
import api, { downloadAuthenticatedFile } from '../api';
import { FileText, Download, Code, CheckCircle2, History, Eye, ShieldAlert, Play, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function Reports({ currentProject, theme = 'dark' }) {
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [scanFindings, setScanFindings] = useState([]);
  const [isRescanning, setIsRescanning] = useState(false);
  const [deleteScanId, setDeleteScanId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDark = theme === 'dark';
  const deploymentMode = localStorage.getItem('mbox_deployment_mode') || 'local';

  useEffect(() => {
    if (currentProject) {
      loadHistory();
    }
  }, [currentProject]);

  const loadHistory = async () => {
    try {
      const res = await api.get(`/scans/project/${currentProject.id}`);
      const scanList = res.data.scans || [];
      setScans(scanList);
      if (scanList.length > 0) {
        inspectHistoricalScan(scanList[0]);
      } else {
        setSelectedScan(null);
        setScanFindings([]);
      }
    } catch (err) {
      console.error('Failed to load scan history:', err);
    }
  };

  const inspectHistoricalScan = async (scanItem) => {
    setSelectedScan(scanItem);
    try {
      const res = await api.get(`/scans/${scanItem.id}`);
      setScanFindings(res.data.findings || []);
    } catch (err) {
      console.error('Failed to inspect historical scan:', err);
    }
  };

  const handleRescan = async (scanItem) => {
    if (!scanItem) return;
    setIsRescanning(true);

    try {
      await api.post('/scans/start', {
        project_id: currentProject.id,
        target_path: scanItem.target_path || 'sample_targets',
        source_type: scanItem.scan_type || 'Local',
        name: scanItem.name || 'Rescanned Project'
      });
      await loadHistory();
    } catch (err) {
      console.error('Rescan failed:', err);
    } finally {
      setIsRescanning(false);
    }
  };

  const handleDeleteScan = async () => {
    if (!deleteScanId) return;
    setIsDeleting(true);

    try {
      await api.delete(`/scans/${deleteScanId}`);
      setDeleteScanId(null);
      await loadHistory();
    } catch (err) {
      console.error('Delete scan failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadJson = (scanId) => {
    if (scanId) downloadAuthenticatedFile(`/reports/scan/${scanId}/json`, `scan_report_${scanId}.json`);
  };

  const openHtml = (scanId) => {
    if (scanId) downloadAuthenticatedFile(`/reports/scan/${scanId}/html`, `scan_report_${scanId}.html`);
  };

  const downloadZip = (scanId) => {
    if (scanId) downloadAuthenticatedFile(`/scans/${scanId}/download-zip`, `project_${scanId}_updated.zip`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-6 h-6 text-blue-500" />
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Cryptographic Scan History & Report Center
            </h1>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Inspect historical scans, generate executive HTML reports, re-scan project sources, and export CycloneDX CBOM / JSON files.
          </p>
        </div>

        {selectedScan && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRescan(selectedScan)}
              disabled={isRescanning}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
              {isRescanning ? 'Rescanning...' : 'Rescan Source'}
            </button>
            <button
              onClick={() => openHtml(selectedScan.id)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <FileText className="w-4 h-4" />
              Open HTML Report
            </button>
            <button
              onClick={() => downloadJson(selectedScan.id)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <Download className="w-4 h-4" />
              Download JSON Report
            </button>
          </div>
        )}
      </div>

      {/* Requirement 32 & 33: Historical Scans Table */}
      <div className={`border rounded-xl p-6 shadow-xl space-y-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <History className="w-4 h-4 text-blue-400" />
            Scan History Timeline ({scans.length} Scans Recorded)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase tracking-wider font-semibold border-b ${
              isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <tr>
                <th className="px-4 py-3">Scan ID / Date</th>
                <th className="px-4 py-3">Source Type</th>
                <th className="px-4 py-3">Execution Mode</th>
                <th className="px-4 py-3">Scan Status</th>
                <th className="px-4 py-3">Total Findings</th>
                <th className="px-4 py-3">Risk Score</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${
              isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'
            }`}>
              {scans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No historical scans recorded yet. Perform a scan to view history logs.
                  </td>
                </tr>
              ) : (
                scans.map((scan) => {
                  const isSelected = selectedScan && selectedScan.id === scan.id;
                  const sourceType = scan.scan_type || 'Local';
                  return (
                    <tr
                      key={scan.id}
                      onClick={() => inspectHistoricalScan(scan)}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? isDark ? 'bg-blue-600/20 text-white font-bold' : 'bg-blue-50 text-slate-900 font-bold'
                          : isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-sans font-bold">
                        #{scan.id} • {new Date(scan.started_at || Date.now()).toLocaleDateString()} {new Date(scan.started_at || Date.now()).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sourceType.includes('GitHub') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          sourceType.includes('ZIP') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {sourceType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold uppercase">
                          {deploymentMode === 'local' ? 'LOCAL • OFFLINE' : 'CLOUD • ONLINE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold">
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded font-bold">
                          {scan.total_findings || 0} Findings
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-red-400">
                        {scan.risk_score || 0}/10
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              inspectHistoricalScan(scan);
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-sans font-semibold flex items-center gap-1 shadow"
                          >
                            <Eye className="w-3 h-3" /> Inspect
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRescan(scan);
                            }}
                            className="px-2 py-1 bg-slate-800 text-cyan-400 hover:bg-slate-700 rounded text-[11px] font-sans font-semibold flex items-center gap-1 border border-slate-700"
                            title="Rescan project source"
                          >
                            <RefreshCw className="w-3 h-3" /> Rescan
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadZip(scan.id);
                            }}
                            className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[11px] font-sans font-semibold flex items-center gap-1 hover:bg-slate-700"
                            title="Download ZIP archive"
                          >
                            <Download className="w-3 h-3" /> ZIP
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteScanId(scan.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete scan result from history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Historical Scan Details View */}
      {selectedScan && (
        <div className={`border rounded-xl p-6 shadow-xl space-y-4 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Inspecting Historical Scan #{selectedScan.id} Summary
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Target Path: {selectedScan.target_path || 'sample_targets'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className={`p-4 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-slate-400 font-semibold mb-1">Total Findings Discovered</div>
              <div className="text-xl font-bold text-amber-400">{scanFindings.length} Items</div>
            </div>

            <div className={`p-4 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-slate-400 font-semibold mb-1">NIST Cryptographic Risk Score</div>
              <div className="text-xl font-bold text-red-400">{selectedScan.risk_score}/10</div>
            </div>

            <div className={`p-4 border rounded-xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-slate-400 font-semibold mb-1">Export Capabilities</div>
              <div className="text-xs text-emerald-400 font-bold">HTML, JSON & CycloneDX CBOM Ready</div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Requirement 31) */}
      {deleteScanId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">Delete this scan result?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This action will permanently delete scan record #{deleteScanId} and its associated findings from history. Your original source project files will NOT be affected.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeleteScanId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteScan}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete Scan Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
