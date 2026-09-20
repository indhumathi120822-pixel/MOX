import React from 'react';

export default function SH164Badge({ size = 'sm' }) {
  return (
    <span className={`inline-flex items-center font-mono font-black tracking-wider border rounded shadow-sm px-2.5 py-0.5 ${
      size === 'lg' ? 'text-lg bg-slate-900 border-slate-700' : 'text-xs bg-slate-900/90 border-slate-700/80'
    }`}>
      <span className="text-blue-400">M</span>
      <span className="text-slate-400 font-bold mx-0.5">-</span>
      <span className="text-emerald-400">O</span>
      <span className="text-slate-400 font-bold mx-0.5">-</span>
      <span className="text-amber-400">X</span>
    </span>
  );
}
