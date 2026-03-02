import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:8000/api/auth/register', {
                full_name: name,
                email,
                password
            });
            localStorage.setItem('token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await axios.post('http://localhost:8000/api/auth/google', { token: credentialResponse.credential });
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 p-4">
            <div className="max-w-md w-full glass rounded-[2rem] p-10 transform transition-all duration-500">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center -rotate-3 transform hover:-rotate-6 transition-all">
                            <span className="text-3xl font-black text-brand tracking-tighter">Tr</span>
                        </div>
                    </div>
                    <h2 className="text-4xl font-extrabold text-slate-800 mb-2">Create Account</h2>
                    <p className="text-slate-600 font-medium">Join Trackify to manage your expenses.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm font-medium animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                        <input
                            type="text"
                            required
                            placeholder="John Doe"
                            className="w-full px-5 py-3 rounded-xl border border-white/40 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-white/60 shadow-sm text-slate-800 placeholder-slate-400 group-hover:bg-white/80"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            placeholder="you@example.com"
                            className="w-full px-5 py-3 rounded-xl border border-white/40 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-white/60 shadow-sm text-slate-800 placeholder-slate-400 group-hover:bg-white/80"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full px-5 py-3 rounded-xl border border-white/40 focus:ring-4 focus:ring-brand/20 focus:border-brand outline-none transition-all bg-white/60 shadow-sm text-slate-800 placeholder-slate-400 group-hover:bg-white/80"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3.5 px-4 bg-brand hover:bg-brand-dark overflow-hidden relative text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(59,130,246,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 group disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                        <span className="absolute w-full h-full bg-white/20 -left-full top-0 group-hover:animate-[shimmer_1s_infinite]"></span>
                        {loading ? 'Creating...' : 'Sign Up'}
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
                        text="signup_with"
                        shape="rectangular"
                    />
                </div>

                <p className="mt-8 text-center text-sm font-medium text-slate-600">
                    Already have an account? <Link to="/login" className="text-brand font-extrabold hover:text-brand-dark transition-colors">Log in</Link>
                </p>
            </div>
        </div>
    );
}
