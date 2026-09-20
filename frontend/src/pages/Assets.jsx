import React, { useState, useEffect } from 'react';
import api from '../api';
import { Cpu, Edit3, Save, ShieldAlert } from 'lucide-react';

export default function Assets({ currentProject }) {
  const [assets, setAssets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editBC, setEditBC] = useState('Medium');
  const [editX, setEditX] = useState(5);
  const [editY, setEditY] = useState(2);

  useEffect(() => {
    if (currentProject) loadAssets();
  }, [currentProject]);

  const loadAssets = async () => {
    try {
      const res = await api.get(`/assets/project/${currentProject.id}`);
      setAssets(res.data.assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  const startEdit = (asset) => {
    setEditingId(asset.id);
    setEditBC(asset.business_criticality || 'Medium');
    setEditX(asset.data_lifetime || 5);
    setEditY(asset.migration_time || 2);
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/assets/${id}`, {
        business_criticality: editBC,
        data_lifetime: editX,
        migration_time: editY
      });
      setEditingId(null);
      loadAssets();
    } catch (err) {
      alert('Failed to update asset parameters.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Discovered Cryptographic Asset Inventory</h1>
          <p className="text-xs text-slate-400">Classified across 7 authoritative asset categories</p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          Total Discovered Assets: <strong className="text-blue-400">{assets.length}</strong>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Asset & Location</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Algorithm / Specs</th>
                <th className="px-4 py-3">Business Criticality</th>
                <th className="px-4 py-3">Data Lifetime (X)</th>
                <th className="px-4 py-3">Migration Time (Y)</th>
                <th className="px-4 py-3">Quantum Risk</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{asset.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs">{asset.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px]">
                      {asset.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <div className="text-blue-400 font-bold">{asset.algorithm}</div>
                    {asset.key_size && <div className="text-[10px] text-slate-500">{asset.key_size} bits</div>}
                  </td>

                  {/* Business Criticality */}
                  <td className="px-4 py-3">
                    {editingId === asset.id ? (
                      <select
                        value={editBC}
                        onChange={(e) => setEditBC(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        asset.business_criticality === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        asset.business_criticality === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {asset.business_criticality || 'Medium'}
                      </span>
                    )}
                  </td>

                  {/* Data Lifetime X */}
                  <td className="px-4 py-3 font-mono">
                    {editingId === asset.id ? (
                      <input
                        type="number"
                        value={editX}
                        onChange={(e) => setEditX(e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      <span>{asset.data_lifetime || 5} yrs</span>
                    )}
                  </td>

                  {/* Migration Time Y */}
                  <td className="px-4 py-3 font-mono">
                    {editingId === asset.id ? (
                      <input
                        type="number"
                        value={editY}
                        onChange={(e) => setEditY(e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      <span>{asset.migration_time || 2} yrs</span>
                    )}
                  </td>

                  {/* Quantum Risk */}
                  <td className="px-4 py-3 font-mono">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      asset.quantum_risk === 'Critical' || asset.quantum_risk === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {asset.quantum_risk || 'Low'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {editingId === asset.id ? (
                      <button
                        onClick={() => saveEdit(asset.id)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(asset)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
