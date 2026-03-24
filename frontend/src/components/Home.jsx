import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1, 
            transition: { staggerChildren: 0.2, delayChildren: 0.1 } 
        }
    };

    const itemVariants = {
        hidden: { y: 30, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 20 } }
    };

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4">

            {/* Main Content Window (Sleek Glassmorphism) */}
            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="z-10 w-full max-w-2xl p-10 md:p-14 rounded-3xl transform hover:scale-[1.01] transition-transform duration-700 shadow-2xl flex flex-col items-center text-center glass border border-slate-200/50"
            >

                {/* Logo Design */}
                <motion.div variants={itemVariants} className="mb-8 relative group">
                    <div className="absolute -inset-2 bg-indigo-200/50 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                    <div className="relative w-20 h-20 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl flex items-center justify-center group-hover:-translate-y-1 transition-all duration-500">
                        <span className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-indigo-500 to-emerald-500 tracking-tighter">Tr</span>
                    </div>
                </motion.div>

                {/* Typography */}
                <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-bold text-slate-900 mb-5 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-600">
                    Trackify
                </motion.h1>
                <motion.p variants={itemVariants} className="text-base md:text-lg text-slate-600 font-medium mb-10 max-w-md mx-auto leading-relaxed">
                    The most elegant way to manage your expenses and track your financial growth with profound clarity.
                </motion.p>

                {/* Call to Action Button */}
                <motion.button
                    variants={itemVariants}
                    onClick={() => navigate('/login')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative px-8 py-4 w-full sm:w-auto overflow-hidden rounded-xl bg-white/80 shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/15 transition-colors duration-500 border border-slate-200 hover:border-indigo-300"
                >
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700"></div>
                    <span className="relative z-10 font-semibold text-sm tracking-wide text-slate-800 flex items-center justify-center gap-3">
                        Continue to Login
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                    </span>
                    <span className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                </motion.button>
            </motion.div>

            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-8 text-slate-500 text-xs font-medium z-10 tracking-widest uppercase"
            >
                © {new Date().getFullYear()} Trackify Inc.
            </motion.p>
        </div>
    );
}
