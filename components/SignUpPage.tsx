import React, { useState } from 'react';
import { User, Mail, Lock, ArrowRight, ShieldAlert, CheckCircle2, Zap } from './Icons';

interface SignUpPageProps {
  onComplete: () => void;
  onLogin: () => void; // For "Already have an account?" logic (can just go to app for MVP)
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onComplete, onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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

    // Basic Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required to initialize account.");
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
      onComplete();
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

      <div className="relative z-10 w-full max-w-md">
        
        {/* Branding Header */}
        <div className="text-center mb-8 animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6 shadow-2xl relative group">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                <User className="text-emerald-500 relative z-10" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Initialize Access</h1>
            <p className="text-gray-500 text-sm font-mono">Create your PRR Terminal identity to begin.</p>
        </div>

        {/* Form Card */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Top Border Gradient */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-800 via-emerald-500 to-gray-800 opacity-50"></div>

            <form onSubmit={handleSubmit} className="space-y-5">
                
                {error && (
                    <div className="bg-rose-950/30 border border-rose-900/50 text-rose-300 px-4 py-3 rounded-lg text-xs flex items-center gap-2 animate-pulse">
                        <ShieldAlert size={14} />
                        {error}
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Operator Name</label>
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
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-700 text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail size={16} className="text-gray-600 group-focus-within:text-emerald-500 transition-colors" />
                        </div>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="name@example.com"
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-700 text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
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
                                className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-700 text-sm"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Confirm</label>
                        <div className="relative group">
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-700 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`
                        w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-bold tracking-wide transition-all mt-4
                        ${isLoading 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isLoading ? (
                        <>
                           <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
                           ESTABLISHING SECURE CONNECTION...
                        </>
                    ) : (
                        <>
                           CREATE ACCOUNT <ArrowRight size={16} />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800/50 text-center">
                <p className="text-gray-500 text-xs">
                    Already have access?{' '}
                    <button onClick={onLogin} className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline">
                        Log in here
                    </button>
                </p>
            </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex justify-center gap-6 text-gray-600 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
             <div className="flex items-center gap-1.5">
                 <ShieldAlert size={14} />
                 <span className="text-[10px] uppercase font-bold tracking-widest">SSL Encrypted</span>
             </div>
             <div className="flex items-center gap-1.5">
                 <CheckCircle2 size={14} />
                 <span className="text-[10px] uppercase font-bold tracking-widest">Verified Models</span>
             </div>
             <div className="flex items-center gap-1.5">
                 <Zap size={14} />
                 <span className="text-[10px] uppercase font-bold tracking-widest">Live Data</span>
             </div>
        </div>

      </div>
    </div>
  );
};