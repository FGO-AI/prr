
import React, { useState } from 'react';
import { User, Mail, Lock, ArrowRight, ShieldAlert, CheckCircle2, Zap, Shield, Trophy, Crown } from './Icons';
import { User as UserType, SubscriptionTier } from '../types';

interface SignUpPageProps {
  onComplete: (user: UserType) => void;
  onLogin: () => void;
  onGuest: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onComplete, onLogin, onGuest }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    tier: SubscriptionTier.FREE
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleTierSelect = (tier: SubscriptionTier) => {
    setFormData({ ...formData, tier });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("Credentials required for account creation.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Encryption keys (passwords) do not match.");
      return;
    }

    if (formData.password.length < 8) {
        setError("Password must be at least 8 characters for security.");
        return;
    }

    // Simulate API Call
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onComplete({
        id: `user-${Date.now()}`,
        email: formData.email,
        name: formData.name,
        type: 'email',
        tier: formData.tier
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden font-sans text-gray-200 p-4">
      
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#111827 1px, transparent 1px), linear-gradient(90deg, #111827 1px, transparent 1px)', 
             backgroundSize: '40px 40px',
             opacity: 0.4
           }}>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/80 z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-xl">
        
        {/* Branding Header */}
        <div className="text-center mb-8 animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6 shadow-2xl relative group">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                <User className="text-emerald-500 relative z-10" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 uppercase tracking-tighter">Initialize Account</h1>
            <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Operator Registration Protocol</p>
        </div>

        {/* Form Card */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Top Border Gradient */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-800 via-emerald-500 to-gray-800 opacity-50"></div>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {error && (
                    <div className="bg-rose-950/30 border border-rose-900/50 text-rose-300 px-4 py-3 rounded-lg text-[10px] font-mono flex items-center gap-2 animate-pulse">
                        <ShieldAlert size={14} />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Operator Alias</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g. JohnDoe_01"
                                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Email Connection</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@terminal.io"
                                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Security Key</label>
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
                                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Verify Key</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-gray-800 text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Subscription Tier</label>
                        <div className="space-y-3">
                            <button 
                                type="button"
                                onClick={() => handleTierSelect(SubscriptionTier.FREE)}
                                className={`w-full p-4 rounded-xl border transition-all text-left group relative overflow-hidden ${formData.tier === SubscriptionTier.FREE ? 'bg-emerald-500/10 border-emerald-500' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${formData.tier === SubscriptionTier.FREE ? 'text-emerald-400' : 'text-gray-400'}`}>Standard</span>
                                    <Zap size={14} className={formData.tier === SubscriptionTier.FREE ? 'text-emerald-400' : 'text-gray-700'} />
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono leading-tight">5 spins of 5 picks. Minimum 60% hit probability. Standard metrics.</p>
                                {formData.tier === SubscriptionTier.FREE && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-bl-full flex items-center justify-center pl-2 pb-2"><CheckCircle2 size={12} className="text-emerald-400" /></div>}
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleTierSelect(SubscriptionTier.PRO)}
                                className={`w-full p-4 rounded-xl border transition-all text-left group relative overflow-hidden ${formData.tier === SubscriptionTier.PRO ? 'bg-blue-500/10 border-blue-500' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${formData.tier === SubscriptionTier.PRO ? 'text-blue-400' : 'text-gray-400'}`}>Professional</span>
                                    <Trophy size={14} className={formData.tier === SubscriptionTier.PRO ? 'text-blue-400' : 'text-gray-700'} />
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono leading-tight">5 spins of 15 picks. Minimum 75% hit probability. Advanced metrics.</p>
                                {formData.tier === SubscriptionTier.PRO && <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/20 rounded-bl-full flex items-center justify-center pl-2 pb-2"><CheckCircle2 size={12} className="text-blue-400" /></div>}
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleTierSelect(SubscriptionTier.WHALE)}
                                className={`w-full p-4 rounded-xl border transition-all text-left group relative overflow-hidden ${formData.tier === SubscriptionTier.WHALE ? 'bg-purple-500/10 border-purple-500' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${formData.tier === SubscriptionTier.WHALE ? 'text-purple-400' : 'text-gray-400'}`}>Whale Protocol</span>
                                    <Crown size={14} className={formData.tier === SubscriptionTier.WHALE ? 'text-purple-400' : 'text-gray-700'} />
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono leading-tight">15 spins of 15 picks. Minimum 65% hit probability. Priority scan & deep insights.</p>
                                {formData.tier === SubscriptionTier.WHALE && <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500/20 rounded-bl-full flex items-center justify-center pl-2 pb-2"><CheckCircle2 size={12} className="text-purple-400" /></div>}
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`
                        w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-widest transition-all mt-4 text-xs uppercase
                        ${isLoading 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isLoading ? (
                        <>
                           <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
                           Establishing...
                        </>
                    ) : (
                        <>
                           Register Account <ArrowRight size={16} />
                        </>
                    )}
                </button>
            </form>

            {/* Bottom Actions Area */}
            <div className="mt-8 pt-6 border-t border-gray-800/50 flex flex-col gap-4">
                <button 
                  onClick={onGuest}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-blue-500/30 bg-blue-500/5 text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
                >
                   <Shield size={14} /> Guest Access (Access Code)
                </button>
                
                <p className="text-gray-600 text-[10px] uppercase tracking-widest font-mono text-center">
                    Already an operator?{' '}
                    <button onClick={onLogin} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors underline underline-offset-4 decoration-emerald-500/30">
                        Log in here
                    </button>
                </p>
            </div>
        </div>

        {/* Security Footnote */}
        <div className="mt-8 flex justify-center gap-6 text-gray-800 opacity-50">
             <div className="flex items-center gap-1.5">
                 <ShieldAlert size={14} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">SSL Secure</span>
             </div>
             <div className="flex items-center gap-1.5">
                 <CheckCircle2 size={14} />
                 <span className="text-[9px] uppercase font-bold tracking-widest">Encrypted</span>
             </div>
        </div>

      </div>
    </div>
  );
};
