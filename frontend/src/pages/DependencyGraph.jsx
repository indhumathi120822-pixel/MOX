import React, { useState, useEffect } from 'react';
import api from '../api';
import { GitFork, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

export default function DependencyGraph({ currentProject }) {
  const [edges, setEdges] = useState([]);
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    if (currentProject) {
      api.get(`/scans/project/${currentProject.id}`).then(res => {
        if (res.data.scans.length > 0) {
          const scanId = res.data.scans[0].id;
          api.get(`/cbom/scan/${scanId}`).then(cbomRes => {
            setNodes(cbomRes.data.cbom.nodes || []);
            setEdges(cbomRes.data.cbom.edges || []);
          });
        }
      });
    }
  }, [currentProject]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-1">Cryptographic Dependency & Impact Graph</h1>
        <p className="text-xs text-slate-400">
          Visual directional dependency graph illustrating direct/transitive relationships and replacement impacts.
        </p>
      </div>

      <div className="space-y-3">
        {edges.map((edge, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-lg font-bold">
                {edge.source_node}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md font-bold uppercase text-[10px]">
                {edge.relationship}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="p-2 bg-purple-600/10 border border-purple-500/30 text-purple-400 rounded-lg font-bold">
                {edge.target_node}
              </span>
            </div>

            <div className="text-slate-500 text-[11px]">Direct Dependency Impact</div>
          </div>
        ))}
      </div>
    </div>
  );
}
