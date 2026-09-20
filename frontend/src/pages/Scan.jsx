import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { Play, Folder, FolderOpen, Upload, GitBranch, CheckCircle2, ShieldAlert, AlertTriangle, FileArchive, Loader2 } from 'lucide-react';

export default function Scan({ currentProject, setActiveTab, onScanCompleted, theme = 'dark' }) {
  const [inputType, setInputType] = useState('local'); // 'local' | 'zip' | 'github'
  const [githubUrl, setGithubUrl] = useState('https://github.com/facebook/react');
  const [localPath, setLocalPath] = useState('sample_targets');
  const [zipFile, setZipFile] = useState(null);
  const [uploadedZipPath, setUploadedZipPath] = useState('');
  const [uploadingZip, setUploadingZip] = useState(false);

  const [uploadingFolder, setUploadingFolder] = useState(false);
  const scanFolderInputRef = useRef(null);

  // Business Criticality & App Metadata Pre-Scan Inputs
  const [applicationName, setApplicationName] = useState(currentProject ? currentProject.name : 'Payment Gateway Core');
  const [applicationType, setApplicationType] = useState('Web Service / Microservice');
  const [businessCriticality, setBusinessCriticality] = useState('High');

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');

  // Sequenced N4-7 Category Pipeline Progress Step (0 to 7)
  const [activeStep, setActiveStep] = useState(0);

  // Pre-Scan Confirmation Modal State
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const isDark = theme === 'dark';
  const deploymentMode = localStorage.getItem('mbox_deployment_mode') || 'local';

  const categoriesList = [
    { id: 1, name: '1. Source Code Pipeline', desc: 'Java, JS, TS, Python, C/C++, Go, Rust AST' },
    { id: 2, name: '2. Libraries / Dependencies', desc: 'Package Manifest & CVE Correlation' },
    { id: 3, name: '3. Binaries / Executables', desc: 'Static PE/ELF Symbol & Header Analysis' },
    { id: 4, name: '4. Containers / Images', desc: 'Dockerfile & Base OS Crypto Dependencies' },
    { id: 5, name: '5. Certificates / PKI / Keys', desc: 'X.509 Cert Chain & Redacted Keys' },
    { id: 6, name: '6. Protocols / TLS', desc: 'NIST SP 800-52r2 Cipher Suite Configs' },
    { id: 7, name: '7. Cloud / Hardware Modules', desc: 'KMS Definitions & PKCS#11 HSM Providers' }
  ];

  useEffect(() => {
    let interval = null;
    if (isScanning) {
      setActiveStep(1);
      interval = setInterval(() => {
        setActiveStep((prev) => (prev < 7 ? prev + 1 : 7));
      }, 700);
    } else if (scanResult) {
      setActiveStep(7);
    } else {
      setActiveStep(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isScanning, scanResult]);

  // Handle ZIP file upload
  const handleZipFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Selected file must be a valid .zip archive.');
      return;
    }

    setError('');
    setZipFile(file);
    setUploadingZip(true);

    const formData = new FormData();
    formData.append('target_file', file);

    try {
      const res = await api.post('/scans/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedZipPath(res.data.uploaded_path);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload ZIP archive.');
      setZipFile(null);
    } finally {
      setUploadingZip(false);
    }
  };

  // Handle local folder upload via browser directory picker
  const handleScanFolderSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFolder(true);
    setError('');

    const formData = new FormData();
    const relPaths = [];
    Array.from(files).forEach((file) => {
      formData.append('folder_files', file);
      relPaths.push(file.webkitRelativePath || file.name);
    });
    formData.append('rel_paths', JSON.stringify(relPaths));

    try {
      const res = await api.post('/scans/upload-folder', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLocalPath(res.data.uploaded_path);
      if (res.data.folder_name) {
        setApplicationName(res.data.folder_name);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload local project folder.');
    } finally {
      setUploadingFolder(false);
      if (scanFolderInputRef.current) scanFolderInputRef.current.value = '';
    }
  };

  const handleStartScan = async (e) => {
    e.preventDefault();
    setError('');

    const derivedProjectId = currentProject ? currentProject.id : 1;
    let derivedTargetPath = '';
    let zipToUse = uploadedZipPath;

    if (inputType === 'github') {
      const githubRegex = /^https:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i;
      if (!githubUrl || !githubRegex.test(githubUrl.trim())) {
        setError('Please enter a valid GitHub repository URL (e.g. https://github.com/username/repository)');
        return;
      }
      derivedTargetPath = githubUrl.trim();
    } else if (inputType === 'zip') {
      if (!zipToUse && zipFile) {
        setUploadingZip(true);
        const formData = new FormData();
        formData.append('target_file', zipFile);
        try {
          const uploadRes = await api.post('/scans/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          zipToUse = uploadRes.data.uploaded_path;
          setUploadedZipPath(zipToUse);
        } catch (uploadErr) {
          setUploadingZip(false);
          setError(uploadErr.response?.data?.error || 'Unable to extract ZIP file.');
          return;
        }
        setUploadingZip(false);
      }

      if (!zipToUse) {
        setError('Please upload a valid .zip project archive before starting scan.');
        return;
      }
      derivedTargetPath = zipFile ? zipFile.name : 'Uploaded ZIP Archive';
    } else if (inputType === 'local') {
      if (!localPath.trim()) {
        setError('Please specify a local project directory.');
        return;
      }
      derivedTargetPath = localPath.trim();
    }

    const payload = {
      project_id: derivedProjectId,
      input_type: inputType,
      target_path: inputType === 'local' ? derivedTargetPath : undefined,
      github_url: inputType === 'github' ? derivedTargetPath : undefined,
      uploaded_zip_path: inputType === 'zip' ? zipToUse : undefined,
      application_name: applicationName,
      application_type: applicationType,
      business_criticality: businessCriticality
    };

    setPendingPayload(payload);
    setShowConfirmationModal(true);
  };

  const executeScanLaunch = async () => {
    if (!pendingPayload) return;
    setShowConfirmationModal(false);
    setIsScanning(true);
    setScanResult(null);

    try {
      let res;
      try {
        res = await api.post('/scans/start', pendingPayload);
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          // Session expired: re-authenticate via existing auth mechanism and retry
          try {
            const relogin = await api.post('/auth/login', { username: 'analyst', password: 'password123' });
            if (relogin.data && relogin.data.token) {
              localStorage.setItem('ecdat_token', relogin.data.token);
              res = await api.post('/scans/start', pendingPayload);
            } else {
              throw err;
            }
          } catch (refreshErr) {
            throw err;
          }
        } else {
          throw err;
        }
      }

      const scanId = res.data.scan_id;

      // Poll scan status until complete
      const pollInterval = setInterval(async () => {
        try {
          const check = await api.get(`/scans/${scanId}`);
          if (check.data.scan.status === 'completed') {
            clearInterval(pollInterval);
            setIsScanning(false);
            setScanResult(check.data);
            if (onScanCompleted) onScanCompleted(scanId);
            if (setActiveTab) setActiveTab('dashboard');
          } else if (check.data.scan.status === 'failed') {
            clearInterval(pollInterval);
            setIsScanning(false);
            setError(check.data.scan.scan_log || 'Scan execution failed.');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsScanning(false);
          setError('Failed to poll scan status.');
        }
      }, 1000);
    } catch (err) {
      setIsScanning(false);
      setError(err.response?.data?.error || 'Failed to launch scan.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>MOX Cryptographic Discovery Scanner</h1>
          <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full font-mono font-bold">
            EXTENSIBLE NIST ENGINE
          </span>
        </div>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Extensible NIST Cryptographic Engine • Unified Scanner Pipeline
        </p>

        {/* 3 Input Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            type="button"
            onClick={() => { setInputType('github'); setError(''); }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              inputType === 'github'
                ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10 font-bold'
                : isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <GitBranch className="w-6 h-6" />
            <div className="text-xs">1. GitHub Repository</div>
            <div className="text-[10px] text-slate-500 font-mono">Clones & Scans URL</div>
          </button>

          <button
            type="button"
            onClick={() => { setInputType('zip'); setError(''); }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              inputType === 'zip'
                ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10 font-bold'
                : isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <FileArchive className="w-6 h-6" />
            <div className="text-xs">2. ZIP Upload</div>
            <div className="text-[10px] text-slate-500 font-mono">Extracts & Scans .zip</div>
          </button>

          <button
            type="button"
            onClick={() => { setInputType('local'); setError(''); }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              inputType === 'local'
                ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10 font-bold'
                : isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Folder className="w-6 h-6" />
            <div className="text-xs">3. Local Project</div>
            <div className="text-[10px] text-slate-500 font-mono">100% Offline Path</div>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-0.5">Scanner Configuration Alert</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Dynamic Form Input */}
        <form onSubmit={handleStartScan} className="mt-6 space-y-6">
          {/* Pre-Scan Application & Business Criticality Metadata */}
          <div className={`p-4 border rounded-xl space-y-4 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between">
              <span>Application Metadata & Business Criticality</span>
              <span className="text-[10px] text-slate-500 font-normal">Pre-Scan Evaluation Input</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Application Name
                </label>
                <input
                  type="text"
                  value={applicationName}
                  onChange={(e) => setApplicationName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="Payment Core Gateway"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Application Type
                </label>
                <select
                  value={applicationType}
                  onChange={(e) => setApplicationType(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Web Service / Microservice">Web Service / Microservice</option>
                  <option value="Mobile App (iOS/Android)">Mobile App (iOS/Android)</option>
                  <option value="Desktop Application">Desktop Application</option>
                  <option value="Embedded Firmware / IoT">Embedded Firmware / IoT</option>
                  <option value="Cloud Infrastructure / Terraform">Cloud Infrastructure / Terraform</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Business Criticality
                </label>
                <select
                  value={businessCriticality}
                  onChange={(e) => setBusinessCriticality(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 ${
                    businessCriticality === 'Critical'
                      ? 'bg-red-500/10 border-red-500/50 text-red-400'
                      : businessCriticality === 'High'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : businessCriticality === 'Medium'
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                          : isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="Critical" className="text-red-400 bg-slate-900">Critical (Core Payment / PII / Auth)</option>
                  <option value="High" className="text-amber-400 bg-slate-900">High (Customer Facing / Backend APIs)</option>
                  <option value="Medium" className="text-blue-400 bg-slate-900">Medium (Internal Tooling / Reporting)</option>
                  <option value="Low" className="text-slate-400 bg-slate-900">Low (Dev / Test Scratchpad)</option>
                </select>
              </div>
            </div>
          </div>
          {/* TAB 1: GITHUB URL */}
          {inputType === 'github' && (
            <div className="space-y-2">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                GitHub Repository URL
              </label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className={`w-full border rounded-lg pl-10 pr-4 py-3 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="https://github.com/username/repository"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Requires network connection only to fetch repository. Derived target path generated automatically.
              </p>
            </div>
          )}

          {/* TAB 2: ZIP UPLOAD */}
          {inputType === 'zip' && (
            <div className="space-y-3">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Upload Project ZIP File
              </label>
              <div className={`p-6 border-2 border-dashed rounded-xl text-center space-y-2 cursor-pointer relative transition-colors ${
                isDark ? 'bg-slate-950 border-slate-800 hover:border-blue-500/50' : 'bg-slate-50 border-slate-300 hover:border-blue-500/50'
              }`}>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-blue-400 mx-auto" />
                <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  {zipFile ? zipFile.name : 'Click or drag a .zip file here'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {uploadingZip ? 'Uploading ZIP to secure temporary space...' : uploadedZipPath ? '✓ ZIP Archive Ready for Offline Scan' : 'Works 100% Offline'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOCAL PROJECT */}
          {inputType === 'local' && (
            <div className="space-y-3">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Local Project Path / Folder Selection
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Folder className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className={`w-full border rounded-lg pl-10 pr-4 py-3 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                    placeholder="sample_targets"
                    required
                  />
                </div>
                <input
                  type="file"
                  ref={scanFolderInputRef}
                  onChange={handleScanFolderSelect}
                  style={{ display: 'none' }}
                  webkitdirectory=""
                  directory=""
                  multiple
                />
                <button
                  type="button"
                  onClick={() => scanFolderInputRef.current?.click()}
                  disabled={uploadingFolder}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-2 shrink-0 shadow transition-colors"
                >
                  {uploadingFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4" />
                  )}
                  <span>{uploadingFolder ? 'Loading Folder...' : 'Open Folder'}</span>
                </button>
              </div>
              <p className="text-[11px] text-emerald-500 font-mono">
                ✓ 100% Offline Mode: Specify a local directory path or click [Open Folder] to pick a folder from your filesystem.
              </p>
            </div>
          )}

          {/* N4-7 Category Pipelines Progress Animation Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                N4-7 Category Pipelines (Sequential Processing)
              </label>
              {isScanning && (
                <span className="text-xs text-blue-400 font-mono flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing Step {activeStep} / 7...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {categoriesList.map((cat) => {
                const isCurrent = isScanning && activeStep === cat.id;
                const isCompleted = (isScanning && activeStep > cat.id) || (scanResult && !isScanning);

                return (
                  <div
                    key={cat.id}
                    className={`p-3 rounded-xl border transition-all duration-300 flex items-start gap-2.5 ${
                      isCurrent
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/50 animate-pulse font-bold'
                        : isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                          : isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-400'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {isCurrent ? (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="font-semibold">{cat.name}</div>
                      <div className="text-[10px] opacity-75 font-mono">{cat.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isScanning || uploadingZip}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing Cryptographic Scan Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>START SCAN</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Real-time Scan Completed Results Banner */}
      {scanResult && (
        <div className={`border rounded-xl p-6 shadow-xl space-y-4 ${
          isDark ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-emerald-300'
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Scan Completed Successfully!</h2>
              {scanResult.findings.length === 0 ? (
                <p className="text-xs font-semibold text-emerald-400">Scan completed — No cryptographic components detected.</p>
              ) : (
                <p className="text-xs text-slate-400">Scan ID: #{scanResult.scan.id} • Pipeline Mode: {scanResult.scan.scan_type}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center font-mono">
            <div className={`p-3 border rounded-lg ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{scanResult.assets.length}</div>
              <div className="text-xs text-slate-400 font-sans">Discovered Assets</div>
            </div>
            <div className={`p-3 border rounded-lg ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-2xl font-bold text-amber-400">{scanResult.findings.length}</div>
              <div className="text-xs text-slate-400 font-sans">Findings Detected</div>
            </div>
            <div className={`p-3 border rounded-lg ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-2xl font-bold text-red-400">{scanResult.scan.risk_score}/10</div>
              <div className="text-xs text-slate-400 font-sans">Quantum Risk Score</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors"
            >
              Open Dashboard
            </button>
            <button
              onClick={() => setActiveTab('code_edit')}
              className={`flex-1 font-bold py-2.5 rounded-lg text-xs transition-colors ${
                isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
              }`}
            >
              Open Code Edit Workspace
            </button>
          </div>
        </div>
      )}

      {/* Requirement 14: Pre-Scan Confirmation Modal */}
      {showConfirmationModal && pendingPayload && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-blue-600/10 border border-blue-500/30 rounded-lg text-blue-400">
                <Play className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Confirm Scan Parameters</h3>
                <p className="text-xs text-slate-400">Verify source & local execution parameters</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className={`p-3 border rounded-xl flex items-center justify-between ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-400 font-sans font-semibold">Source Type:</span>
                <span className="font-bold text-blue-400 uppercase">{pendingPayload.input_type}</span>
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-400 font-sans font-semibold">Target Project:</span>
                <span className="font-bold text-emerald-400">{pendingPayload.application_name}</span>
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-slate-400 font-sans font-semibold">Configured Scan Mode:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  deploymentMode === 'local' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  {deploymentMode === 'local' ? 'LOCAL OFFLINE MODE' : 'CLOUD EXTERNAL MODE'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeScanLaunch}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-blue-600/20"
              >
                Start Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
