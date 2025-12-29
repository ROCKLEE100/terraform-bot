import React from 'react';
import { LogIn, User as UserIcon, Terminal, ArrowRight, Sparkles } from 'lucide-react';

interface SignInProps {
    onLogin: () => void;
}

export const SignIn: React.FC<SignInProps> = ({ onLogin }) => {
    const lastUser = JSON.parse(localStorage.getItem('lastUser') || 'null');

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-magenta-500/10 blur-[120px]" />
            </div>

            <div className="w-full max-w-md space-y-8 relative z-10">
                <div className="text-center space-y-6">
                    <div className="inline-flex p-5 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-magenta-500/20 border border-white/10 shadow-[0_0_40px_rgba(6,182,212,0.2)] mb-2 backdrop-blur-xl relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-magenta-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <Terminal size={48} className="text-cyan-400 relative z-10" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-cyan-200 to-magenta-200 bg-clip-text text-transparent tracking-tight">
                            Terraform Bot
                        </h1>
                        <div className="flex items-center justify-center gap-2 text-cyan-400/80 text-sm font-medium tracking-widest uppercase">
                            <Sparkles size={14} />
                            <span>AI Infrastructure Architect</span>
                            <Sparkles size={14} />
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-3xl p-8 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-magenta-500 to-cyan-500 opacity-50"></div>

                    <div className="space-y-2 text-center">
                        <h2 className="text-2xl font-semibold text-white">Welcome Back</h2>
                        <p className="text-gray-400">Sign in to orchestrate your cloud infrastructure</p>
                    </div>

                    <div className="space-y-4">
                        {lastUser && (
                            <button
                                onClick={onLogin}
                                className="w-full group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="relative">
                                        {lastUser.picture ? (
                                            <img src={lastUser.picture} alt={lastUser.name} className="w-12 h-12 rounded-full ring-2 ring-cyan-500/30" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center ring-2 ring-cyan-500/30">
                                                <UserIcon className="text-cyan-400" size={24} />
                                            </div>
                                        )}
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0f172a]"></div>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-white group-hover:text-cyan-200 transition-colors">Continue as {lastUser.name}</p>
                                        <p className="text-xs text-gray-500">{lastUser.email}</p>
                                    </div>
                                </div>
                                <ArrowRight size={20} className="text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all relative z-10" />
                            </button>
                        )}

                        <button
                            onClick={onLogin}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98] group"
                        >
                            <LogIn size={20} className="group-hover:rotate-12 transition-transform" />
                            {lastUser ? 'Use another account' : 'Login with Google'}
                        </button>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        <span className="font-mono">SYSTEM ONLINE v2.0</span>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-600 font-medium">
                    Secure authentication powered by Google OAuth 2.0
                </p>
            </div>
        </div>
    );
};
