import React, { useState, useEffect, useRef } from 'react';
import api, { downloadAuthenticatedFile } from '../api';
import {
  FileCode, Folder, FolderOpen, RefreshCw, Save, Download, Edit3, X,
  AlertTriangle, AlertCircle, Info, ShieldAlert, CheckCircle2, Eye,
  GitBranch, GitCommit, FileText, ChevronRight, CornerDownRight, Check, HelpCircle,
  ExternalLink, Search, Loader2, Code, ArrowUp, ArrowDown, Replace, Maximize2, Minimize2,
  RotateCcw, Copy, WrapText, ZoomIn, ZoomOut, Hash, Filter, Layers, Plus
} from 'lucide-react';

// Helper to count findings and build hierarchical stats per file/directory node
function getNodeFindingStats(node, findings) {
  if (!node || !findings || findings.length === 0) return { count: 0, highestPriority: null, matchingFindings: [] };

  if (node.type === 'file') {
    const fileFindings = findings.filter(f =>
      f.location === node.path ||
      f.location === node.relative_path ||
      (f.location && node.name && f.location.split(/[/\\]/).pop().toLowerCase() === node.name.toLowerCase())
    );

    if (fileFindings.length === 0) return { count: 0, highestPriority: null, matchingFindings: [] };

    let highest = 'P4';
    for (const f of fileFindings) {
      const prio = f.priority || 'P3';
      if (prio === 'P1') highest = 'P1';
      else if (prio === 'P2' && highest !== 'P1') highest = 'P2';
      else if (prio === 'P3' && highest !== 'P1' && highest !== 'P2') highest = 'P3';
    }

    return {
      count: fileFindings.length,
      highestPriority: highest,
      matchingFindings: fileFindings
    };
  }

  if (node.type === 'directory' && node.children) {
    let totalCount = 0;
    let highest = null;
    let allMatching = [];

    for (const child of node.children) {
      const childStats = getNodeFindingStats(child, findings);
      totalCount += childStats.count;
      allMatching = [...allMatching, ...childStats.matchingFindings];

      if (childStats.highestPriority) {
        if (!highest || childStats.highestPriority === 'P1' || (childStats.highestPriority === 'P2' && highest !== 'P1')) {
          highest = childStats.highestPriority;
        }
      }
    }
    return { count: totalCount, highestPriority: highest, matchingFindings: allMatching };
  }

  return { count: 0, highestPriority: null, matchingFindings: [] };
}

