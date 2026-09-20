import React, { useState, useEffect } from 'react';
import api from '../api';
import { Layers, CheckCircle2, Clock } from 'lucide-react';

export default function Migration({ currentProject }) {
  const [waves, setWaves] = useState([]);

  useEffect(() => {
    if (currentProject) {
      api.get(`/migration/project/${currentProject.id}`).then(res => setWaves(res.data.waves || []));
    }
  }, [currentProject]);

  const toggleStatus = async (wave) => {
    const nextStatus = wave.status === 'Completed' ? 'In Progress' : 'Completed';
    await api.put(`/migration/${wave.id}`, { status: nextStatus });
    api.get(`/migration/project/${currentProject.id}`).then(res => setWaves(res.data.waves || []));
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-1">5-Wave PQC Migration Roadmap</h1>
        <p className="text-xs text-slate-400">
          Sequenced operational roadmap for transitioning enterprise cryptography to NIST finalized PQC standards
        </p>
      </div>

      <div className="space-y-4">
        {waves.map((wave) => (
          <div key={wave.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  wave.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  wave.priority === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {wave.priority}
                </span>
                <h3 className="text-base font-bold text-white">{wave.wave_title}</h3>
              </div>
              <p className="text-xs text-slate-300">{wave.description}</p>
            </div>

            <button
              onClick={() => toggleStatus(wave)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                wave.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {wave.status}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
