import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';

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

            const res = await axios.post('http://localhost:8000/api/auth/token', formData, {
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
            const res = await axios.post('http://localhost:8000/api/auth/google', { token: credentialResponse.credential });
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 p-4">
            <div className="max-w-md w-full glass rounded-[2rem] p-10 transform transition-all duration-500">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center rotate-3 transform hover:rotate-6 transition-all">
                            <span className="text-3xl font-black text-brand tracking-tighter">Tr</span>
                        </div>
                    </div>
                    <h2 className="text-4xl font-extrabold text-slate-800 mb-2">Trackify</h2>
                    <p className="text-slate-600 font-medium">Welcome back! Log in to continue.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm font-medium animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="you@example.com"
                            className="w-full px-5 py-3.5 rounded-xl border border-white/40 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-white/60 shadow-sm text-slate-800 placeholder-slate-400 group-hover:bg-white/80"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="group">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-slate-700">Password</label>
                            <a href="#" className="text-xs font-bold text-brand hover:text-brand-dark transition-colors">Forgot Password?</a>
                        </div>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full px-5 py-3.5 rounded-xl border border-white/40 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-white/60 shadow-sm text-slate-800 placeholder-slate-400 group-hover:bg-white/80"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3.5 px-4 bg-brand hover:bg-brand-dark overflow-hidden relative text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(59,130,246,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 group"
                    >
                        <span className="absolute w-full h-full bg-white/20 -left-full top-0 group-hover:animate-[shimmer_1s_infinite]"></span>
                        Sign In
                    </button>
                </form>

                <div className="mt-8 flex items-center justify-between">
                    <span className="border-b border-slate-300/50 w-1/5 lg:w-1/4"></span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Or continue with</span>
                    <span className="border-b border-slate-300/50 w-1/5 lg:w-1/4"></span>
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

                <p className="mt-8 text-center text-sm font-medium text-slate-600">
                    Don't have an account? <Link to="/register" className="text-brand font-extrabold hover:text-brand-dark transition-colors">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
