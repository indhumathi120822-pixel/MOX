import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  Activity, Plus, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw,
  Trash2, GitBranch, Github, Folder, Upload, Play, Pause, Eye,
  Bell, AlertTriangle, Layers, Lock, Cpu, Server, Key, Network,
  FileCode, Check, X, ChevronRight, Clock, ArrowUpRight
} from 'lucide-react';

export default function Monitoring({ currentProject, theme = 'dark' }) {
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Add Project Form State
  const [addSourceType, setAddSourceType] = useState('github'); // 'github' | 'local' | 'upload'
  const [projectName, setProjectName] = useState('');
  const [sourceRef, setSourceRef] = useState('https://github.com/enterprise/crypto-service');
  const [branch, setBranch] = useState('main');
  const [selectedZipFile, setSelectedZipFile] = useState(null);
  const [addingProject, setAddingProject] = useState(false);

  // Status & Feedback Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [scanningProjectId, setScanningProjectId] = useState(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [projRes, notifRes] = await Promise.all([
        api.get('/monitoring/projects'),
        api.get('/monitoring/notifications')
      ]);
      setProjects(projRes.data.projects || []);
      setNotifications(notifRes.data.notifications || []);
    } catch (err) {
      console.error('[Watchlist] Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceTypeSelect = (type) => {
    setAddSourceType(type);
    setSelectedZipFile(null);
    if (type === 'github') {
      setProjectName('E-Commerce Payment Gateway');
      setSourceRef('https://github.com/enterprise/payment-service');
    } else if (type === 'local') {
      setProjectName('Local Java Security Module');
      setSourceRef('sample_targets');
    } else if (type === 'upload') {
      setProjectName('Target Crypto App');
      setSourceRef('');
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (addSourceType === 'upload') {
      if (!selectedZipFile) {
        setErrorMessage('Please select a valid .zip project file from your computer.');
        return;
      }

      if (!selectedZipFile.name.toLowerCase().endsWith('.zip')) {
        setErrorMessage('Selected file is not a valid .zip archive. Please select a file with .zip extension.');
        return;
      }

      setAddingProject(true);
      try {
        const formData = new FormData();
        formData.append('zip_file', selectedZipFile);
        formData.append('name', projectName.trim() || selectedZipFile.name.replace(/\.zip$/i, ''));

        const res = await api.post('/monitoring/projects/upload-zip', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setSuccessMessage(res.data.message || `ZIP Project '${projectName}' successfully uploaded, extracted, and scanned!`);
        setShowAddModal(false);
        setProjectName('');
        setSelectedZipFile(null);
        loadDashboardData();
      } catch (err) {
        setErrorMessage(err.response?.data?.error || 'Failed to upload or extract ZIP project.');
      } finally {
        setAddingProject(false);
      }
      return;
    }

    if (!projectName.trim() || !sourceRef.trim()) return;

    setAddingProject(true);
    try {
      const res = await api.post('/monitoring/projects', {
        name: projectName.trim(),
        source_type: addSourceType,
        source_reference: sourceRef.trim(),
        branch: branch.trim()
      });

      setSuccessMessage(res.data.message || `Project '${projectName}' added to Watchlist!`);
      setShowAddModal(false);
      setProjectName('');
      loadDashboardData();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to add project to monitoring watchlist.');
    } finally {
      setAddingProject(false);
    }
  };

  const handleScanNow = async (projectId, projName) => {
    setScanningProjectId(projectId);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await api.post(`/monitoring/projects/${projectId}/scan-now`);
      setSuccessMessage(`Re-scan completed for '${projName}': ${res.data.message}`);
      loadDashboardData();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || `Failed to re-scan project '${projName}'.`);
    } finally {
      setScanningProjectId(null);
    }
  };

  const handleTogglePause = async (project) => {
    try {
      if (project.status === 'PAUSED') {
        await api.post(`/monitoring/projects/${project.id}/resume`);
      } else {
        await api.post(`/monitoring/projects/${project.id}/pause`);
      }
      loadDashboardData();
    } catch (err) {
      console.error('Failed to toggle pause status:', err);
    }
  };

  const handleRemoveProject = async (projectId) => {
    try {
      await api.delete(`/monitoring/projects/${projectId}`);
      setProjectToDelete(null);
      setSuccessMessage('Project successfully removed from Watchlist.');
      loadDashboardData();
    } catch (err) {
      setErrorMessage('Failed to remove project from watchlist.');
    }
  };

  const handleViewProjectDetails = async (projectId) => {
    try {
      const res = await api.get(`/monitoring/projects/${projectId}`);
      setSelectedProjectDetails(res.data);
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  const handleReviewNotification = async (notifId, action) => {
    try {
      await api.post(`/monitoring/notifications/${notifId}/review`, { action });
      loadDashboardData();
    } catch (err) {
      console.error('Failed to update notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;
  const activeCount = projects.filter(p => p.status === 'ACTIVE').length;
  const staticCount = projects.filter(p => p.status === 'STATIC_UPLOAD').length;
  const criticalProjectsCount = projects.filter(p => p.risk_level === 'Critical' || p.risk_level === 'High').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className={`border rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-6 h-6 text-blue-500 animate-pulse" />
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Enterprise Project Security Watchlist & Monitoring
            </h1>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Continuous cryptographic baseline tracking, drift detection, and posture change alerts across all 7 pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNotificationDrawer(true)}
            className={`relative px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-colors ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Project</span>
          </button>
        </div>
      </div>

      {/* Global Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Monitored Projects</span>
            <Folder className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-400">{projects.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">{activeCount} Active Watchers | {staticCount} Static Uploads</div>
        </div>

        <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">High / Critical Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-red-400">{criticalProjectsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Requires Security Attention</div>
        </div>

        <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Unread Notifications</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-400">{unreadCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cryptographic Posture Diffs</div>
        </div>

        <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Engine Status</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">7-Pipeline Active</div>
          <div className="text-[11px] text-slate-500 mt-1">Local & Offline Protection</div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center justify-between font-mono font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center justify-between font-mono font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Project Watchlist Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Activity className="w-4 h-4 text-blue-400" />
            Monitored Security Watchlist
          </h2>
          <span className="text-xs text-slate-500 font-mono">{projects.length} Projects Configured</span>
        </div>

        {loading ? (
          <div className={`p-12 text-center border rounded-xl text-xs font-mono animate-pulse ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
            Loading Watchlist & Cryptographic Posture States...
          </div>
        ) : projects.length === 0 ? (
          <div className={`p-12 text-center border rounded-xl space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Folder className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>No Monitored Projects Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add your GitHub repositories, local source folders, or artifact packages to continuously track cryptographic drift and security posture.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              Add First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => {
              const isScanning = scanningProjectId === proj.id;
              return (
                <div
                  key={proj.id}
                  className={`border rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all hover:border-slate-700 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Card Top Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {proj.source_type === 'github' && <Github className="w-4 h-4 text-purple-400 shrink-0" />}
                        {proj.source_type === 'local' && <Folder className="w-4 h-4 text-blue-400 shrink-0" />}
                        {proj.source_type === 'upload' && <Upload className="w-4 h-4 text-emerald-400 shrink-0" />}
                        <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`} title={proj.name}>
                          {proj.name}
                        </h3>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border shrink-0 ${
                        proj.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : proj.status === 'STATIC_UPLOAD'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        {proj.status === 'STATIC_UPLOAD' ? 'Static Upload' : proj.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate mt-1.5" title={proj.source_reference}>
                      {proj.source_type === 'github' ? `Git (${proj.branch}): ${proj.source_reference}` : proj.source_reference}
                    </div>
                  </div>

                  {/* Security Posture Metrics */}
                  <div className={`p-3 rounded-xl border text-xs font-mono space-y-2 ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Risk Posture:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        proj.risk_level === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        proj.risk_level === 'High' ? 'bg-amber-500/20 text-amber-400' :
                        proj.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {proj.risk_level || 'Low'} Risk
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Quantum Status:</span>
                      <span className="text-slate-200 font-semibold text-[11px]">{proj.quantum_status || 'Quantum Safe'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                      <span className="text-slate-400">Crypto Findings:</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-red-400">{proj.critical_count || 0} Critical</span>
                        <span>•</span>
                        <span className="text-amber-400">{proj.high_count || 0} High</span>
                        <span>•</span>
                        <span className="text-slate-300">{proj.total_findings || 0} Total</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Actions */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Last Checked: {new Date(proj.last_check_time || proj.created_at).toLocaleDateString()}
                      </span>
                      {proj.unread_notifications_count > 0 && (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Bell className="w-3 h-3" /> {proj.unread_notifications_count} Diffs
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => handleScanNow(proj.id, proj.name)}
                        disabled={isScanning}
                        title="Re-scan and compare against baseline"
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-semibold p-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                        <span>Scan</span>
                      </button>

                      <button
                        onClick={() => handleViewProjectDetails(proj.id)}
                        title="View baseline details and 7-pipeline inventory"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold p-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => handleTogglePause(proj)}
                        title={proj.status === 'PAUSED' ? 'Resume monitoring' : 'Pause monitoring'}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold p-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        {proj.status === 'PAUSED' ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{proj.status === 'PAUSED' ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        onClick={() => setProjectToDelete(proj)}
                        title="Remove from watchlist"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold p-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD PROJECT MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-xl border rounded-2xl p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Add Project to Cryptographic Watchlist
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Selection Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSourceTypeSelect('github')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  addSourceType === 'github'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-lg shadow-purple-600/10'
                    : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <Github className="w-5 h-5" />
                <span>GitHub Repo</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceTypeSelect('local')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  addSourceType === 'local'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-lg shadow-blue-600/10'
                    : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <Folder className="w-5 h-5" />
                <span>Local Project</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceTypeSelect('upload')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  addSourceType === 'upload'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-600/10'
                    : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <Upload className="w-5 h-5" />
                <span>Upload ZIP Project</span>
              </button>
            </div>

            <form onSubmit={handleAddProject} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Banking API Service"
                  className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              {addSourceType === 'github' && (
                <>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">GitHub Repository URL</label>
                    <input
                      type="url"
                      value={sourceRef}
                      onChange={(e) => setSourceRef(e.target.value)}
                      placeholder="https://github.com/user/project"
                      className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-300">Target Branch</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </>
              )}

              {addSourceType === 'local' && (
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">Local Folder Path</label>
                  <input
                    type="text"
                    value={sourceRef}
                    onChange={(e) => setSourceRef(e.target.value)}
                    placeholder="e.g. C:\Projects\BankingAPI or sample_targets"
                    className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
              )}

              {addSourceType === 'upload' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300">Select .ZIP Project Archive</label>
                  <div className={`p-4 border-2 border-dashed rounded-xl text-center space-y-2 cursor-pointer transition-colors ${
                    selectedZipFile ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-slate-800 hover:border-slate-700 bg-slate-950' : 'border-slate-300 bg-slate-50'
                  }`}>
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      id="zipFileInput"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setSelectedZipFile(file);
                          if (!projectName || projectName === 'Target Crypto App') {
                            setProjectName(file.name.replace(/\.zip$/i, ''));
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="zipFileInput" className="cursor-pointer block space-y-1">
                      <Upload className="w-8 h-8 mx-auto text-emerald-400 animate-bounce" />
                      <div className="text-xs font-bold text-emerald-300">
                        {selectedZipFile ? selectedZipFile.name : 'Click to select .ZIP project file from your computer'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {selectedZipFile ? `${(selectedZipFile.size / 1024).toFixed(1)} KB` : 'Accepts valid .zip archives up to 100MB'}
                      </div>
                    </label>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-xl font-mono">
                    ℹ️ ZIP archive will be safely extracted into project workspace preserving full directory structure, scanned, and added to Monitoring Watchlist.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingProject}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {addingProject ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{addingProject ? 'Analyzing Baseline...' : 'Add to Watchlist'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOTIFICATION CENTER DRAWER */}
      {/* ========================================================================= */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-md h-full border-l p-6 shadow-2xl flex flex-col justify-between space-y-4 overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div>
              <div className="flex items-center justify-between border-b pb-4 border-slate-800">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  Security Notification Center
                </h3>
                <button onClick={() => setShowNotificationDrawer(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 pt-4">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-400">
                    No cryptographic posture changes recorded yet.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border rounded-xl text-xs font-mono space-y-2.5 ${
                        notif.status === 'UNREAD'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white text-xs">{notif.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          notif.priority === 'P1' ? 'bg-red-500/30 text-red-300' :
                          notif.priority === 'P2' ? 'bg-amber-500/30 text-amber-300' : 'bg-blue-500/30 text-blue-300'
                        }`}>
                          {notif.priority || 'P3'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">{notif.description}</p>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Project: {notif.project_name}</span>
                        <span>{new Date(notif.created_at).toLocaleTimeString()}</span>
                      </div>

                      {notif.status === 'UNREAD' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => handleReviewNotification(notif.id, 'mark_reviewed')}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-3 py-1 rounded text-[10px] font-bold"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            onClick={() => handleReviewNotification(notif.id, 'dismiss')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1 rounded text-[10px]"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowNotificationDrawer(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold"
            >
              Close Notifications
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROJECT DETAILS DRAWER */}
      {/* ========================================================================= */}
      {selectedProjectDetails && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-2xl h-full border-l p-6 shadow-2xl flex flex-col justify-between space-y-4 overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-4 border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedProjectDetails.project.name}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{selectedProjectDetails.project.source_reference}</div>
                </div>
                <button onClick={() => setSelectedProjectDetails(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Overview Metrics */}
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Risk Level</div>
                  <div className="text-base font-bold text-red-400 mt-1">{selectedProjectDetails.project.risk_level}</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Quantum Posture</div>
                  <div className="text-sm font-bold text-blue-400 mt-1">{selectedProjectDetails.project.quantum_status}</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Total Findings</div>
                  <div className="text-base font-bold text-amber-400 mt-1">{selectedProjectDetails.project.total_findings}</div>
                </div>
              </div>

              {/* Baseline Findings Snapshot */}
              {selectedProjectDetails.latest_baseline && selectedProjectDetails.latest_baseline.findings && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Cryptographic Baseline Inventory ({selectedProjectDetails.latest_baseline.findings.length} Items)
                  </h4>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {selectedProjectDetails.latest_baseline.findings.map((f, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-400">{f.algorithm || 'Primitive'}</span>
                          <span className="text-[10px] text-slate-400">{f.category}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">{f.title}</div>
                        <div className="text-[10px] text-slate-500 truncate">{f.location}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedProjectDetails(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Remove Project from Watchlist
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{projectToDelete.name}</strong> from your cryptographic monitoring watchlist?
            </p>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl font-mono">
              ℹ️ Note: This will remove the monitoring record and notification history from ECDAT. Your actual project files on disk or remote repository will remain completely untouched.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveProject(projectToDelete.id)}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-lg shadow-red-600/20"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

