import React, { useState, useEffect } from 'react';
import api from '../api';
import { Wrench, CheckCircle2, ShieldAlert, ArrowRight, Download } from 'lucide-react';

export default function Remediation({ currentProject, selectedFindingId, setActiveTab }) {
  const [finding, setFinding] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [backupPath, setBackupPath] = useState('');

  useEffect(() => {
    if (selectedFindingId) {
      loadPreview(selectedFindingId);
    } else if (currentProject) {
      // Pick first finding as default
      api.get(`/scans/project/${currentProject.id}`).then(res => {
        if (res.data.scans.length > 0) {
          api.get(`/scans/${res.data.scans[0].id}`).then(scanRes => {
            if (scanRes.data.findings.length > 0) {
              loadPreview(scanRes.data.findings[0].id);
            }
          });
        }
      });
    }
  }, [selectedFindingId, currentProject]);

  const loadPreview = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/remediation/preview/${id}`);
      setFinding(res.data.finding);
      setPreview(res.data);
      setApplied(res.data.finding.remediation_status === 'Applied');
    } catch (err) {
      console.error('Failed to load remediation preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await api.post('/remediation/apply', {
        finding_id: preview.finding.id,
        file_path: preview.file_path,
        line_number: preview.line_number,
        proposed_line: preview.proposed_line
      });
      setApplied(true);
      setBackupPath(res.data.backup_path);
    } catch (err) {
      alert('Failed to apply remediation patch.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading remediation diff preview...</div>;
  if (!preview) return <div className="p-8 text-center text-slate-400">Select a finding to remediate.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Source Code Remediation Patch Engine</h1>
          <p className="text-xs text-slate-400">
            Atomic patch generation with explicit approval • Original file backup guaranteed
          </p>
        </div>

        {applied ? (
          <button
            onClick={() => setActiveTab('verification')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 shadow"
          >
            <CheckCircle2 className="w-4 h-4" />
            Proceed to Verification Re-scan
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
          >
            <Wrench className="w-4 h-4" />
            Approve & Apply Patch Atomic Edit
          </button>
        )}
      </div>

      {applied && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center justify-between font-mono">
          <span>✓ Remediation patch applied successfully! Backup created at: <strong>{backupPath}</strong></span>
        </div>
      )}

      {/* Code Diff Before vs After */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BEFORE (Original File Line) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Before (Original Code)</span>
            <span className="text-[10px] text-slate-500 font-mono">Line {preview.line_number}</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-red-300 border border-red-500/20 overflow-x-auto">
            - {preview.original_line}
          </div>
        </div>

        {/* AFTER (Proposed Remediated Code Line) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">After (Proposed Patch)</span>
            <span className="text-[10px] text-slate-500 font-mono">Line {preview.line_number}</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-300 border border-emerald-500/20 overflow-x-auto">
            + {preview.proposed_line}
          </div>
        </div>
      </div>

      {/* Unified Unified Diff Patch */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-2 font-mono text-xs">
        <div className="text-slate-400 font-bold uppercase text-[10px]">Unified Git Patch Preview</div>
        <div className="bg-slate-950 p-4 rounded-lg text-slate-300 border border-slate-800 whitespace-pre overflow-x-auto">
          {preview.diff_patch}
        </div>
      </div>
    </div>
  );
}
