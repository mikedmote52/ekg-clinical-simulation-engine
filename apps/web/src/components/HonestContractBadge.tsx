'use client';

import React from 'react';
import { CheckCircle, Info } from 'lucide-react';
import { useEkgStore } from '../store/ekgStore';

export function HonestContractBadge() {
  const vizParams = useEkgStore((s) => s.vizParams);
  const evidenceCount = vizParams?.display_contract?.evidence_supported?.length ?? 0;
  const modeledCount = vizParams?.display_contract?.modeled_assumption?.length ?? 0;

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      <button
        type="button"
        onClick={() => scrollToSection('evidence-supported')}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/90 hover:bg-green-500 text-white text-sm font-medium shadow-lg transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        ECG Evidence ({evidenceCount})
      </button>
      <button
        type="button"
        onClick={() => scrollToSection('modeled-assumption')}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-white text-sm font-medium shadow-lg transition-colors"
      >
        <Info className="w-4 h-4" />
        Explanatory Model ({modeledCount})
      </button>
    </div>
  );
}
