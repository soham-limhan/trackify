import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4">

            {/* Main Content Window (Glassmorphism) */}
            <div className="z-10 w-full max-w-2xl p-10 md:p-14 rounded-[2.5rem] transform hover:scale-[1.02] transition-transform duration-500 shadow-2xl flex flex-col items-center text-center glass">

                {/* Logo Design */}
                <div className="mb-6 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-[2rem] blur opacity-40 group-hover:opacity-75 transition duration-500 group-hover:duration-200"></div>
                    <div className="relative w-24 h-24 bg-white/90 backdrop-blur-sm rounded-[1.8rem] shadow-xl flex items-center justify-center -rotate-6 group-hover:-rotate-3 transition-transform duration-300">
                        <span className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-tr from-brand to-brand-light tracking-tighter">Tr</span>
                    </div>
                </div>

                {/* Typography */}
                <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] tracking-tight">
                    Trackify
                </h1>
                <p className="text-lg md:text-2xl text-white font-semibold mb-10 max-w-lg mx-auto leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                    The most beautiful and intelligent way to manage your expenses and track your financial growth.
                </p>

                {/* Call to Action Button */}
                <button
                    onClick={() => navigate('/login')}
                    className="group relative px-10 py-5 w-full sm:w-auto overflow-hidden rounded-2xl bg-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_40px_rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-2 active:scale-95 border border-white/20 hover:border-white/40"
                >
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                    <span className="relative z-10 font-bold text-xl text-white flex items-center justify-center gap-3">
                        Continue to Login
                        <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                    </span>
                    <span className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                </button>
            </div>

            <p className="absolute bottom-6 text-white/60 text-sm font-medium z-10 tracking-wider">
                © {new Date().getFullYear()} Trackify Inc. All rights reserved.
            </p>
        </div>
    );
}