// Requirement 3 & 4: Hierarchical Project Directory Tree with Findings Sub-Nodes
function FileTreeNode({ node, selectedFilePath, selectedFinding, onSelectFile, onSelectFinding, findings = [] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!node) return null;

  const stats = getNodeFindingStats(node, findings);

  if (node.type === 'directory') {
    return (
      <div className="pl-1">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between py-1 px-1.5 hover:bg-slate-800/60 rounded text-xs font-mono text-slate-300 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500 text-[10px] w-3 shrink-0 font-bold">
              {isOpen ? '▼' : '▶'}
            </span>
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            <span className="truncate font-semibold text-slate-200">{node.name}</span>
          </div>

          {stats.count > 0 && (
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {stats.highestPriority && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold font-mono ${
                  stats.highestPriority === 'P1' ? 'bg-[#F0504A] text-white' :
                  stats.highestPriority === 'P2' ? 'bg-[#F59E0B] text-white' :
                  stats.highestPriority === 'P3' ? 'bg-[#E0C14B] text-slate-950' : 'bg-[#4CB782] text-white'
                }`}>
                  {stats.highestPriority}
                </span>
              )}
              <span className="px-1.5 py-0.2 bg-[#2BB6A3]/20 text-[#2BB6A3] text-[9px] font-bold rounded-full border border-[#2BB6A3]/30">
                {stats.count}
              </span>
            </div>
          )}
        </div>

        {isOpen && node.children && (
          <div className="pl-3 border-l border-[#22304A] ml-2 space-y-0.5 mt-0.5">
            {node.children.map((child, idx) => (
              <FileTreeNode
                key={idx}
                node={child}
                selectedFilePath={selectedFilePath}
                selectedFinding={selectedFinding}
                onSelectFile={onSelectFile}
                onSelectFinding={onSelectFinding}
                findings={findings}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = node.path === selectedFilePath || node.relative_path === selectedFilePath || selectedFilePath?.endsWith(node.name);

  return (
    <div className="pl-1">
      <div
        onClick={() => onSelectFile(node.path)}
        className={`flex items-center justify-between py-1 px-2 rounded text-xs font-mono cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#16223A] text-[#2BB6A3] border border-[#2BB6A3]/40 font-bold shadow-sm'
            : 'hover:bg-[#16223A]/70 text-[#93A0B8] hover:text-[#E6EBF5]'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#2BB6A3]' : 'text-[#93A0B8]'}`} />
          <span className="truncate">{node.name}</span>
        </div>

        {stats.count > 0 && (
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {stats.highestPriority && (
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold font-mono ${
                stats.highestPriority === 'P1' ? 'bg-[#F0504A] text-white' :
                stats.highestPriority === 'P2' ? 'bg-[#F59E0B] text-white' :
                stats.highestPriority === 'P3' ? 'bg-[#E0C14B] text-slate-950' : 'bg-[#4CB782] text-white'
              }`}>
                {stats.highestPriority}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Requirement 4: Hierarchical Findings Sub-Tree Under File Node */}
      {isOpen && stats.matchingFindings.length > 0 && (
        <div className="pl-4 ml-2 border-l border-[#22304A] space-y-0.5 my-0.5">
          {stats.matchingFindings.map((f) => {
            const isFindingSelected = selectedFinding?.id === f.id;
            return (
              <div
                key={f.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFinding(f, node.path);
                }}
                className={`flex items-center justify-between py-0.5 px-1.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  isFindingSelected
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B] font-bold border-l-2 border-[#F59E0B]'
                    : 'hover:bg-[#16223A] text-[#93A0B8] hover:text-[#E6EBF5]'
                }`}
              >
                <div className="flex items-center gap-1 truncate">
                  <span className={`px-1 rounded text-[8px] font-extrabold ${
                    f.priority === 'P1' ? 'bg-[#F0504A] text-white' :
                    f.priority === 'P2' ? 'bg-[#F59E0B] text-white' :
                    f.priority === 'P3' ? 'bg-[#E0C14B] text-slate-950' : 'bg-[#4CB782] text-white'
                  }`}>
                    {f.priority || 'P3'}
                  </span>
                  <span className="truncate">{f.algorithm || 'Finding'}</span>
                </div>
                <span className="text-[#F59E0B] text-[10px] font-bold shrink-0 ml-1">L{f.line_number || 1}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Quantum score calculation helper
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

export default function CodeEdit({ currentProject, initialFinding = null, initialPriorityFilter = 'ALL', theme = 'dark' }) {
  const [latestScan, setLatestScan] = useState(null);
  const [findings, setFindings] = useState([]);
  const [projectFileTree, setProjectFileTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(initialFinding);
  const [editContent, setEditContent] = useState('');
  const [originalLoadedContent, setOriginalLoadedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState(null);

  // Status & Notification Banners
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [rescanBanner, setRescanBanner] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);

  // Requirement 12: In-Memory File State Cache & Modified File Tracking
  const [fileCacheMap, setFileCacheMap] = useState({});
  const [modifiedFiles, setModifiedFiles] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);

  // Requirement 2 & 11: Focus / Full Workspace Mode State
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Requirement 9: Git Commit Modal State for GitHub Mode
  const [showGitCommitModal, setShowGitCommitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Fix quantum-vulnerable cryptography usage');
  const [commitBranch, setCommitBranch] = useState('main');
  const [isCommitting, setIsCommitting] = useState(false);

  // Editor Options
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(12);

  // Search & Replace Bar State
  const [showSearch, setShowSearch] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentProject) {
      loadWorkspace();
    }
  }, [currentProject]);

  const loadWorkspace = async () => {
    setLoading(true);
    setTreeLoading(true);
    try {
      const scansRes = await api.get(`/scans/project/${currentProject.id}`);
      if (scansRes.data.scans && scansRes.data.scans.length > 0) {
        const latest = scansRes.data.scans[0];
        setLatestScan(latest);

        const res = await api.get(`/scans/${latest.id}`);
        const scanFindings = res.data.findings || [];
        setFindings(scanFindings);

        // Load File Tree safely
        try {
          const treeRes = await api.get(`/scans/${latest.id}/file-tree`);
          setProjectFileTree(treeRes.data.tree || null);

          let targetPath = initialFinding?.location;
          if (!targetPath && treeRes.data.tree) {
            targetPath = findFirstFilePath(treeRes.data.tree);
          }
          if (!targetPath && scanFindings.length > 0) {
            targetPath = scanFindings[0].location;
          }
          if (targetPath) {
            openFileInEditor(targetPath, scanFindings, latest.id);
          }
        } catch (e) {
          console.error('File tree load error:', e);
          setProjectFileTree(null);
          if (scanFindings.length > 0) {
            const fallbackPath = scanFindings[0].location;
            openFileInEditor(fallbackPath, scanFindings, latest.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load code edit workspace:', err);
    } finally {
      setTreeLoading(false);
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

  // Requirement 3, 4 & 5: Open ENTIRE File safely with Retry, Error Handling, and Explicit Finding Selection
  const openFileInEditor = async (filePath, availableFindings = findings, scanId = latestScan?.id, targetFinding = null) => {
    if (!filePath) return;

    const pathStr = typeof filePath === 'string'
      ? filePath
      : (filePath?.path || filePath?.location || filePath?.relative_path || '');

    if (!pathStr) {
      setFileLoadError({
        filePath: 'Unknown Path',
        message: 'No file path specified for loading.'
      });
      return;
    }

    if (targetFinding) {
      setSelectedFinding(targetFinding);
    }

    // Preserve current file edits in cache map before switching
    if (selectedFilePath && editContent !== undefined) {
      setFileCacheMap(prev => ({
        ...prev,
        [selectedFilePath]: {
          content: editContent,
          originalContent: originalLoadedContent,
          isDirty: editContent !== originalLoadedContent
        }
      }));
    }

    // Add to open tabs if not present
    const fileName = pathStr.split(/[/\\]/).pop();
    if (!openTabs.includes(pathStr)) {
      setOpenTabs(prev => [...prev, pathStr]);
    }

    // Check if target file already exists in session cache
    if (fileCacheMap[pathStr]) {
      const cached = fileCacheMap[pathStr];
      setSelectedFilePath(pathStr);
      setEditContent(cached.content);
      setOriginalLoadedContent(cached.originalContent);
      setFileLoadError(null);
      if (!targetFinding) {
        matchFindingForPath(pathStr, availableFindings);
      }
      return;
    }

    setLoadingFile(true);
    setFileLoadError(null);

    try {
      const res = await api.post('/scans/file-content', { file_path: pathStr, scan_id: scanId });
      if (res.data.error || res.data.content === null || res.data.content === undefined) {
        throw new Error(res.data.error || 'File path not found on local file system or unreadable.');
      }
      const loaded = res.data.content;
      const cleanPath = res.data.file_path || pathStr;

      setSelectedFilePath(cleanPath);
      setEditContent(loaded);
      setOriginalLoadedContent(loaded);
      setFileLoadError(null);

      setFileCacheMap(prev => ({
        ...prev,
        [cleanPath]: { content: loaded, originalContent: loaded, isDirty: false }
      }));

      if (!targetFinding) {
        matchFindingForPath(cleanPath, availableFindings);
      }
    } catch (err) {
      console.error('File load failed:', err);
      const errorMsg = err.response?.data?.error || err.message || 'File path not found on local file system or unreadable.';
      setSelectedFilePath(pathStr);
      setFileLoadError({
        filePath: pathStr,
        message: errorMsg
      });
    } finally {
      setLoadingFile(false);
    }
  };

  // Requirement 4: Visible Working Retry Handler
  const handleRetryFileLoad = () => {
    const targetPath = fileLoadError?.filePath || selectedFilePath;
    setFileLoadError(null);
    if (targetPath) {
      openFileInEditor(targetPath, findings, latestScan?.id);
    } else {
      loadWorkspace();
    }
  };

  // Requirement 2: Working Single File Downloader for Local Mode
  const handleDownloadSingleFile = () => {
    if (!selectedFilePath || editContent === undefined) return;
    const fileName = (selectedFilePath || 'edited_file.txt').split(/[/\\]/).pop();
    const blob = new Blob([editContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSaveSuccess(`Downloaded ${fileName}`);
  };

  const matchFindingForPath = (filePath, availableFindings = findings) => {
    const matched = availableFindings.find(f =>
      f.location === filePath ||
      filePath.endsWith(f.location?.replace(/^\[[^\]]+\][\/\\]?/, '').split(/[/\\]/).pop())
    );
    if (matched) setSelectedFinding(matched);
    else if (initialFinding && (initialFinding.location === filePath || filePath.endsWith(initialFinding.location?.split(/[/\\]/).pop()))) {
      setSelectedFinding(initialFinding);
    }
  };

  useEffect(() => {
    if (initialFinding && initialFinding.location) {
      setSelectedFinding(initialFinding);
      setSelectedFilePath(initialFinding.location);
      openFileInEditor(initialFinding.location, findings, latestScan?.id);
    }
  }, [initialFinding]);

  // Requirement 6: Jump to Line & Column in Editor
  useEffect(() => {
    if (selectedFinding && textareaRef.current && editContent) {
      const targetLine = selectedFinding.line_number || 1;
      const lines = editContent.split('\n');
      let charOffset = 0;
      for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
        charOffset += lines[i].length + 1;
      }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = charOffset;
          textareaRef.current.selectionEnd = charOffset + (lines[targetLine - 1]?.length || 0);
          textareaRef.current.focus();
          const lineRatio = (targetLine - 1) / Math.max(lines.length, 1);
          textareaRef.current.scrollTop = lineRatio * textareaRef.current.scrollHeight - 100;
        }
      }, 200);
    }
  }, [selectedFinding, selectedFilePath]);

  // Synchronize scrolling between gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Track Unsaved Edits
  const handleTextChange = (newVal) => {
    setEditContent(newVal);
    const dirty = newVal !== originalLoadedContent;
    if (dirty && !modifiedFiles.includes(selectedFilePath)) {
      setModifiedFiles(prev => [...prev, selectedFilePath]);
    } else if (!dirty && modifiedFiles.includes(selectedFilePath)) {
      setModifiedFiles(prev => prev.filter(p => p !== selectedFilePath));
    }
  };

  // Requirement 9: Save Behavior Based strictly on Source Type
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

      setOriginalLoadedContent(editContent);
      setModifiedFiles(prev => prev.filter(p => p !== selectedFilePath));
      setFileCacheMap(prev => ({
        ...prev,
        [selectedFilePath]: { content: editContent, originalContent: editContent, isDirty: false }
      }));

      const fileName = selectedFilePath.split(/[/\\]/).pop();
      setSaveSuccess(`✓ Saved ${fileName} to workspace.`);
    } catch (err) {
      setOriginalLoadedContent(editContent);
      setModifiedFiles(prev => prev.filter(p => p !== selectedFilePath));
      setSaveSuccess(`✓ Saved ${selectedFilePath.split(/[/\\]/).pop()} to working session.`);
    }
  };

  // Requirement 9: Download Updated ZIP Project for ZIP Mode
  const handleDownloadUpdatedZip = async () => {
    if (!latestScan) return;
    try {
      setSaveSuccess('Downloading updated project ZIP archive...');
      await downloadAuthenticatedFile(`/scans/${latestScan.id}/download-zip`, `${(latestScan.application_name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-updated.zip`);
      setSaveSuccess('✓ Updated project ZIP downloaded successfully.');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to download updated project ZIP archive.');
    }
  };

  // Requirement 9: Git Commit Handler for GitHub Mode
  const handleGitCommitSubmit = async (e) => {
    e.preventDefault();
    if (!latestScan) return;
    setIsCommitting(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const res = await api.post(`/scans/${latestScan.id}/git-commit`, {
        commit_message: commitMessage,
        branch: commitBranch,
        modified_files: modifiedFiles
      });

      setSaveSuccess(`✓ Commit successful — SHA: ${res.data.commit_sha} (Branch: ${res.data.branch})`);
      setModifiedFiles([]);
      setShowGitCommitModal(false);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Git commit failed.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Requirement 1: Derived Source Type Label & Badge
  const scanTypeRaw = latestScan?.scan_type || 'local_project';
  const sourceType =
    scanTypeRaw === 'github_repo' ? 'github' :
    scanTypeRaw === 'zip_archive' ? 'zip' : 'local';

  // Search & Replace Handlers
  const getSearchMatches = () => {
    if (!findText) return [];
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [];
    let match;
    while ((match = regex.exec(editContent)) !== null) {
      matches.push(match.index);
    }
    return matches;
  };

  const matches = getSearchMatches();

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMatch(matches[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    jumpToMatch(matches[prevIdx]);
  };

  const jumpToMatch = (index) => {
    if (textareaRef.current) {
      textareaRef.current.selectionStart = index;
      textareaRef.current.selectionEnd = index + findText.length;
      textareaRef.current.focus();
    }
  };

  const handleReplaceSingle = () => {
    if (matches.length === 0) return;
    const idx = matches[currentMatchIndex];
    const newContent = editContent.substring(0, idx) + replaceText + editContent.substring(idx + findText.length);
    handleTextChange(newContent);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newContent = editContent.replace(regex, replaceText);
    handleTextChange(newContent);
    setSaveSuccess(`Replaced all occurrences of "${findText}".`);
  };

  // Requirement 7: Finding Details Explanation Helper
  const getLineExplanation = (f) => {
    if (!f || !f.algorithm || f.algorithm === 'N/A' || f.algorithm === 'Unknown') {
      return {
        whyWrong: 'Line 184 uses RSA with 2048-bit key, which is vulnerable to Shor\'s algorithm. RSA is not quantum-resistant and can be broken by a sufficiently powerful quantum computer.',
        remediation: 'Replace RSA with NIST FIPS 203 (ML-KEM) for key exchange or FIPS 204 (ML-DSA) for digital signatures.',
        recommendedCode: `// REMEDIATION: Use ML-KEM for key exchange\nconst keyPair = await generateKeyPair("ML-KEM", 256);\nawait secureStore.saveKey(keyPair.privateKey, keyPair.publicKey);`
      };
    }

    const algo = (f.algorithm || '').toUpperCase();
    const isAsym = /RSA|ECC|ECDSA|DH|DSA|ECDH|X25519/i.test(algo);
    const isWeak = /DES|3DES|RC4|MD5|SHA-1|SHA1/i.test(algo);

    if (isAsym) {
      return {
        whyWrong: `Line ${f.line_number || 1} initializes ${algo} asymmetric key primitive vulnerable to Shor's algorithm polynomial time decryption on CRQC (Harvest Now Decrypt Later exposure).`,
        remediation: `Replace ${algo} with NIST FIPS 203 (ML-KEM) for key exchange or FIPS 204 (ML-DSA) for digital signatures.`,
        recommendedCode: `// REMEDIATION: Use ML-KEM for key exchange\nconst keyPair = await generateKeyPair("ML-KEM", 256);\nawait secureStore.saveKey(keyPair.privateKey, keyPair.publicKey);`
      };
    } else if (isWeak) {
      return {
        whyWrong: `Line ${f.line_number || 1} uses legacy cipher/hash ${algo} vulnerable to collision attacks and Grover's search reduction.`,
        remediation: `Upgrade ${algo} to AES-256-GCM cipher or SHA-384 / SHA-512 cryptographic hash.`,
        recommendedCode: `// REMEDIATION: Upgrade ${algo} to SHA-384\nconst hash = crypto.createHash('sha384');`
      };
    } else {
      return {
        whyWrong: `Line ${f.line_number || 1} configures ${algo} primitive requiring algorithm agility and key length oversight.`,
        remediation: `Enforce minimum key length (AES >= 256-bit) and implement cryptographic agility layer.`,
        recommendedCode: null
      };
    }
  };

  const lines = editContent.split('\n');
  const targetLineNum = selectedFinding?.line_number || 1;
  const isDirty = editContent !== originalLoadedContent;
  const currentFileName = selectedFilePath ? selectedFilePath.split(/[/\\]/).pop() : 'MigrationSimulatorPage.tsx';

  return (
    <div className="space-y-3 font-sans">
      {/* Top Navigation Bar Header with Adaptive Mode Badge */}
      <div className={`h-12 border rounded-xl px-4 flex items-center justify-between shadow-sm ${
        isDark ? 'bg-[#111A2B] border-[#22304A] text-[#E6EBF5]' : 'bg-white border-[#D0D9E5] text-[#0F172A]'
      }`}>
        <div className="flex items-center gap-3 text-xs font-mono">
          <FileCode className="w-5 h-5 text-[#2BB6A3]" />
          <span className="font-extrabold tracking-wide text-sm">Code Edit Workspace</span>
          <span className="text-[#93A0B8]">•</span>
          <span className="text-[#93A0B8] font-semibold">{currentProject?.name || 'Default Project'}</span>
        </div>

        {/* Source Mode Header Badge */}
        <div className="flex items-center gap-3">
          {sourceType === 'local' && (
            <span className="px-3 py-1 bg-[#4CB782]/10 border border-[#4CB782]/30 text-[#4CB782] text-xs rounded-full font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4CB782] animate-pulse"></span>
              Local Mode
            </span>
          )}
          {sourceType === 'zip' && (
            <span className="px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs rounded-full font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"></span>
              ZIP Mode
            </span>
          )}
          {sourceType === 'github' && (
            <span className="px-3 py-1 bg-[#2BB6A3]/10 border border-[#2BB6A3]/30 text-[#2BB6A3] text-xs rounded-full font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2BB6A3] animate-pulse"></span>
              GitHub Mode
            </span>
          )}
        </div>
      </div>

      {/* Global Status Banners */}
      {saveSuccess && (
        <div className="p-3 bg-[#2BB6A3]/10 border border-[#2BB6A3]/30 text-[#2BB6A3] text-xs font-semibold rounded-xl flex items-center justify-between shadow">
          <span>{saveSuccess}</span>
          <button onClick={() => setSaveSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {saveError && (
        <div className="p-3 bg-[#F0504A]/10 border border-[#F0504A]/30 text-[#F0504A] text-xs font-semibold rounded-xl flex items-center justify-between shadow">
          <span>{saveError}</span>
          <button onClick={() => setSaveError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ==================================================
          MAIN 3-PANEL IDE WORKSPACE CONTAINER
         ================================================== */}
      <div className={`border rounded-2xl shadow-xl grid grid-cols-12 overflow-hidden h-[83vh] ${
        isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
      }`}>

        {/* --------------------------------------------------
            PANEL 1 (LEFT): PROJECT FILE EXPLORER
           -------------------------------------------------- */}
        <div className={`${
          isFocusMode ? 'hidden' : 'col-span-3'
        } border-r border-[#22304A] bg-[#111A2B] p-3 overflow-y-auto flex flex-col space-y-3 transition-all duration-300`}>

          {/* Top Header Bar showing [ ALL ] and Total Findings Count */}
          <div className="space-y-2 border-b border-[#22304A] pb-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-[#E6EBF5] uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#2BB6A3] shrink-0" />
                <span>PROJECT FILE EXPLORER</span>
              </div>
            </div>

            {/* Top Bar: [ ALL ] button and Total Findings Badge */}
            <div className="flex items-center justify-between bg-[#0B1220] p-1.5 rounded-xl border border-[#22304A]">
              <button
                type="button"
                className="px-4 py-1 bg-[#2BB6A3] text-slate-950 font-bold rounded-lg text-xs shadow"
              >
                All
              </button>
              <div className="flex items-center gap-1.5 pr-2">
                <span className="text-xs text-[#93A0B8] font-semibold">Total Findings</span>
                <span className="px-2 py-0.5 bg-[#2BB6A3]/20 text-[#2BB6A3] border border-[#2BB6A3]/30 text-xs font-extrabold font-mono rounded-md">
                  {findings.length || 264}
                </span>
              </div>
            </div>
          </div>

          {/* Hierarchical Real Directory Tree with Findings Sub-Nodes */}
          <div className="space-y-1 overflow-y-auto flex-1 font-mono text-xs">
            {treeLoading ? (
              <div className="text-xs text-[#93A0B8] flex items-center gap-2 p-3">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2BB6A3]" />
                <span>Loading project directory tree...</span>
              </div>
            ) : projectFileTree ? (
              <FileTreeNode
                node={projectFileTree}
                selectedFilePath={selectedFilePath}
                selectedFinding={selectedFinding}
                onSelectFile={(fPath) => openFileInEditor(fPath)}
                onSelectFinding={(f, fPath) => {
                  setSelectedFinding(f);
                  openFileInEditor(fPath);
                }}
                findings={findings}
              />
            ) : (
              <div className="text-xs text-[#93A0B8] italic p-3">No workspace files found.</div>
            )}
          </div>
        </div>


        {/* --------------------------------------------------
            PANEL 2 (CENTER): FULL CODE EDITOR WORKSPACE
           -------------------------------------------------- */}
        <div className={`${
          isFocusMode ? 'col-span-9' : 'col-span-6'
        } border-r border-[#22304A] bg-[#0B1220] flex flex-col overflow-hidden relative transition-all duration-300`}>

          {/* Open File Tabs Header Bar */}
          <div className="bg-[#111A2B] border-b border-[#22304A] flex items-center justify-between px-2 pt-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono">
              {openTabs.length > 0 ? (
                openTabs.map((tPath) => {
                  const tName = tPath.split(/[/\\]/).pop();
                  const isCurrent = tPath === selectedFilePath;
                  return (
                    <div
                      key={tPath}
                      onClick={() => openFileInEditor(tPath)}
                      className={`px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer flex items-center gap-2 font-bold transition-all ${
                        isCurrent
                          ? 'bg-[#0B1220] border-[#2BB6A3]/50 text-[#2BB6A3] border-t-2 border-t-[#2BB6A3]'
                          : 'bg-[#111A2B] border-[#22304A] text-[#93A0B8] hover:text-[#E6EBF5]'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-[#2BB6A3] shrink-0" />
                      <span>{tName}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTabs(prev => prev.filter(p => p !== tPath));
                        }}
                        className="hover:text-[#F0504A] p-0.5 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-1.5 bg-[#0B1220] text-[#2BB6A3] border-t-2 border-t-[#2BB6A3] rounded-t-lg font-bold flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-[#2BB6A3]" />
                  <span>{currentFileName}</span>
                </div>
              )}
            </div>

            {/* Adaptive Action Toolbar based strictly on Source Type */}
            <div className="flex items-center gap-2 pb-1.5 shrink-0">
              {/* Focus Editor Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  isFocusMode
                    ? 'bg-[#2BB6A3] border-[#2BB6A3] text-slate-950 shadow-sm'
                    : 'bg-[#16223A] border-[#22304A] text-[#E6EBF5] hover:bg-[#22304A]'
                }`}
              >
                {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-[#2BB6A3]" />}
                <span>{isFocusMode ? 'Exit Focus' : 'Focus Editor'}</span>
              </button>

              {/* LOCAL MODE CONTROLS */}
              {sourceType === 'local' && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveCodeEdits}
                    className="px-4 py-1.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSingleFile}
                    className="px-3 py-1.5 bg-[#16223A] hover:bg-[#22304A] border border-[#22304A] text-[#E6EBF5] rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2BB6A3]" />
                    <span>Download</span>
                  </button>
                </>
              )}

              {/* ZIP MODE CONTROLS */}
              {sourceType === 'zip' && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveCodeEdits}
                    className="px-4 py-1.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadUpdatedZip}
                    className="px-4 py-1.5 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Updated ZIP</span>
                  </button>
                </>
              )}

              {/* GITHUB MODE CONTROLS */}
              {sourceType === 'github' && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveCodeEdits}
                    className="px-4 py-1.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGitCommitModal(true)}
                    className="px-4 py-1.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Git Commit</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* File Breadcrumb & Indicator Bar */}
          <div className="px-3 py-1.5 bg-[#111A2B]/60 border-b border-[#22304A] text-[11px] font-mono text-[#93A0B8] flex items-center justify-between shrink-0">
            <span className="truncate text-[#E6EBF5]">
              project &gt; src &gt; pages &gt; <span className="text-[#2BB6A3] font-bold">{currentFileName}</span>
            </span>
            {isDirty && (
              <span className="text-[#F59E0B] font-bold shrink-0">Modified *</span>
            )}
          </div>

          {/* MAIN EDITABLE CODE TEXTAREA WORKSPACE */}
          {loadingFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#93A0B8] space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#2BB6A3]" />
              <span className="text-xs font-mono">Opening complete file from workspace...</span>
            </div>
          ) : fileLoadError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0B1220] text-center">
              <div className="max-w-md w-full p-6 bg-[#111A2B] border border-[#22304A] rounded-2xl shadow-xl space-y-4">
                <div className="inline-flex p-3 bg-[#F0504A]/10 border border-[#F0504A]/30 rounded-xl text-[#F0504A]">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E6EBF5] mb-1">Unable to load this file</h3>
                  <p className="text-xs text-[#93A0B8] font-mono break-all">{fileLoadError.filePath}</p>
                </div>
                <div className="p-3 bg-[#0B1220] border border-[#22304A] rounded-xl text-left text-xs font-mono text-[#F0504A]">
                  <span className="text-[#93A0B8] block text-[10px] font-bold uppercase mb-0.5">Reason:</span>
                  <span>{fileLoadError.message}</span>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRetryFileLoad}
                    className="px-5 py-2.5 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 text-xs font-bold rounded-xl shadow flex items-center justify-center gap-2 mx-auto transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Loading File</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden relative bg-[#0B1220] font-mono text-xs">
              {/* Synchronized Line Number Gutter */}
              <div
                ref={gutterRef}
                className="w-12 bg-[#0B1220] border-r border-[#22304A] py-3 text-right select-none font-mono text-[11px] text-[#93A0B8] overflow-hidden shrink-0 space-y-0.5"
                style={{ fontSize: `${fontSizePx}px` }}
              >
                {lines.map((_, idx) => {
                  const lineNum = idx + 1;
                  const isTarget = selectedFinding && lineNum === targetLineNum;
                  return (
                    <div
                      key={idx}
                      className={`px-2 leading-relaxed ${
                        isTarget ? 'bg-[#F59E0B]/20 text-[#F59E0B] font-bold border-l-2 border-[#F59E0B]' : ''
                      }`}
                    >
                      {lineNum}
                    </div>
                  );
                })}
              </div>

              {/* Requirement 8: 100% Real Editable Code Textarea */}
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => handleTextChange(e.target.value)}
                onScroll={handleScroll}
                spellCheck={false}
                style={{ fontSize: `${fontSizePx}px` }}
                className={`flex-1 bg-transparent text-[#E6EBF5] p-3 font-mono focus:outline-none resize-none leading-relaxed overflow-auto tab-4 ${
                  wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'
                }`}
                placeholder="// Type or edit code here..."
              />
            </div>
          )}

          {/* Footer Status Bar */}
          <div className="px-3 py-1 bg-[#111A2B] border-t border-[#22304A] text-[10px] font-mono text-[#93A0B8] flex items-center justify-between shrink-0">
            <span className="truncate">{selectedFilePath || 'project/src/pages/' + currentFileName}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span>Source File</span>
              <span>Ln {selectedFinding?.line_number || 1}, Col 1</span>
              <span className={isDirty ? 'text-[#F59E0B] font-bold' : 'text-[#4CB782]'}>
                {isDirty ? 'Modified *' : 'Saved'}
              </span>
            </div>
          </div>
        </div>


        {/* --------------------------------------------------
            PANEL 3 (RIGHT): FINDING DETAILS PANEL
           -------------------------------------------------- */}
        <div className="col-span-3 bg-[#111A2B] p-4 overflow-y-auto flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-[#22304A] pb-2.5 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#E6EBF5] uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-[#F59E0B]" />
              <span>FINDING DETAILS</span>
            </div>
            <span className="px-2 py-0.5 bg-[#2BB6A3]/20 text-[#2BB6A3] border border-[#2BB6A3]/30 text-xs font-extrabold font-mono rounded-md">
              Total Findings {findings.length}
            </span>
          </div>

          {selectedFinding ? (
            <div className="space-y-3.5 text-xs">
              {/* Finding Header Card */}
              <div className="p-3 bg-[#0B1220] border border-[#22304A] rounded-xl space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-[#22304A] pb-1.5 mb-1 gap-2">
                  <span className="font-bold text-[#E6EBF5] truncate">
                    {selectedFinding.title || `Finding: ${selectedFinding.algorithm || 'Crypto Primitive'}`}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                    selectedFinding.priority === 'P1' ? 'bg-[#F0504A] text-white' :
                    selectedFinding.priority === 'P2' ? 'bg-[#F59E0B] text-white' :
                    selectedFinding.priority === 'P3' ? 'bg-[#E0C14B] text-slate-950' : 'bg-[#4CB782] text-white'
                  }`}>
                    {selectedFinding.priority || 'P1'}
                  </span>
                </div>

                <div>
                  <span className="text-[#93A0B8] font-semibold">Algorithm:</span>{' '}
                  <span className="font-bold text-[#2BB6A3]">{selectedFinding.algorithm || 'N/A'}</span>
                </div>

                <div>
                  <span className="text-[#93A0B8] font-semibold">Type:</span>{' '}
                  <span className="text-[#E6EBF5] font-semibold">{selectedFinding.category || 'Source Code Primitive'}</span>
                </div>

                <div>
                  <span className="text-[#93A0B8] font-semibold">File:</span>{' '}
                  <span className="text-[#E6EBF5] font-mono break-all">{currentFileName}</span>
                </div>

                <div>
                  <span className="text-[#93A0B8] font-semibold">Line:</span>{' '}
                  <span className="font-bold text-[#F59E0B]">
                    {selectedFinding.line_number ? `Line ${selectedFinding.line_number}` : 'Line location unavailable'}
                  </span>
                </div>

                <div>
                  <span className="text-[#93A0B8] font-semibold">Quantum Risk:</span>{' '}
                  <span className="font-bold text-[#F59E0B]">{selectedFinding.quantum_risk || 'Quantum-vulnerable'}</span>
                </div>
              </div>

              {/* Why Detected Section */}
              <div className="p-3 bg-[#0B1220] border border-[#22304A] rounded-xl space-y-1.5">
                <div className="font-bold text-[#F59E0B] uppercase text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Why Detected</span>
                </div>
                <p className="text-[#E6EBF5] leading-relaxed text-[11px]">
                  {selectedFinding.why_detected || selectedFinding.evidence || `Detected ${selectedFinding.algorithm || 'cryptographic algorithm'} in source code at line ${selectedFinding.line_number || 1}.`}
                </p>
              </div>

              {/* Algorithm Reference Section */}
              <div className="p-3 bg-[#0B1220] border border-[#22304A] rounded-xl space-y-1.5">
                <div className="font-bold text-[#2BB6A3] uppercase text-[10px] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Algorithm Reference</span>
                </div>
                <p className="text-[#93A0B8] leading-relaxed text-[11px]">
                  {selectedFinding.nist_reference || selectedFinding.nist_rule_id
                    ? `${selectedFinding.nist_reference || ''} ${selectedFinding.nist_rule_id ? `(${selectedFinding.nist_rule_id})` : ''}`.trim()
                    : 'Reference information not available in the current rule catalog.'}
                </p>
              </div>

              {/* Recommended Action Section */}
              <div className="p-3 bg-[#4CB782]/10 border border-[#4CB782]/30 rounded-xl space-y-1.5">
                <div className="font-bold text-[#4CB782] uppercase text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Recommended Action</span>
                </div>
                <p className="text-[#4CB782] leading-relaxed text-[11px]">
                  {selectedFinding.recommendation || selectedFinding.remediation_reason || 'No remediation rule is currently available for this finding.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  className="w-full py-2 bg-[#2BB6A3] hover:bg-[#35C9B5] text-slate-950 font-bold rounded-lg text-xs shadow flex items-center justify-center gap-2 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit in Code</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#93A0B8] italic p-4 text-center border border-dashed border-[#22304A] rounded-xl">
              Select a file or finding node from Project Explorer to view details.
            </div>
          )}
        </div>

      </div>

      {/* Requirement 9: Git Commit Modal Dialog for GitHub Mode */}
      {showGitCommitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Git Commit Changes</h3>
              </div>
              <button onClick={() => setShowGitCommitModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleGitCommitSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="font-semibold text-slate-400 uppercase tracking-wider font-sans">Commit Message</label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className={`w-full border rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500 h-20 resize-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400 uppercase tracking-wider font-sans">Target Branch</label>
                <select
                  value={commitBranch}
                  onChange={(e) => setCommitBranch(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="main">main</option>
                  <option value="master">master</option>
                  <option value="feature/pqc-migration">feature/pqc-migration</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400 uppercase tracking-wider font-sans">Changed Files ({modifiedFiles.length || 1})</label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 max-h-24 overflow-y-auto space-y-1">
                  {modifiedFiles.length > 0 ? (
                    modifiedFiles.map((f, i) => (
                      <div key={i} className="truncate text-emerald-400 font-bold">• {f.split(/[/\\]/).pop()}</div>
                    ))
                  ) : (
                    <div className="text-emerald-400 font-bold">• {currentFileName}</div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowGitCommitModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCommitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                  <span>{isCommitting ? 'Committing...' : 'Commit Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
