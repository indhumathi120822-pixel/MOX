import React, { useState, useEffect } from 'react';
import api from './api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Assets from './pages/Assets';
import Findings from './pages/Findings';
import RiskAnalysis from './pages/RiskAnalysis';
import SemanticCBOM from './pages/SemanticCBOM';
import DependencyGraph from './pages/DependencyGraph';
import CertificatesPKI from './pages/CertificatesPKI';
import ProtocolTLS from './pages/ProtocolTLS';
import CVEs from './pages/CVEs';
import Recommendations from './pages/Recommendations';
import Migration from './pages/Migration';
import Remediation from './pages/Remediation';
import Verification from './pages/Verification';
import Monitoring from './pages/Monitoring';
import Reports from './pages/Reports';
import NistCenter from './pages/NistCenter';
import Settings from './pages/Settings';
import CodeEdit from './pages/CodeEdit';

import {
  Shield,
  LayoutDashboard,
  Play,
  Cpu,
  ShieldAlert,
  Activity,
  Network,
  GitFork,
  Award,
  Server,
  Database,
  Lightbulb,
  Layers,
  Wrench,
  CheckCircle2,
  FileText,
  FileCode,
  BookOpen,
  Settings as SettingsIcon,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [modeSelected, setModeSelected] = useState(() => localStorage.getItem('mbox_mode_selected') === 'true');
  const [deploymentMode, setDeploymentMode] = useState(() => localStorage.getItem('mbox_deployment_mode') || 'local');
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authView, setAuthView] = useState('login'); // login | register
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const [selectedFindingForEdit, setSelectedFindingForEdit] = useState(null);
  const [selectedPriorityForEdit, setSelectedPriorityForEdit] = useState('ALL');

  // Theme state: 'dark' | 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('mbox_theme') || 'dark');

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('mbox_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('mbox_deployment_mode', deploymentMode);
  }, [deploymentMode]);

  useEffect(() => {
    localStorage.setItem('mbox_mode_selected', modeSelected ? 'true' : 'false');
  }, [modeSelected]);

  const refreshLocalAnalystSession = async () => {
    try {
      const loginRes = await api.post('/auth/login', { username: 'analyst', password: 'password123' });
      if (loginRes.data && loginRes.data.token) {
        localStorage.setItem('ecdat_token', loginRes.data.token);
        setUser(loginRes.data.user);
        await loadProjects();
        return true;
      }
    } catch (e) {
      console.warn('[Session Refresh] Unable to auto-login default local analyst:', e);
    }
    return false;
  };

  useEffect(() => {
    const initAuth = async () => {
      let token = localStorage.getItem('ecdat_token');

      if (!token && deploymentMode === 'local') {
        const refreshed = await refreshLocalAnalystSession();
        if (refreshed) {
          setLoadingAuth(false);
          return;
        }
      }

      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
          await loadProjects();
        } catch (err) {
          console.error('Failed to restore session:', err);
          localStorage.removeItem('ecdat_token');
          
          if (deploymentMode === 'local') {
            const refreshed = await refreshLocalAnalystSession();
            if (refreshed) {
              setLoadingAuth(false);
              return;
            }
          }

          setUser(null);
          if (err.code === 'ERR_NETWORK' || !err.response) {
            setAuthError('Backend API Service Unreachable. Ensure backend server is running.');
          }
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    };

    initAuth();

    const handleSessionExpired = async () => {
      console.warn('[App] Received session expiration event.');
      if (deploymentMode === 'local') {
        const refreshed = await refreshLocalAnalystSession();
        if (!refreshed) setUser(null);
      } else {
        setUser(null);
      }
    };

    window.addEventListener('ecdat_session_expired', handleSessionExpired);
    return () => window.removeEventListener('ecdat_session_expired', handleSessionExpired);
  }, [deploymentMode]);

  const loadProjects = async () => {
    try {
      const res = await api.get('/projects');
      const loadedProjects = res.data.projects || [];
      if (loadedProjects.length > 0) {
        setProjects(loadedProjects);
        setCurrentProject(loadedProjects[0]);
      } else {
        // Automatically create a default project if none exists for this user
        const createRes = await api.post('/projects', {
          name: 'Default Enterprise Project',
          description: 'Local cryptographic discovery & analysis target'
        });
        if (createRes.data && createRes.data.project) {
          setProjects([createRes.data.project]);
          setCurrentProject(createRes.data.project);
        } else {
          const fallback = { id: 1, name: 'Default Enterprise Project', description: 'Local Project' };
          setProjects([fallback]);
          setCurrentProject(fallback);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      const fallback = { id: 1, name: 'Default Enterprise Project', description: 'Local Project' };
      setProjects([fallback]);
      setCurrentProject(fallback);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ecdat_token');
    setUser(null);
    setProjects([]);
    setCurrentProject(null);
  };

  // STEP 1 — MOX Splash Screen (Requirement 1)
  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex flex-col items-center justify-center text-[#E6EBF5] p-6 font-sans relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center max-w-lg text-center">
          <div className="p-3 bg-[#111A2B] border border-[#22304A] rounded-2xl mb-6 shadow-xl">
            <img src="/mox_logo.jpg" alt="MOX Logo" className="w-40 h-40 object-contain rounded-xl" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-widest text-[#E6EBF5] mb-2">
            MOX
          </h1>
          <p className="text-xs font-mono tracking-wider text-[#2BB6A3] uppercase mb-6 font-bold">
            Enterprise Cryptographic Intelligence & Risk Engine
          </p>
          <div className="w-48 h-1.5 bg-[#16223A] rounded-full overflow-hidden">
            <div className="h-full bg-[#2BB6A3] w-full animate-pulse"></div>
          </div>
          <p className="text-[11px] text-[#93A0B8] font-mono mt-4">Initializing Security Boundary...</p>
        </div>
      </div>
    );
  }

  // STEP 2 — Mode Selection (Requirement 1)
  if (!modeSelected) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex flex-col items-center justify-center text-[#E6EBF5] p-6 font-sans relative">
        <div className="max-w-2xl w-full bg-[#111A2B] border border-[#22304A] rounded-2xl p-8 shadow-xl text-center space-y-6">
          <div className="flex flex-col items-center">
            <img src="/mox_logo.jpg" alt="MOX Logo" className="w-20 h-20 object-contain rounded-xl mb-3 border border-[#22304A] shadow-md" />
            <h2 className="text-2xl font-extrabold tracking-wide text-[#E6EBF5]">How do you want to run the scan?</h2>
            <p className="text-xs text-[#93A0B8] font-mono mt-1">Select execution mode for this session</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <button
              onClick={() => {
                setDeploymentMode('local');
                setModeSelected(true);
                setActiveTab('scan');
              }}
              className="p-6 bg-[#0B1220] hover:bg-[#16223A] border border-[#22304A] hover:border-[#2BB6A3] rounded-xl transition-all space-y-3 group text-left"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-[#4CB782]/10 border border-[#4CB782]/30 text-[#4CB782] text-xs font-mono font-bold rounded-full">
                  LOCAL / OFFLINE
                </span>
                <Shield className="w-6 h-6 text-[#4CB782]" />
              </div>
              <h3 className="text-base font-bold text-[#E6EBF5] group-hover:text-[#2BB6A3] transition-colors">LOCAL / OFFLINE MODE</h3>
              <p className="text-xs text-[#93A0B8] leading-relaxed">
                Source code remains local. Scanning and remediation operate locally wherever supported. Zero external upload required.
              </p>
            </button>

            <button
              onClick={() => {
                setDeploymentMode('cloud');
                setModeSelected(true);
                setActiveTab('scan');
              }}
              className="p-6 bg-[#0B1220] hover:bg-[#16223A] border border-[#22304A] hover:border-[#F59E0B] rounded-xl transition-all space-y-3 group text-left"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-mono font-bold rounded-full">
                  CLOUD PROCESSING
                </span>
                <Server className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h3 className="text-base font-bold text-[#E6EBF5] group-hover:text-[#F59E0B] transition-colors">CLOUD MODE</h3>
              <p className="text-xs text-[#93A0B8] leading-relaxed">
                Use the cloud configuration of the application. Cloud processing and remote target intelligence are active.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3 — Authentication (Requirement 1)
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex flex-col items-center justify-center text-[#E6EBF5] font-sans">
        <div className="p-3 bg-[#111A2B] border border-[#22304A] rounded-2xl mb-4 shadow-md">
          <img src="/mox_logo.jpg" alt="MOX Logo" className="w-16 h-16 object-contain rounded-xl" />
        </div>
        <div className="font-extrabold text-xl tracking-wider mb-1 flex items-center gap-2">
          <span>MOX</span>
          <span className="text-xs bg-[#2BB6A3]/10 text-[#2BB6A3] border border-[#2BB6A3]/30 px-2 py-0.5 rounded font-mono font-bold">
            ENTERPRISE
          </span>
        </div>
        <div className="text-xs text-[#93A0B8] font-mono">Initializing Local Cryptographic Engine...</div>
      </div>
    );
  }

  if (!user) {
    return authView === 'login' ? (
      <Login
        onLoginSuccess={async (u) => { setUser(u); setAuthError(''); await loadProjects(); }}
        switchToRegister={() => setAuthView('register')}
        authError={authError}
      />
    ) : (
      <Register
        onRegisterSuccess={async (u) => { setUser(u); setAuthError(''); await loadProjects(); }}
        switchToLogin={() => setAuthView('login')}
      />
    );
  }

  const navItems = [
    { id: 'scan', label: '1. Scan Source', icon: Play },
    { id: 'dashboard', label: '2. Dashboard', icon: LayoutDashboard },
    { id: 'code_edit', label: '3. Code Edit', icon: FileCode },
    { id: 'monitoring', label: '4. Local Monitoring', icon: Activity },
    { id: 'reports', label: '5. History / Reports', icon: FileText },
  ];

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-[#0B1220] text-[#E6EBF5]' : 'bg-[#F4F6F9] text-[#0F172A]'
    }`}>
      {/* Top Header Bar */}
      <header className={`h-16 border-b px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm ${
        isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[#0B1220] border border-[#22304A] rounded-xl">
            <img src="/mox_logo.jpg" alt="MOX Logo" className="w-8 h-8 object-contain rounded-lg" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide flex items-center gap-2">
              <span className={isDark ? 'text-[#E6EBF5]' : 'text-[#0F172A]'}>MOX</span>
              <span className="text-[10px] bg-[#2BB6A3]/10 text-[#2BB6A3] border border-[#2BB6A3]/30 px-2 py-0.5 rounded font-mono font-bold">
                ENTERPRISE
              </span>
            </div>
            <div className={`text-[11px] font-mono ${isDark ? 'text-[#93A0B8]' : 'text-[#5A6A85]'}`}>
              Cryptographic Intelligence For A Safer Tomorrow • NIST Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {deploymentMode === 'local' ? (
            <div className="px-3 py-1 bg-[#4CB782]/10 border border-[#4CB782]/30 text-[#4CB782] text-xs rounded-full font-mono flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4CB782] animate-pulse"></span>
              LOCAL MODE — OFFLINE / DATA STAYS ON THIS SYSTEM
            </div>
          ) : (
            <div className="px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs rounded-full font-mono flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"></span>
              CLOUD MODE — DATA MAY BE STORED EXTERNALLY
            </div>
          )}

          {/* Theme Quick Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-lg border transition-colors ${
              isDark ? 'bg-[#16223A] border-[#22304A] text-[#F59E0B] hover:bg-[#22304A]' : 'bg-[#EAEFF6] border-[#D0D9E5] text-[#2BB6A3] hover:bg-[#D0D9E5]'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-lg border transition-colors ${
              activeTab === 'settings'
                ? 'bg-[#2BB6A3] text-slate-950 font-bold border-[#2BB6A3]'
                : isDark
                  ? 'bg-[#16223A] border-[#22304A] text-[#93A0B8] hover:text-[#E6EBF5] hover:bg-[#22304A]'
                  : 'bg-[#EAEFF6] border-[#D0D9E5] text-[#5A6A85] hover:bg-[#D0D9E5]'
            }`}
            title="Settings & Deployment Mode"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-[#93A0B8] hover:text-[#F0504A] hover:bg-[#16223A]' : 'text-[#5A6A85] hover:text-[#F0504A] hover:bg-[#EAEFF6]'
            }`}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className={`w-64 border-r p-4 space-y-4 overflow-y-auto shrink-0 flex flex-col justify-between ${
          isDark ? 'bg-[#111A2B] border-[#22304A]' : 'bg-white border-[#D0D9E5]'
        }`}>
          <div className="space-y-1">
            <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
              isDark ? 'text-[#93A0B8]' : 'text-[#5A6A85]'
            }`}>
              Primary Categories
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#2BB6A3] text-slate-950 shadow-md'
                      : isDark
                        ? 'text-[#93A0B8] hover:text-[#E6EBF5] hover:bg-[#16223A]'
                        : 'text-[#5A6A85] hover:text-[#0F172A] hover:bg-[#EAEFF6]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#22304A]/60">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-[#2BB6A3] text-slate-950 shadow-md'
                  : isDark
                    ? 'text-[#93A0B8] hover:text-[#E6EBF5] hover:bg-[#16223A]'
                    : 'text-[#5A6A85] hover:text-[#0F172A] hover:bg-[#EAEFF6]'
              }`}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 p-8 overflow-y-auto ${
          isDark ? 'bg-[#0B1220]' : 'bg-[#F4F6F9]'
        }`}>
          {activeTab === 'dashboard' && (
            <Dashboard
              currentProject={currentProject}
              setActiveTab={setActiveTab}
              onOpenCodeEdit={(finding, prioFilter) => {
                setSelectedFindingForEdit(finding);
                setSelectedPriorityForEdit(prioFilter || 'ALL');
                setActiveTab('code_edit');
              }}
              theme={theme}
            />
          )}
          {activeTab === 'scan' && <Scan currentProject={currentProject} setActiveTab={setActiveTab} theme={theme} />}
          {activeTab === 'code_edit' && (
            <CodeEdit
              currentProject={currentProject}
              initialFinding={selectedFindingForEdit}
              initialPriorityFilter={selectedPriorityForEdit || 'ALL'}
              theme={theme}
            />
          )}
          {activeTab === 'risk' && <RiskAnalysis currentProject={currentProject} theme={theme} />}
          {activeTab === 'dependency' && <DependencyGraph currentProject={currentProject} theme={theme} />}
          {activeTab === 'certs' && <CertificatesPKI currentProject={currentProject} theme={theme} />}
          {activeTab === 'tls' && <ProtocolTLS currentProject={currentProject} theme={theme} />}
          {activeTab === 'cve' && <CVEs theme={theme} />}
          {activeTab === 'recommendations' && <Recommendations currentProject={currentProject} theme={theme} />}
          {activeTab === 'migration' && <Migration currentProject={currentProject} theme={theme} />}
          {activeTab === 'verification' && <Verification currentProject={currentProject} theme={theme} />}
          {activeTab === 'monitoring' && <Monitoring currentProject={currentProject} theme={theme} />}
          {activeTab === 'reports' && <Reports currentProject={currentProject} theme={theme} />}
          {activeTab === 'nist' && <NistCenter theme={theme} />}
          {activeTab === 'settings' && (
            <Settings
              user={user}
              onLogout={handleLogout}
              theme={theme}
              setTheme={setTheme}
              deploymentMode={deploymentMode}
              setDeploymentMode={setDeploymentMode}
              currentProject={currentProject}
              setActiveTab={setActiveTab}
              onOpenCodeEdit={(finding, prioFilter) => {
                setSelectedFindingForEdit(finding);
                setSelectedPriorityForEdit(prioFilter || 'ALL');
                setActiveTab('code_edit');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
