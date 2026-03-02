
import React, { useState } from 'react';
import { Shield, ArrowRight, ShieldAlert, RefreshCw, Zap, BrainCircuit } from './Icons';
import { User as UserType } from '../types';

interface AccessCodePageProps {
  onComplete: (user: UserType) => void;
  onLogin: () => void;
}

export const AccessCodePage: React.FC<AccessCodePageProps> = ({ onComplete, onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.toUpperCase() !== 'QUANT') {
      setError("INVALID ACCESS TOKEN. CONNECTION TERMINATED.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onComplete({
        id: `guest-${Date.now()}`,
        name: 'Guest Operator',
        type: 'access_code'
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden font-sans text-gray-200 p-4">
      <div className="absolute inset-0 z-0 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#111827 1px, transparent 1px), linear-gradient(90deg, #111827 1px, transparent 1px)', 
             backgroundSize: '40px 40px',
             opacity: 0.4
           }}>
      </div>
      
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8 animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6 shadow-2xl relative group">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-100 rounded-full animate-pulse"></div>
                <Shield className="text-emerald-400 relative z-10" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 uppercase tracking-tighter">Terminal Gate</h1>
            <p className="text-gray-500 text-xs font-mono uppercase tracking-[0.2em]">Enter Early Access Code</p>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-800 via-emerald-500 to-gray-800 opacity-50"></div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-rose-950/30 border border-rose-900/50 text-rose-300 px-4 py-3 rounded-lg text-[10px] font-mono flex items-center gap-2 animate-pulse">
                        <ShieldAlert size={14} />
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    <div className="relative group">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => { setCode(e.target.value); setError(null); }}
                            placeholder="OPERATOR CODE"
                            className="w-full bg-gray-950 border border-gray-800 text-emerald-400 text-center rounded-lg py-4 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-lg font-mono tracking-[0.5em] uppercase"
                            autoFocus
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`
                        w-full flex items-center justify-center gap-3 py-4 rounded-lg font-bold tracking-[0.15em] transition-all mt-4 text-xs uppercase
                        ${isLoading 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/30 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isLoading ? (
                        <>
                           <RefreshCw className="w-4 h-4 animate-spin" />
                           Bypassing...
                        </>
                    ) : (
                        <>
                           Initialize Guest Session <ArrowRight size={16} />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
                <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono">
                    Already have access?{' '}
                    <button onClick={onLogin} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                        Operator Login
                    </button>
                </p>
            </div>
        </div>

        <div className="mt-8 flex justify-center gap-8 text-gray-800 opacity-30">
             <div className="flex items-center gap-1.5">
                 <Zap size={12} />
                 <span className="text-[8px] uppercase font-bold tracking-[0.3em]">Direct-Link</span>
             </div>
             <div className="flex items-center gap-1.5">
                 <BrainCircuit size={12} />
                 <span className="text-[8px] uppercase font-bold tracking-[0.3em]">Quantum-Key</span>
             </div>
        </div>
      </div>
    </div>
  );
};
