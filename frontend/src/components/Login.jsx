import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '../config';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const formData = new FormData();
            formData.append('username', email); // OAuth2 expects 'username'
            formData.append('password', password);

            const res = await axios.post(`${API_BASE_URL}/api/auth/token`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            localStorage.setItem('token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/google`, { token: credentialResponse.credential });
            localStorage.setItem('token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Google Login failed.');
        }
    };

    const handleGoogleError = () => {
        setError('Google Login was unsuccessful.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-[2rem] p-10 transform transition-all duration-500 glass-panel">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-white dark:bg-dark-card rounded-2xl border border-slate-300 dark:border-white/10 shadow-lg flex items-center justify-center rotate-3 transform hover:rotate-6 transition-all">
                            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-emerald-400 tracking-tighter">Tr</span>
                        </div>
                    </div>
                    <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Trackify</h2>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">Welcome back! Log in to continue.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 text-red-200 rounded-lg text-sm font-medium animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="you@example.com"
                            className="w-full px-5 py-3.5 rounded-xl border border-slate-300 dark:border-white/10 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-slate-50/50 dark:bg-dark-bg/50 shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 group-hover:bg-slate-50/80 dark:group-hover:bg-dark-bg/80"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="group">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                            <Link to="/forgot-password" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Forgot Password?</Link>
                        </div>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full px-5 py-3.5 rounded-xl border border-slate-300 dark:border-white/10 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-slate-50/50 dark:bg-dark-bg/50 shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 group-hover:bg-slate-50/80 dark:group-hover:bg-dark-bg/80"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 overflow-hidden relative text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 group button-glow"
                    >
                        Sign In
                    </button>
                </form>

                <div className="mt-8 flex items-center justify-between">
                    <span className="border-b border-slate-300 dark:border-white/10 w-1/5 lg:w-1/4"></span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Or continue with</span>
                    <span className="border-b border-slate-300 dark:border-white/10 w-1/5 lg:w-1/4"></span>
                </div>

                <div className="mt-6 flex justify-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="outline"
                        size="large"
                        width="100%"
                        text="signin_with"
                        shape="rectangular"
                    />
                </div>

                <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account? <Link to="/register" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
