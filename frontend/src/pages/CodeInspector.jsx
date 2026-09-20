import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
  FileCode, Folder, FolderOpen, RefreshCw, Save, Download, Edit3, X,
  AlertTriangle, AlertCircle, Info, ShieldAlert, CheckCircle2, Eye,
  GitBranch, GitCommit, FileText, ChevronRight, CornerDownRight, Check
} from 'lucide-react';

// Recursive Project File Tree Node Component
function FileTreeNode({ node, selectedFilePath, onSelectFile }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!node) return null;

  if (node.type === 'directory') {
    return (
      <div className="pl-1">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-slate-800/60 rounded text-xs font-mono text-slate-300 cursor-pointer select-none"
        >
          {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
          <span className="truncate font-semibold">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div className="pl-3 border-l border-slate-800/80 ml-2 space-y-0.5 mt-0.5">
            {node.children.map((child, idx) => (
              <FileTreeNode key={idx} node={child} selectedFilePath={selectedFilePath} onSelectFile={onSelectFile} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = node.path === selectedFilePath || node.relative_path === selectedFilePath || selectedFilePath?.endsWith(node.name);

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      className={`flex items-center gap-1.5 py-1 px-2 rounded text-xs font-mono cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold'
          : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
      }`}
    >
      <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export default function CodeInspector({ currentProject, initialFinding = null, theme = 'dark' }) {
  const [latestScan, setLatestScan] = useState(null);
  const [findings, setFindings] = useState([]);
  const [projectFileTree, setProjectFileTree] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(initialFinding);
  const [fileContent, setFileContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [rescanBanner, setRescanBanner] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);

  const targetLineRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) {
      loadWorkspace();
    }
  }, [currentProject]);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans && scansRes.data.scans.length > 0) {
        const latest = scansRes.data.scans[0];
        setLatestScan(latest);

        const res = await api.get(`/scans/${latest.id}`);
        const scanFindings = res.data.findings || [];
        setFindings(scanFindings);

        // Fetch File Tree
        try {
          const treeRes = await api.get(`/scans/${latest.id}/file-tree`);
          setProjectFileTree(treeRes.data.tree);

          // Select target file from initial finding or first file in tree
          let targetPath = initialFinding?.location;
          if (!targetPath && treeRes.data.tree) {
            targetPath = findFirstFilePath(treeRes.data.tree);
          }
          if (targetPath) {
            setSelectedFilePath(targetPath);
            await loadFileContent(targetPath);
          }
        } catch (e) {
          setProjectFileTree(null);
        }
      }
    } catch (err) {
      console.error('Failed to load code inspector workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const findFirstFilePath = (node) => {
    if (!node) return '';
    if (node.type === 'file') return node.path;
    if (node.children) {
      for (const child of node.children) {
        const p = findFirstFilePath(child);
        if (p) return p;
      }
    }
    return '';
  };

  const loadFileContent = async (filePath) => {
    setLoadingFile(true);
    try {
      const res = await api.post('/scans/file-content', { file_path: filePath });
      setFileContent(res.data.content || '// Content unavailable');
      setEditContent(res.data.content || '');

      // Match finding for selected file if any
      const matchedFinding = findings.find(f => f.location === filePath || filePath.endsWith(f.location?.split(/[/\\]/).pop()));
      if (matchedFinding) setSelectedFinding(matchedFinding);
      else if (!initialFinding) setSelectedFinding(null);
    } catch (err) {
      setFileContent('// File content unavailable on disk');
      setEditContent('');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (selectedFinding && targetLineRef.current) {
      setTimeout(() => {
        targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    }
  }, [selectedFinding, selectedFilePath, fileContent, isEditingFile]);

  // Save Code Edits
  const handleSaveCodeEdits = async () => {
    if (!selectedFilePath) return;
    setSaveError('');
    setSaveSuccess('');
    setRescanBanner('');

    try {
      await api.post('/scans/edit-file', {
        file_path: selectedFilePath,
        new_content: editContent,
        scan_id: latestScan?.id
      });

      setSaveSuccess(`File saved successfully to workspace. Click [Rescan Workspace] to re-evaluate findings.`);
      setFileContent(editContent);
      setIsEditingFile(false);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save local file edits.');
    }
  };

  // Rescan Workspace
  const handleRescanWorkspace = async () => {
    if (!latestScan) return;
    setIsRescanning(true);
    setRescanBanner('');
    setSaveSuccess('');
    setSaveError('');

    try {
      const res = await api.post(`/scans/${latestScan.id}/rescan`);
      const statusText = res.data.rescan_status || 'Workspace rescanned successfully';
      const isResolved = statusText.toLowerCase().includes('resolved') || res.data.total_findings === 0;

      setRescanBanner(
        isResolved
          ? `VERIFIED / RESOLVED: ${statusText}.`
          : `STILL VULNERABLE: ${statusText}. ${res.data.total_findings} findings remaining.`
      );
      await loadWorkspace();
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to rescan workspace.');
    } finally {
      setIsRescanning(false);
    }
  };

  // Download Single File
  const handleDownloadSingleFile = async () => {
    if (!selectedFilePath) return;
    try {
      const response = await api.post('/scans/download-file', { file_path: selectedFilePath }, { responseType: 'blob' });
      const fileName = selectedFilePath.split(/[/\\]/).pop() || 'file.txt';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setSaveError('Unable to download file.');
    }
  };

  // Download Modified ZIP Project
  const handleExportZip = () => {
    if (!latestScan) return;
    const downloadUrl = `${api.defaults.baseURL}/scans/${latestScan.id}/download-zip`;
    window.open(downloadUrl, '_blank');
  };

  // Helpers for line-level details
  const getLineExplanation = (f) => {
    if (!f || !f.algorithm || f.algorithm === 'N/A') {
      return {
        whyWrong: 'Not detected / Insufficient evidence for line-level analysis.',
        remediation: 'Insufficient evidence to prescribe specific code refactoring.',
        recommendedCode: null
      };
    }

    const algo = (f.algorithm || '').toUpperCase();
    const isAsym = /RSA|ECC|ECDSA|DH|DSA|ECDH|X25519/i.test(algo);
    const isWeak = /DES|3DES|RC4|MD5|SHA-1|SHA1/i.test(algo);

    if (isAsym) {
      return {
        whyWrong: `Line ${f.line_number || 1} initializes ${algo} asymmetric key primitive vulnerable to Shor's algorithm polynomial time decryption on CRQC.`,
        remediation: `Replace ${algo} with NIST FIPS 203 ML-KEM for key exchange or FIPS 204 ML-DSA for digital signatures.`,
        recommendedCode: `// REMEDIATION: Replace ${algo} with ML-KEM-768\n- const keypair = crypto.generateKeyPairSync('${algo.toLowerCase()}', { modulusLength: 2048 });\n+ const keypair = ml_kem_768.generateKeyPair();`
      };
    } else if (isWeak) {
      return {
        whyWrong: `Line ${f.line_number || 1} uses legacy cipher/hash ${algo} vulnerable to collision attacks and Grover's search reduction.`,
        remediation: `Upgrade ${algo} to AES-256-GCM cipher or SHA-384 / SHA-512 cryptographic hash.`,
        recommendedCode: `// REMEDIATION: Upgrade ${algo} to SHA-384\n- const hash = crypto.createHash('${algo.toLowerCase()}');\n+ const hash = crypto.createHash('sha384');`
      };
    } else {
      return {
        whyWrong: `Line ${f.line_number || 1} configures ${algo} primitive requiring algorithm agility and key rotation oversight.`,
        remediation: `Enforce minimum key length (AES >= 256-bit) and implement cryptographic agility layer.`,
        recommendedCode: null
      };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className={`border rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-6 h-6 text-blue-400" />
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Interactive Code Inspector & Workspace Editor
            </h1>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Inspect complete project source files, jump to target lines, perform inline edits, download files, and trigger workspace rescans.
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditingFile(!isEditingFile)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              isEditingFile
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isEditingFile ? 'Cancel Edit' : 'Edit Code'}
          </button>

          <button
            onClick={handleDownloadSingleFile}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Download Updated File
          </button>

          {latestScan?.scan_type === 'zip_archive' && (
            <button
              onClick={handleExportZip}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Download Updated Project ZIP
            </button>
          )}

          <button
            onClick={handleRescanWorkspace}
            disabled={isRescanning}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
            {isRescanning ? 'Rescanning...' : 'Rescan Workspace'}
          </button>
        </div>
      </div>

      {/* Banners */}
      {rescanBanner && (
        <div className={`p-3 border rounded-xl text-xs font-bold flex items-center justify-between ${
          rescanBanner.includes('VERIFIED') || rescanBanner.includes('resolved')
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <span>{rescanBanner}</span>
          <button onClick={() => setRescanBanner('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {saveSuccess && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{saveSuccess}</span>
          <button onClick={() => setSaveSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {saveError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 2-Column Inspector View (Left Folder Tree, Right Code Viewer & Details) */}
      <div className={`border rounded-2xl shadow-2xl grid grid-cols-12 overflow-hidden h-[75vh] ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Left Pane: Complete Project Folder Tree */}
        <div className="col-span-3 border-r border-slate-800 bg-slate-950/80 p-4 overflow-y-auto flex flex-col space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Project File Tree
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{findings.length} findings</span>
          </div>

          {/* Finding Quick Jump List */}
          {findings.length > 0 && (
            <div className="space-y-1 mb-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Discovered Findings:</div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {findings.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setSelectedFinding(f);
                      setSelectedFilePath(f.location);
                      loadFileContent(f.location);
                    }}
                    className={`p-1.5 rounded text-[11px] font-mono cursor-pointer truncate flex items-center justify-between ${
                      selectedFinding?.id === f.id
                        ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold'
                        : 'hover:bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <span className="truncate">{f.algorithm || 'Asset'} ({f.location ? f.location.split(/[/\\]/).pop() : 'File'})</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      f.priority === 'P1' ? 'bg-red-600 text-white' :
                      f.priority === 'P2' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {f.priority || 'P3'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 overflow-y-auto flex-1">
            {projectFileTree ? (
              <FileTreeNode
                node={projectFileTree}
                selectedFilePath={selectedFilePath}
                onSelectFile={(fPath) => {
                  setSelectedFilePath(fPath);
                  setIsEditingFile(false);
                  loadFileContent(fPath);
                }}
              />
            ) : (
              <div className="text-xs text-slate-500 italic p-2">Loading workspace folder tree...</div>
            )}
          </div>
        </div>

        {/* Right Pane: Complete File Content Viewer / Editor */}
        <div className="col-span-9 bg-slate-950 flex flex-col overflow-hidden relative">
          {/* Line-Level Finding Details Header Panel */}
          {selectedFinding && (
            <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div><span className="text-slate-400">FILE:</span> <span className="font-bold text-white truncate">{selectedFilePath?.split(/[/\\]/).pop()}</span></div>
                <div><span className="text-slate-400">LINE:</span> <span className="font-bold text-amber-400">{selectedFinding.line_number || 1}</span></div>
                <div><span className="text-slate-400">ALGORITHM:</span> <span className="font-bold text-blue-400">{selectedFinding.algorithm || 'Not detected'}</span></div>
                <div><span className="text-slate-400">PRIORITY:</span> <span className="font-bold text-red-400">{selectedFinding.priority || 'P3'}</span></div>
              </div>

              {(() => {
                const lineExp = getLineExplanation(selectedFinding);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded space-y-0.5">
                      <div className="font-bold text-amber-400">WHY IS THIS WRONG?</div>
                      <p className="text-slate-300 leading-snug">{lineExp.whyWrong}</p>
                    </div>

                    <div className="p-2 bg-slate-950 border border-slate-800 rounded space-y-0.5">
                      <div className="font-bold text-emerald-400">REMEDIATION</div>
                      <p className="text-slate-300 leading-snug">{lineExp.remediation}</p>
                    </div>

                    {lineExp.recommendedCode && (
                      <div className="col-span-full p-2 bg-slate-950 border border-blue-500/30 rounded font-mono text-[10px] text-blue-300 space-y-1">
                        <div className="font-bold text-blue-400">RECOMMENDED CHANGE:</div>
                        <pre className="whitespace-pre overflow-x-auto">{lineExp.recommendedCode}</pre>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="p-2 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between px-4">
            <span>{selectedFilePath}</span>
            <span className="text-amber-400 font-bold">Target Line: {selectedFinding?.line_number || 1}</span>
          </div>

          {loadingFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Loading complete file content...</span>
            </div>
          ) : isEditingFile ? (
            <div className="flex-1 flex flex-col p-3 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSaveCodeEdits}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Code Edits
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 leading-relaxed">
              {fileContent.split('\n').map((lineText, idx) => {
                const lineNum = idx + 1;
                const isTarget = lineNum === (selectedFinding?.line_number || 1);

                return (
                  <div
                    key={idx}
                    ref={isTarget ? targetLineRef : null}
                    className={`flex items-start gap-4 py-0.5 px-2 rounded ${
                      isTarget
                        ? 'bg-amber-500/20 border-l-4 border-amber-500 text-amber-200 font-bold shadow-inner'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <span className={`w-8 select-none text-right shrink-0 font-mono ${
                      isTarget ? 'text-amber-400 font-bold' : 'text-slate-600'
                    }`}>
                      {lineNum}
                    </span>
                    <span className="whitespace-pre overflow-x-auto">{lineText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
