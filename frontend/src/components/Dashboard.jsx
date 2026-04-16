import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
    LogOut, PlusCircle, MinusCircle, Wallet, Target, Activity, 
    UploadCloud, Trash2, Clock, Sparkles, TrendingUp, AlertTriangle, ChevronRight
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    AreaChart, Area, ComposedChart
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import { API_BASE_URL, WS_BASE_URL } from '../config';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [budget, setBudget] = useState(null);

    // Form States
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('expense');
    const [budgetLimit, setBudgetLimit] = useState('');

    // Upload State
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');
    const fileInputRef = useRef(null);

    // UI States
    const [scrolled, setScrolled] = useState(0);
    const [recurringExpenses, setRecurringExpenses] = useState([]);
    const [showRecurringForm, setShowRecurringForm] = useState(false);
    const [reAmount, setReAmount] = useState('');
    const [reCategory, setReCategory] = useState('');
    const [reDescription, setReDescription] = useState('');
    const [reDay, setReDay] = useState(5);
    const [reMonths, setReMonths] = useState(12);

    // Clock State
    const [clockTime, setClockTime] = useState('');
    const [clockDate, setClockDate] = useState('');
    const wsRef = useRef(null);

    // Tab State
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'transactions', 'ai', 'settings'
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');

    const connectClock = useCallback(() => {
        const ws = new WebSocket(`${WS_BASE_URL}/ws/clock`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setClockTime(data.time);
            setClockDate(data.date);
        };
        ws.onclose = () => {
            setTimeout(connectClock, 2000);
        };
        wsRef.current = ws;
        return ws;
    }, []);

    useEffect(() => {
        const ws = connectClock();
        return () => ws.close();
    }, [connectClock]);

    const axiosInstance = axios.create({
        baseURL: `${API_BASE_URL}/api`,
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const handleScroll = () => {
            const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 100);
            let ratio = window.scrollY / (maxScroll * 0.4);
            if (ratio > 1) ratio = 1;
            setScrolled(ratio);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        fetchData();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [navigate]);

    const fetchData = async () => {
        try {
            const [userRes, transRes, analyticsRes, budgetRes, recurringRes] = await Promise.all([
                axiosInstance.get('/auth/me'),
                axiosInstance.get('/transactions/'),
                axiosInstance.get('/transactions/analytics'),
                axiosInstance.get('/transactions/budget'),
                axiosInstance.get('/transactions/recurring')
            ]);
            setUser(userRes.data);
            setTransactions(transRes.data);
            setAnalytics(analyticsRes.data);
            setRecurringExpenses(recurringRes.data);
            if (budgetRes.data) {
                setBudget(budgetRes.data.limit_amount);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const fetchAiAdvice = async (forceQuery = null) => {
        if (aiAdvice && !forceQuery && !aiPrompt) return;
        setLoadingAI(true);
        try {
            const queryToSend = forceQuery || aiPrompt || null;
            const res = await axiosInstance.post('/transactions/ai-advice', {
                user_query: queryToSend
            });
            setAiAdvice(res.data);
        } catch (error) {
            console.error("Error fetching AI advice:", error);
        } finally {
            setLoadingAI(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ai') {
            fetchAiAdvice();
        }
    }, [activeTab]);

    const handleResetData = async () => {
        if (window.confirm("Are you sure you want to reset all your data? This action cannot be undone.")) {
            try {
                await axiosInstance.delete('/transactions/reset');
                fetchData();
            } catch (error) {
                console.error("Error resetting data", error);
                alert("Failed to reset data");
            }
        }
    };

    const handleTransactionSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post('/transactions/', {
                amount: parseFloat(amount),
                type,
                category,
                description
            });
            setAmount('');
            setCategory('');
            setDescription('');
            fetchData();
        } catch (error) {
            console.error("Error adding transaction", error);
        }
    };

    const handleRecurringSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post('/transactions/recurring', {
                amount: parseFloat(reAmount),
                category: reCategory,
                description: reDescription,
                day_of_month: parseInt(reDay),
                total_months: parseInt(reMonths)
            });
            setReAmount('');
            setReCategory('');
            setReDescription('');
            setReDay(5);
            setReMonths(12);
            setShowRecurringForm(false);
            fetchData();
        } catch (error) {
            console.error("Error adding recurring expense", error);
            alert("Failed to add EMI. Please check details.");
        }
    };

    const handleBudgetSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.post('/transactions/budget', {
                limit_amount: parseFloat(budgetLimit)
            });
            setBudgetLimit('');
            fetchData();
        } catch (error) {
            console.error("Error setting budget", error);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setUploadMsg("Please upload a PDF file.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setUploadMsg("Analyzing statement...");
        try {
            const res = await axiosInstance.post('/transactions/upload-statement/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadMsg(`Successfully imported ${res.data.transactions_added} transactions!`);
            fetchData();
            setTimeout(() => setUploadMsg(''), 4000);
        } catch (error) {
            setUploadMsg("Failed to parse statement. Please ensure it's a valid format.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const handleExportPDF = async () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();

        pdf.setFontSize(22);
        pdf.text('Trackify Financial Report', 14, 20);
        pdf.setFontSize(10);
        pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
        pdf.text(`User: ${user?.full_name || 'Valued User'}`, 14, 33);

        pdf.setFontSize(14);
        pdf.text('Summary', 14, 45);
        pdf.setFontSize(10);
        pdf.text(`Total Income: ${formatCurrency(analytics?.total_income)}`, 14, 52);
        pdf.text(`Total Expenses: ${formatCurrency(analytics?.total_expenses)}`, 14, 57);
        pdf.text(`Net Balance: ${formatCurrency(analytics?.total_income - analytics?.total_expenses)}`, 14, 62);

        try {
            const chartsElement = document.getElementById('charts-to-capture');
            if (chartsElement) {
                const canvas = await html2canvas(chartsElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pdfWidth - 28;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 14, 70, imgWidth, imgHeight);
            }
            
            pdf.addPage();
            pdf.setFontSize(14);
            pdf.text('Transaction Details', 14, 20);
            autoTable(pdf, {
                startY: 30,
                head: [['Date', 'Amount (₹)', 'Type', 'Category', 'Description']],
                body: transactions.map(t => [new Date(t.date).toLocaleDateString(), t.amount.toFixed(2), t.type, t.category, t.description || '']),
                theme: 'striped',
                headStyles: { fillColor: [99, 102, 241] }
            });

            pdf.save(`trackify_report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF export error", error);
        }
    };

    const dashboardRef = useRef(null);
    const headerTitleStyle = {
        opacity: scrolled,
        transition: 'opacity 0.3s ease-out',
        transform: `translateY(${(1 - scrolled) * 20}px)`,
    };

    // Data prep for charts
    const pieData = analytics?.expenses_by_category ? Object.entries(analytics.expenses_by_category).map(([name, value]) => ({ name, value })) : [];
    const dailyTrendData = (() => {
        const byDate = {};
        transactions.forEach(t => {
            const day = new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!byDate[day]) byDate[day] = { date: day, income: 0, expense: 0, _ts: new Date(t.date).getTime() };
            if (t.type === 'income') byDate[day].income += t.amount;
            else byDate[day].expense += t.amount;
        });
        return Object.values(byDate).sort((a, b) => a._ts - b._ts).slice(-30);
    })();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-500">
            {/* STICKY HEADER */}
            <header className="sticky top-0 z-50 glass-header px-8 py-4 flex justify-between items-center border-b border-slate-200 dark:border-white/5 backdrop-blur-xl bg-white/70 dark:bg-dark-bg/70">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] shadow-xl shadow-indigo-600/20 flex items-center justify-center -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                        <span className="text-2xl font-black text-white tracking-tighter">T</span>
                    </div>
                    <div style={headerTitleStyle} className="hidden sm:block">
                        <span className="text-lg font-black text-slate-900 dark:text-white">Trackify</span>
                    </div>
                </div>

                {/* NAVIGATION TABS */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/5">
                        {[
                            { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
                            { id: 'transactions', label: 'History', icon: <Clock size={14} /> },
                            { id: 'ai', label: 'AI Advisor', icon: <Sparkles size={14} /> },
                            { id: 'settings', label: 'Strategy', icon: <Target size={14} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-200 dark:border-white/10 ml-4 pl-4">
                        <button onClick={handleExportPDF} className="p-2.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Export Report PDF"><UploadCloud size={18} /></button>
                        <button onClick={handleResetData} className="p-2.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Reset Data"><Trash2 size={18} /></button>
                        <button onClick={handleLogout} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><LogOut size={18} /></button>
                    </div>
                </div>
            </header>

            <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* HERO SUMMARY */}
                <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 px-12 py-16 mb-12 shadow-2xl border border-white/5">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div>
                            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Portfolio Insights</p>
                            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-4">
                                Hello, {user?.full_name?.split(' ')[0] || 'User'}!
                            </h1>
                            <div className="flex items-center gap-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">{clockDate}</span>
                                <span className="text-indigo-500">•</span>
                                <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5 tabular-nums">{clockTime}</span>
                            </div>
                        </div>
                        <div className="flex gap-8">
                            <div className="text-right">
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mb-1">Net Savings</p>
                                <p className={`text-4xl font-black ${(analytics?.total_income - analytics?.total_expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} tracking-tighter`}>
                                    {formatCurrency((analytics?.total_income || 0) - (analytics?.total_expenses || 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'overview' && (
                            <div className="space-y-12">
                                {/* KPI Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 w-fit mb-6">
                                            <PlusCircle size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Income</h3>
                                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(analytics?.total_income)}</p>
                                    </div>
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 w-fit mb-6">
                                            <MinusCircle size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Expenses</h3>
                                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(analytics?.total_expenses)}</p>
                                    </div>
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 w-fit mb-6">
                                            <Wallet size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Cash On Hand</h3>
                                        <p className="text-4xl font-black text-indigo-600 tracking-tighter">{formatCurrency((analytics?.total_income || 0) - (analytics?.total_expenses || 0))}</p>
                                    </div>
                                </div>

                                {/* Analytics Charts */}
                                <div id="charts-to-capture" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="glass-panel rounded-[3rem] p-10 bg-white/50 dark:bg-dark-card/30 border border-slate-200 dark:border-white/5">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-10 tracking-tight">Fiscal Trajectory</h3>
                                        <div className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={dailyTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f030" />
                                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', background: '#0f172a', color: '#fff' }} />
                                                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} fill="rgba(16, 185, 129, 0.1)" />
                                                    <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={4} fill="rgba(239, 68, 68, 0.1)" />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="glass-panel rounded-[3rem] p-10 bg-white/50 dark:bg-dark-card/30 border border-slate-200 dark:border-white/5 flex flex-col items-center">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-10 tracking-tight w-full">Category Allocation</h3>
                                        <div className="h-[350px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                                                        {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} cornerRadius={10} />)}
                                                    </Pie>
                                                    <Tooltip formatter={v => formatCurrency(v)} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'transactions' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="space-y-10">
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-dark-card/40">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">Log Entry</h3>
                                        <form onSubmit={handleTransactionSubmit} className="space-y-6">
                                            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl">
                                                <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'income' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Income</button>
                                                <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'expense' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Expense</button>
                                            </div>
                                            <div className="space-y-4">
                                                <input type="number" required placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20" />
                                                <input type="text" required placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20" />
                                                <input type="text" placeholder="Narrative" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20" />
                                            </div>
                                            <button type="submit" className={`w-full py-4 rounded-2xl font-black text-white hover:scale-[1.02] transform transition-all active:scale-95 ${type === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'} shadow-2xl`}>Commit Record</button>
                                        </form>
                                    </div>
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 bg-indigo-600/5">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">Smart OCR</h3>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 italic">Import Bank PDF Statements</p>
                                        <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/20 rounded-[2rem] p-12 text-center cursor-pointer hover:bg-white/40 dark:hover:bg-slate-950/40 transition-all" onClick={() => fileInputRef.current?.click()}>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf" className="hidden" />
                                            <UploadCloud className={`mx-auto mb-4 ${uploading ? 'text-indigo-600 animate-bounce' : 'text-slate-300'}`} size={48} />
                                            <p className="text-xs font-black text-slate-500">{uploading ? 'Computing...' : 'Drop Statement'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 glass-panel rounded-[3rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-2xl">
                                    <div className="overflow-auto max-h-[700px]">
                                        <table className="w-full text-left">
                                            <thead className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                                                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                    <th className="px-10 py-6">Temporal Index</th>
                                                    <th className="px-10 py-6">Classification</th>
                                                    <th className="px-10 py-6 text-right">Fiscal Impact</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                {transactions.map(t => (
                                                    <tr key={t.id} className="hover:bg-indigo-600/5 group transition-colors">
                                                        <td className="px-10 py-8">
                                                            <p className="text-xs font-bold text-slate-500">{new Date(t.date).toLocaleDateString()}</p>
                                                            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{t.description || 'System Entry'}</p>
                                                        </td>
                                                        <td className="px-10 py-8">
                                                            <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-[9px] font-black uppercase tracking-tighter rounded-full border border-slate-200 dark:border-white/10">{t.category}</span>
                                                        </td>
                                                        <td className={`px-10 py-8 text-sm font-black text-right tabular-nums ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div className="max-w-5xl mx-auto space-y-10">
                                {loadingAI ? (
                                    <div className="glass-panel rounded-[4rem] p-32 text-center bg-slate-950 border border-white/5 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
                                        <div className="relative z-10 space-y-8">
                                            <Sparkles className="text-indigo-400 animate-spin-slow mx-auto" size={64} />
                                            <h3 className="text-4xl font-black text-white tracking-tighter">Strategic Synthesis</h3>
                                            <p className="text-slate-400 font-bold italic text-sm">The local LLM is parsing your spending patterns... hold (~30s)</p>
                                            <div className="w-full max-w-sm mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 30, ease: "linear" }} className="h-full bg-indigo-600" />
                                            </div>
                                        </div>
                                    </div>
                                ) : aiAdvice ? (
                                    <div className="space-y-10">
                                        <div className="glass-panel rounded-[4rem] p-16 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-emerald-900/50 border border-white/10 shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] -mr-80 -mt-80"></div>
                                            
                                            <div className="relative z-10 flex justify-between items-center mb-16">
                                                <div className="flex items-center gap-6">
                                                    <div className="p-5 bg-white/10 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-3xl">
                                                        <Sparkles className="text-amber-400" size={48} />
                                                    </div>
                                                    <h3 className="text-4xl font-black text-white tracking-tighter">Neural Financial Advisor</h3>
                                                </div>
                                                <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[10px] font-black text-emerald-400 uppercase tracking-widest">Analysis Complete</div>
                                            </div>

                                            <div className="space-y-12 relative z-10">
                                                <div className="p-12 rounded-[3.5rem] bg-white text-slate-950 shadow-4xl">
                                                    <p className="text-3xl font-black leading-tight tracking-tight italic">"{aiAdvice.summary}"</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    {aiAdvice.key_insights.map((insight, i) => (
                                                        <div key={i} className="p-10 rounded-[3rem] bg-slate-950/60 border border-white/5 hover:border-white/20 transition-all">
                                                            <div className="flex justify-between items-center mb-8">
                                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{insight.category}</span>
                                                                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${insight.priority === 'High' ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' : 'bg-amber-500 text-white shadow-xl shadow-amber-500/20'}`}>{insight.priority} Priority</span>
                                                            </div>
                                                            <p className="text-2xl font-black text-white leading-snug">{insight.action}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/10">
                                                    <div className="space-y-8">
                                                        <h4 className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-4">
                                                            <div className="w-2 h-6 bg-red-500 rounded-full"></div> Risk Protocols
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {aiAdvice.risk_alerts.map((alert, i) => (
                                                                <div key={i} className="flex gap-5 p-6 rounded-[2rem] bg-red-500/5 border border-red-500/10 text-sm font-bold text-red-100/70">
                                                                    <AlertTriangle className="text-red-500 shrink-0" size={20} />
                                                                    <span>{alert}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-8">
                                                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-4">
                                                            <div className="w-2 h-6 bg-emerald-400 rounded-full"></div> Growth Potential
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {aiAdvice.savings_tips.map((tip, i) => (
                                                                <div key={i} className="flex gap-5 p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 text-sm font-bold text-emerald-100/70">
                                                                    <TrendingUp className="text-emerald-500 shrink-0" size={20} />
                                                                    <span>{tip}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="p-8 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-500/10">
                                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Refine Neural Focus</h4>
                                                <div className="flex gap-4">
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. Can I afford an iPhone next month?" 
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all"
                                                    />
                                                    <button 
                                                        onClick={() => fetchAiAdvice()}
                                                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                                                    >
                                                        Scan
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => { setAiAdvice(null); fetchAiAdvice(); }} className="w-full py-6 rounded-[3rem] bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all">Full System Re-Scan</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="glass-panel rounded-[4rem] p-32 text-center space-y-12 bg-slate-900/50 border border-indigo-500/20 shadow-4xl">
                                        <div className="w-24 h-24 bg-indigo-600/10 rounded-[2.5rem] flex items-center justify-center mx-auto border border-indigo-500/20">
                                            <Sparkles className="text-indigo-400" size={48} />
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Strategic Intelligence Ready</h3>
                                            <p className="text-slate-500 font-bold max-w-sm mx-auto italic">Analyze your fiscal velocity through our local LLM framework to unlock deep-context savings.</p>
                                        </div>
                                        <div className="space-y-6">
                                            <input 
                                                type="text" 
                                                placeholder="Enter a specific goal (e.g. Save for iPhone)" 
                                                value={aiPrompt}
                                                onChange={(e) => setAiPrompt(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-3xl px-8 py-5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-600/20"
                                            />
                                            <button onClick={() => fetchAiAdvice()} className="w-full px-16 py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-3xl active:scale-95 transition-all">Activate Local AI Advisor</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                <div className="space-y-12">
                                    <div className="glass-panel rounded-[3rem] p-12 border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-dark-card/40 shadow-xl">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-10 flex items-center gap-4">
                                            <Target className="text-indigo-600" /> Fiscal Ceiling
                                        </h3>
                                        <form onSubmit={handleBudgetSubmit} className="space-y-6">
                                            <input type="number" required placeholder="Ceiling (₹)" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20" />
                                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs">{budget ? 'Update Cap' : 'Establish Cap'}</button>
                                        </form>
                                    </div>
                                    <div className="glass-panel rounded-[3rem] p-12 border border-slate-200 dark:border-white/5 bg-slate-950 shadow-xl">
                                        <h3 className="text-xl font-black text-white mb-10 flex items-center gap-4">
                                            <Clock className="text-indigo-500" /> EMI Pipeline
                                        </h3>
                                        <form onSubmit={handleRecurringSubmit} className="space-y-6">
                                            <input type="number" required placeholder="Quantum (₹)" value={reAmount} onChange={e => setReAmount(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-white/5 border border-white/5 font-bold text-white outline-none" />
                                            <div className="grid grid-cols-2 gap-6">
                                                <input type="number" min="1" max="31" placeholder="DOM" value={reDay} onChange={e => setReDay(e.target.value)} className="px-8 py-5 rounded-3xl bg-white/5 border border-white/5 font-bold text-white outline-none" />
                                                <input type="number" min="1" placeholder="Cycles" value={reMonths} onChange={e => setReMonths(e.target.value)} className="px-8 py-5 rounded-3xl bg-white/5 border border-white/5 font-bold text-white outline-none" />
                                            </div>
                                            <input type="text" required placeholder="Class" value={reCategory} onChange={e => setReCategory(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-white/5 border border-white/5 font-bold text-white outline-none" />
                                            <button type="submit" className="w-full py-5 bg-white text-slate-950 rounded-[2rem] font-black uppercase tracking-widest text-xs">Seal Pipeline</button>
                                        </form>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 glass-panel rounded-[4rem] p-12 bg-white/40 dark:bg-dark-card/40 border border-slate-200 dark:border-white/5 shadow-3xl min-h-[600px]">
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-16 tracking-tighter">Active Fiscal Obligations</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {recurringExpenses.map(re => (
                                            <div key={re.id} className="p-10 rounded-[3rem] bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 shadow-2xl relative group overflow-hidden">
                                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Clock size={100} /></div>
                                                <div className="relative z-10 flex flex-col h-full">
                                                    <div className="flex justify-between items-start mb-10">
                                                        <div>
                                                            <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{re.category}</h4>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{re.description || 'Commitment'}</p>
                                                        </div>
                                                        <p className="text-2xl font-black text-indigo-600">{formatCurrency(re.amount)}</p>
                                                    </div>
                                                    <div className="mt-auto space-y-6">
                                                        <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-600" style={{ width: `${(re.months_paid / re.total_months) * 100}%` }}></div>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress: {re.months_paid}/{re.total_months} Cycles</p>
                                                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                                Next <ChevronRight size={10} /> {new Date(re.next_deduction_date).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {recurringExpenses.length === 0 && (
                                            <div className="col-span-full py-40 text-center space-y-6 opacity-30">
                                                <Clock size={64} className="mx-auto" />
                                                <p className="text-lg font-black italic uppercase tracking-widest">No Obligations Found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.main>
        </div>
    );
}
