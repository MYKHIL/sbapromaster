import React, { useState } from 'react';
import { SchoolListItem, verifySchoolPassword } from '../../services/firebaseService';

interface PasswordScreenProps {
    school: SchoolListItem;
    onPasswordVerified: (password: string) => void;
    onBack: () => void;
}

const PasswordScreen: React.FC<PasswordScreenProps> = ({ school, onPasswordVerified, onBack }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password.trim()) {
            setError('Please enter a password');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { isValid, isExpired } = await verifySchoolPassword(school.docId, password);

            if (isValid) {
                onPasswordVerified(password);
            } else {
                setError('Incorrect password. Please verify and try again.');
                setPassword('');
            }
        } catch (err) {
            console.error('Password verification error:', err);
            setError('Verification network connection timeout.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 tracking-tight antialiased selection:bg-indigo-500/10 selection:text-indigo-900">
            {/* Elegant glowing background ring assets */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-100/40 rounded-full blur-[140px] pointer-events-none translate-y-1/2" />

            <div className="w-full max-w-md relative z-10">
                
                {/* Header Section */}
                <div className="flex flex-col items-center text-center mb-8 space-y-2.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white border border-slate-200 shadow-sm text-slate-600">
                        🔒 Identity Clearance
                    </span>
                    <h1 className="text-3xl font-light tracking-tight text-slate-900 sm:text-4xl">
                        Enter <span className="font-semibold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">Password</span>
                    </h1>
                    <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto truncate">
                        {school.displayName}
                    </p>
                    {(school.settings?.district || school.settings?.circuit) && (
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md inline-block mt-1 border border-slate-200/60 shadow-sm">
                            {[school.settings?.district, school.settings?.circuit].filter(Boolean).join('  •  ')}
                        </p>
                    )}
                </div>

                {/* Main Interactive Interface Block */}
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Custom Input Block */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Institutional Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 pr-12 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all placeholder:text-slate-300 font-medium tracking-wide text-slate-800"
                                    placeholder="••••••••"
                                    disabled={loading}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error System Info Box */}
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 animate-fade-in">
                                <div className="text-rose-600 text-xs font-semibold tracking-wide">{error}</div>
                            </div>
                        )}

                        {/* Action Triggers */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.99] mt-2 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-white"></div>
                                    <span className="font-semibold">Verifying credentials...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onBack}
                            disabled={loading}
                            className="w-full bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-semibold py-3.5 px-6 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.99] shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Back to Schools</span>
                        </button>
                    </form>
                </div>

                {/* Footer Security Note */}
                <div className="text-center mt-6">
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                        🔒 Secured Workspace Environment
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PasswordScreen;