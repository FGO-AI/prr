
import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldAlert, CheckCircle2, Zap, BrainCircuit, RefreshCw } from './Icons';

interface LoginPageProps {
  onComplete: () => void;
  onSignUp: () => void;
  onAccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onComplete, onSignUp, onAccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      setError("Credentials required to authenticate session.");
      return;
    }

    setIsLoading(true);
    // Simulate Authentication
    setTimeout(() => {
      setIsLoading(false);
      onComplete();
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
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/80 z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6 shadow-2xl relative group">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                <BrainCircuit className="text-emerald-400 relative z-10" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 uppercase tracking-tighter">Authorize Terminal</h1>
            <p className="text-gray-500 text-sm font-mono uppercase tracking-widest">Operator Authentication Protocol</p>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-800 via-emerald-500 to-gray-800 opacity-50"></div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-rose-950/30 border border-rose-900/50 text-rose-300 px-4 py-3 rounded-lg text-[11px] font-mono flex items-center gap-2 animate-pulse">
                        <ShieldAlert size={14} />
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] ml-1">Operator ID (Email)</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                        </div>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="admin@terminal.io"
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3.5 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Security Key</label>
                        <button type="button" className="text-[10px] text-gray-600 hover:text-emerald-400 uppercase tracking-widest transition-colors font-mono">Recovery?</button>
                    </div>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                        </div>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3.5 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
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
                           Verifying Hash...
                        </>
                    ) : (
                        <>
                           Establish Session <ArrowRight size={16} />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-800/50 text-center flex flex-col gap-3">
                <p className="text-gray-600 text-[11px] uppercase tracking-widest font-mono">
                    New Operator?{' '}
                    <button onClick={onSignUp} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                        Request Access
                    </button>
                </p>
                {onAccess && (
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono">
                        Early Access Code?{' '}
                        <button onClick={onAccess} className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                            Enter Key
                        </button>
                    </p>
                )}
            </div>
        </div>

        <div className="mt-8 flex justify-center gap-8 text-gray-800 opacity-50">
             <div className="flex items-center gap-1.5">
                 <ShieldAlert size={14} />
                 <span className="text-[9px] uppercase font-bold tracking-[0.2em]">Biometric-V</span>
             </div>
             <div className="flex items-center gap-1.5">
                 <CheckCircle2 size={14} />
                 <span className="text-[9px] uppercase font-bold tracking-[0.2em]">Quant-Sec</span>
             </div>
        </div>
      </div>
    </div>
  );
};
