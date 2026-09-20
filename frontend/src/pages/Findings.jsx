import React, { useState, useEffect, useRef } from 'react';
import api, { downloadAuthenticatedFile } from '../api';
import { ShieldAlert, BookOpen, Wrench, Edit3, Save, X, FileCode, CheckCircle2, AlertTriangle, AlertCircle, Info, Download, Trash2, ArrowRight, CornerDownRight } from 'lucide-react';

export default function Findings({ currentProject, setActiveTab, onSelectRemediation, theme = 'dark' }) {
  const [findings, setFindings] = useState([]);
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Local Code Editor Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [fullFileContent, setFullFileContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);

  const targetLineRef = useRef(null);
  const editorRef = useRef(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) loadFindings();
  }, [currentProject]);

  const loadFindings = async () => {
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans.length > 0) {
        const latest = scansRes.data.scans[0];
        const res = await api.get(`/scans/${latest.id}`);
        setFindings(res.data.findings || []);
      }
    } catch (err) {
      console.error('Failed to load findings:', err);
    }
  };

  const p1Findings = findings.filter(f => (f.priority || 'P3') === 'P1');
  const p2Findings = findings.filter(f => (f.priority || 'P3') === 'P2');
  const p3Findings = findings.filter(f => (f.priority || 'P3') === 'P3');
  const p4Findings = findings.filter(f => (f.priority || 'P3') === 'P4');

  const handleOpenDetailModal = async (finding) => {
    setSelectedFinding(finding);
    setIsEditing(false);
    setEditSuccess('');
    setEditError('');
    setShowTrashConfirm(false);
    setLoadingFile(true);

    try {
      const res = await api.post('/scans/file-content', { file_path: finding.location });
      setFullFileContent(res.data.content || finding.evidence || '');
      setEditContent(res.data.content || finding.evidence || '');
    } catch (err) {
      setFullFileContent(finding.evidence || '');
      setEditContent(finding.evidence || '');
    } finally {
      setLoadingFile(false);
    }
  };

  // Jump / Scroll directly to target line after loading file
  useEffect(() => {
    if (selectedFinding && targetLineRef.current) {
      setTimeout(() => {
        targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [selectedFinding, fullFileContent, isEditing]);

  const handleSaveFileLocally = async () => {
    if (!selectedFinding) return;
    setSavingFile(true);
    setEditError('');
    setEditSuccess('');

    try {
      const res = await api.post('/scans/edit-file', {
        file_path: selectedFinding.location,
        new_content: editContent,
        scan_id: selectedFinding.scan_id
      });

      setEditSuccess(`File updated locally! Backup created at ${res.data.backup_path}`);
      setFullFileContent(editContent);
      setIsEditing(false);
      loadFindings();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save local file changes.');
    } finally {
      setSavingFile(false);
    }
  };

  const handleDownloadSingleFile = async () => {
    if (!selectedFinding) return;
    try {
      const response = await api.post('/scans/download-file', { file_path: selectedFinding.location }, { responseType: 'blob' });
      const fileName = selectedFinding.asset_name || selectedFinding.location.split(/[/\\]/).pop() || 'modified_source_file.txt';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setEditError('Unable to download file.');
    }
  };

  const handleDeleteFileGarbageBox = async () => {
    if (!selectedFinding) return;
    try {
      await api.post('/scans/delete-local-file', {
        file_path: selectedFinding.location,
        scan_id: selectedFinding.scan_id
      });
      setSelectedFinding(null);
      loadFindings();
    } catch (err) {
      setEditError('Failed to move file to Garbage Box.');
    }
  };

  const renderFindingCard = (finding) => {
    const prio = finding.priority || 'P3';
    return (
      <div
        key={finding.id}
        className={`border rounded-xl p-5 shadow-lg space-y-3 transition-all cursor-pointer hover:border-blue-500/50 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
        onClick={() => handleOpenDetailModal(finding)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                prio === 'P1' ? 'bg-red-600 text-white shadow-sm' :
                prio === 'P2' ? 'bg-amber-600 text-white shadow-sm' :
                prio === 'P3' ? 'bg-blue-600 text-white shadow-sm' :
                'bg-slate-700 text-white'
              }`}>
                {prio} PRIORITY
              </span>

              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                finding.severity === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                finding.severity === 'High' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}>
                {finding.severity} Severity
              </span>

              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{finding.title}</h3>
            </div>

            <div className="text-xs text-slate-400 mt-1.5 font-mono">
              Location: <span className="text-blue-400 font-semibold">{finding.location}</span> : Line {finding.line_number || 1}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetailModal(finding);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
            >
              <FileCode className="w-3.5 h-3.5" />
              Inspect & Edit File
            </button>
          </div>
        </div>

        {/* Code Evidence Snippet */}
        <div className={`border rounded-lg p-3 font-mono text-xs overflow-x-auto ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <span className="text-slate-500 select-none">Line {finding.line_number || 1}: </span>
          <span>{finding.evidence}</span>
        </div>

        {/* Metadata Badges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className={`p-2.5 border rounded-lg ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              NIST Reference Standard
            </div>
            <div className="font-mono text-[11px] font-bold text-blue-400">{finding.nist_reference}</div>
          </div>

          <div className={`p-2.5 border rounded-lg ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-slate-400 font-semibold mb-1">Classical Technical Severity</div>
            <div className="text-[11px] font-medium">{finding.classical_risk}</div>
          </div>

          <div className={`p-2.5 border rounded-lg ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-slate-400 font-semibold mb-1">Quantum Risk ($X+Y&gt;Z$)</div>
            <div className="text-[11px] font-medium text-amber-400">{finding.quantum_risk}</div>
          </div>
        </div>
      </div>
    );
  };

  const fileLines = (isEditing ? editContent : fullFileContent).split('\n');
  const targetLineNum = selectedFinding?.line_number || 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Cryptographic Vulnerabilities & P1-P4 Risk Prioritization
          </h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Prioritized local risk analysis combining technical severity, business criticality, and PQC exposure.
          </p>
        </div>

        {/* Priority Filter Tabs */}
        <div className={`flex items-center gap-1 p-1 rounded-xl text-xs border ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {['ALL', 'P1', 'P2', 'P3', 'P4'].map((prio) => (
            <button
              key={prio}
              onClick={() => setFilterPriority(prio)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterPriority === prio
                  ? prio === 'P1'
                    ? 'bg-red-600 text-white shadow'
                    : prio === 'P2'
                      ? 'bg-amber-600 text-white shadow'
                      : prio === 'P3'
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-700 text-white shadow'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {prio === 'ALL' ? 'All Priorities' : prio}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Distinct Priority Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterPriority('P1')}
          className={`p-4 border rounded-xl shadow-lg cursor-pointer transition-all ${
            filterPriority === 'P1' ? 'border-red-500 bg-red-500/10' : isDark ? 'bg-slate-900 border-slate-800 hover:border-red-500/40' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-red-400">
            <span>P1 — CRITICAL PRIORITY</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-mono mt-2 text-white">{p1Findings.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Quantum-vulnerable public key / Broken ciphers</div>
        </div>

        <div
          onClick={() => setFilterPriority('P2')}
          className={`p-4 border rounded-xl shadow-lg cursor-pointer transition-all ${
            filterPriority === 'P2' ? 'border-amber-500 bg-amber-500/10' : isDark ? 'bg-slate-900 border-slate-800 hover:border-amber-500/40' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-400">
            <span>P2 — HIGH PRIORITY</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-mono mt-2 text-white">{p2Findings.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Deprecated hashes (SHA-1/MD5) & TLS 1.0/1.1</div>
        </div>

        <div
          onClick={() => setFilterPriority('P3')}
          className={`p-4 border rounded-xl shadow-lg cursor-pointer transition-all ${
            filterPriority === 'P3' ? 'border-blue-500 bg-blue-500/10' : isDark ? 'bg-slate-900 border-slate-800 hover:border-blue-500/40' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-blue-400">
            <span>P3 — MEDIUM PRIORITY</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-mono mt-2 text-white">{p3Findings.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Medium severity configs & outdated baselines</div>
        </div>

        <div
          onClick={() => setFilterPriority('P4')}
          className={`p-4 border rounded-xl shadow-lg cursor-pointer transition-all ${
            filterPriority === 'P4' ? 'border-slate-500 bg-slate-800/40' : isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>P4 — LOW PRIORITY</span>
            <Info className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-mono mt-2 text-white">{p4Findings.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Low exposure dependencies & crypto libraries</div>
        </div>
      </div>

      {/* Findings List Sections */}
      <div className="space-y-6">
        {findings.length === 0 ? (
          <div className={`p-8 rounded-xl border text-center font-mono text-xs ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            No scan findings recorded yet. Launch a scan on a GitHub repo, ZIP, or Local Project.
          </div>
        ) : (
          <>
            {(filterPriority === 'ALL' || filterPriority === 'P1') && p1Findings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>P1 — Critical / Highest Priority Findings ({p1Findings.length})</span>
                </div>
                {p1Findings.map(renderFindingCard)}
              </div>
            )}

            {(filterPriority === 'ALL' || filterPriority === 'P2') && p2Findings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>P2 — High Priority Findings ({p2Findings.length})</span>
                </div>
                {p2Findings.map(renderFindingCard)}
              </div>
            )}

            {(filterPriority === 'ALL' || filterPriority === 'P3') && p3Findings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>P3 — Medium Priority Findings ({p3Findings.length})</span>
                </div>
                {p3Findings.map(renderFindingCard)}
              </div>
            )}

            {(filterPriority === 'ALL' || filterPriority === 'P4') && p4Findings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Info className="w-4 h-4" />
                  <span>P4 — Low Priority / Informational Findings ({p4Findings.length})</span>
                </div>
                {p4Findings.map(renderFindingCard)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detailed Full-File Code Editor Modal with Line Jumping & Download & Garbage Box */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-5xl border rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                    selectedFinding.priority === 'P1' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {selectedFinding.priority || 'P3'} PRIORITY
                  </span>
                  <h2 className="text-lg font-bold">{selectedFinding.title}</h2>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                  <span>Target File: <strong className="text-blue-400">{selectedFinding.location}</strong></span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">Line {targetLineNum}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSingleFile}
                  title="Download this modified file directly"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>

                <button
                  onClick={() => setShowTrashConfirm(true)}
                  title="Move local file to Garbage Box"
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Garbage Box
                </button>

                <button
                  onClick={() => setSelectedFinding(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Trash Confirmation Modal Banner */}
            {showTrashConfirm && (
              <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl space-y-3 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Garbage Box Confirmation: Delete file '{selectedFinding.asset_name || 'source file'}' locally?</span>
                </div>
                <p className="text-xs text-slate-300">
                  This will remove the file from your local workspace filesystem and move it to the `.trash_mbox` Garbage Box directory.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteFileGarbageBox}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow"
                  >
                    Confirm & Delete File (Garbage Box)
                  </button>
                  <button
                    onClick={() => setShowTrashConfirm(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {editSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            {editError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Technical Risk Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs shrink-0">
              <div className={`p-3 border rounded-xl space-y-1 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="font-bold text-blue-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                  Why is {selectedFinding.algorithm} wrong / vulnerable?
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{selectedFinding.classical_risk}</p>
              </div>

              <div className={`p-3 border rounded-xl space-y-1 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Recommended Fix / Replacement
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{selectedFinding.recommendation}</p>
              </div>
            </div>

            {/* Interactive Full-File Editor with Automatic Line Jumping & Highlight Marker */}
            <div className="flex-1 min-h-[300px] flex flex-col space-y-2 overflow-hidden">
              <div className="flex items-center justify-between shrink-0">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span>Full File Inspector (Line {targetLineNum} Jump Active)</span>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Full File Code
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="flex-1 flex flex-col space-y-2 overflow-hidden">
                  <div className="text-[11px] text-amber-400 font-mono shrink-0">
                    ✏️ Editing mode active. Confirming changes will save directly to local disk and create a `.bak` backup.
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={`flex-1 w-full p-4 border rounded-xl font-mono text-xs focus:outline-none focus:border-blue-500 resize-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-300 text-emerald-400'
                    }`}
                  />
                </div>
              ) : (
                <div
                  ref={editorRef}
                  className={`flex-1 border rounded-xl font-mono text-xs overflow-y-auto p-3 space-y-0.5 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-900 border-slate-300 text-slate-200'
                  }`}
                >
                  {loadingFile ? (
                    <div className="p-8 text-center text-slate-500">Loading full file contents...</div>
                  ) : (
                    fileLines.map((lineText, idx) => {
                      const currentLineNum = idx + 1;
                      const isTargetLine = currentLineNum === targetLineNum || (selectedFinding.line_numbers && selectedFinding.line_numbers.includes(currentLineNum));

                      return (
                        <div
                          key={idx}
                          ref={isTargetLine ? targetLineRef : null}
                          className={`flex items-start px-2 py-1 rounded transition-colors ${
                            isTargetLine
                              ? 'bg-red-500/20 border-l-4 border-red-500 text-white font-bold my-1'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <span className={`w-12 shrink-0 select-none text-[11px] ${
                            isTargetLine ? 'text-red-400 font-bold' : 'text-slate-600'
                          }`}>
                            {currentLineNum}
                          </span>
                          <div className="flex-1 overflow-x-auto whitespace-pre">
                            {lineText}
                            {isTargetLine && (
                              <div className="mt-1 text-[11px] text-red-400 font-sans font-normal bg-red-950/80 border border-red-800/50 p-1.5 rounded flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span><strong>Wrong/Vulnerable Primitive Detected:</strong> {selectedFinding.algorithm} ({selectedFinding.title})</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSingleFile}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Download Modified File
                </button>

                {selectedFinding.scan_id && (
                  <button
                    onClick={() => downloadAuthenticatedFile(`/scans/${selectedFinding.scan_id}/download-zip`, 'project-updated.zip')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    Download Project ZIP
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
                {isEditing && (
                  <button
                    onClick={handleSaveFileLocally}
                    disabled={savingFile}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <Save className="w-4 h-4" />
                    {savingFile ? 'Saving Changes...' : 'Confirm & Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
