import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '../config';

export default function Register() {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleInitiateRegistration = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/register`, {
                full_name: name,
                email,
                password
            });
            setMessage(res.data.message);
            setStep(2);
            if (res.data.dev_otp) {
                console.log("DEV REGISTRATION OTP:", res.data.dev_otp);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/verify-registration-otp`, {
                email,
                otp
            });
            localStorage.setItem('token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/google`, { token: credentialResponse.credential });
            localStorage.setItem('token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Google Registration failed.');
        }
    };

    const handleGoogleError = () => {
        setError('Google Registration was unsuccessful.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-[2rem] p-10 transform transition-all duration-500 glass-panel">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-white dark:bg-dark-card rounded-2xl border border-slate-300 dark:border-white/10 shadow-lg flex items-center justify-center -rotate-3 transform hover:-rotate-6 transition-all">
                            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-emerald-400 tracking-tighter">Tr</span>
                        </div>
                    </div>
                    <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Create Account</h2>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {step === 1 ? 'Join Trackify to manage your expenses.' : 'Verify your email to complete registration.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-200 rounded-lg text-sm font-medium">
                        {error}
                    </div>
                )}
                
                {message && step === 2 && (
                    <div className="mb-6 p-4 bg-emerald-100 dark:bg-emerald-900/30 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-200 rounded-lg text-sm font-medium">
                        {message}
                    </div>
                )}

                {step === 1 && (
                    <>
                        <form onSubmit={handleInitiateRegistration} className="space-y-5">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="John Doe"
                                    className="w-full px-5 py-3 rounded-xl border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full px-5 py-3 rounded-xl border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full px-5 py-3 rounded-xl border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 button-glow"
                            >
                                {loading ? 'Sending OTP...' : 'Sign Up'}
                            </button>
                        </form>

                        <div className="mt-8 flex items-center justify-between">
                            <span className="border-b border-slate-300 dark:border-white/10 w-1/5 lg:w-1/4"></span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Or continue with</span>
                            <span className="border-b border-slate-300 dark:border-white/10 w-1/5 lg:w-1/4"></span>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                theme="outline"
                                size="large"
                                width="100%"
                                text="signup_with"
                                shape="rectangular"
                            />
                        </div>
                    </>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">6-Digit OTP</label>
                            <input
                                type="text"
                                required
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-5 py-3 rounded-xl border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm tracking-widest text-center text-lg"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 button-glow"
                        >
                            {loading ? 'Verifying...' : 'Verify OTP & Create Account'}
                        </button>
                        <div className="text-center mt-4">
                            <button 
                                type="button" 
                                onClick={() => setStep(1)} 
                                className="text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 font-medium"
                            >
                                Back to Registration
                            </button>
                        </div>
                    </form>
                )}

                <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-indigo-500 dark:text-indigo-400 font-bold hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors">Log in</Link>
                </p>
            </div>
        </div>
    );
}
