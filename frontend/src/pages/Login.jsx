import React, { useState } from 'react';
import api from '../api';
import SH164Badge from '../components/SH164Badge';
import { Shield, Lock, User, KeyRound } from 'lucide-react';

export default function Login({ onLoginSuccess, switchToRegister, authError }) {
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('ecdat_token', res.data.token);
      onLoginSuccess(res.data.user);
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Backend API service unreachable. Ensure backend server is running.');
      } else {
        setError(err.response?.data?.error || 'Login failed. Verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2 bg-slate-950 border border-cyan-500/30 rounded-2xl mb-3 shadow-lg shadow-cyan-500/10">
            <img src="/mox_logo.jpg" alt="M-O-X Logo" className="w-16 h-16 object-contain rounded-xl" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-wider text-white">M-O-X Local Portal</h1>
            <SH164Badge size="sm" />
          </div>
          <p className="text-xs text-slate-400">Cryptographic Intelligence For A Safer Tomorrow</p>
          <div className="inline-block mt-3 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-full font-mono">
            LOCAL-ONLY MODE • PRIVACY-FIRST
          </div>
        </div>

        {displayError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg text-center font-mono">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Username or Email</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-600/20"
          >
            <KeyRound className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Sign In to M-O-X'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Need a local analyst account?{' '}
          <button onClick={switchToRegister} className="text-blue-400 hover:underline">
            Register here
          </button>
        </div>
      </div>
    </div>
  );
}
