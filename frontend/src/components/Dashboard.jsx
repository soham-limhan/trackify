import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { LogOut, PlusCircle, MinusCircle, Wallet, Target, Activity, UploadCloud, Trash2, Clock, Sparkles } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    LineChart, Line, AreaChart, Area, ComposedChart,
    RadialBarChart, RadialBar
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import { API_BASE_URL, WS_BASE_URL } from '../config';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

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

    const connectClock = useCallback(() => {
        const ws = new WebSocket(`${WS_BASE_URL}/ws/clock`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setClockTime(data.time);
            setClockDate(data.date);
        };
        ws.onclose = () => {
            // Reconnect after 2 seconds if connection drops
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
            // Calculate how far down the page we've scrolled (0 to 1 ratio)
            // We adjust so the maximum scroll effect finishes sooner rather than at the very bottom
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
            // Reset form
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
            // Reset form
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
            fetchData(); // Refresh all data
            setTimeout(() => setUploadMsg(''), 4000); // clear msg after 4 sec
        } catch (error) {
            console.error("Error uploading statement", error);
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

    // Calculate dynamic styles for the title based on scroll position
    const titleStyle = {
        transform: `translate(${scrolled * 40}vw, -${scrolled * 30}vh) scale(${1 - (scrolled * 0.4)})`,
        opacity: Math.max(0.6, 1 - (scrolled * 0.5)),
        transition: 'transform 0.1s ease-out, opacity 0.1s ease-out'
    };

    const headerTitleStyle = {
        opacity: scrolled,
        transition: 'opacity 0.3s ease-out',
        transform: `translateY(${(1 - scrolled) * 20}px)`,
    };

    const dashboardRef = useRef(null);

    const handleExportCSV = () => {
        window.open(`${API_BASE_URL}/api/transactions/export/csv?token=` + localStorage.getItem('token'), '_blank');
        // Actually, since we use axios with headers, it's better to fetch and download
        fetchExport('/transactions/export/csv', `trackify_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportExcel = () => {
        fetchExport('/transactions/export/excel', `trackify_transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const fetchExport = async (url, filename) => {
        try {
            const response = await axiosInstance.get(url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed. Please try again.");
        }
    };

    const handleExportPDF = async () => {
        if (!dashboardRef.current) return;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.setFontSize(22);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Trackify Financial Report', 14, 20);

        pdf.setFontSize(10);
        pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
        pdf.text(`User: ${user?.full_name || 'Valued User'}`, 14, 33);

        // Add Summary
        pdf.setFontSize(14);
        pdf.text('Summary', 14, 45);
        pdf.setFontSize(10);
        pdf.text(`Total Income: ${formatCurrency(analytics?.total_income)}`, 14, 52);
        pdf.text(`Total Expenses: ${formatCurrency(analytics?.total_expenses)}`, 14, 57);
        pdf.text(`Net Savings: ${formatCurrency(analytics?.total_income - analytics?.total_expenses)}`, 14, 62);

        // Capture charts
        try {
            const chartsElement = document.getElementById('charts-to-capture');
            if (chartsElement) {
                const canvas = await html2canvas(chartsElement, {
                    scale: 2,
                    backgroundColor: '#1e1b4b', // Match the dashboard background
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pdfWidth - 28;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 14, 70, imgWidth, imgHeight);

                // Add transactions table on a new page if needed
                pdf.addPage();
                pdf.setFontSize(14);
                pdf.text('Transaction Details', 14, 20);

                const tableData = transactions.map(t => [
                    new Date(t.date).toLocaleDateString(),
                    t.amount.toFixed(2),
                    t.type,
                    t.category,
                    t.description || ''
                ]);

                autoTable(pdf, {
                    startY: 30,
                    head: [['Date', 'Amount (₹)', 'Type', 'Category', 'Description']],
                    body: tableData,
                    theme: 'striped',
                    headStyles: { fillColor: [99, 102, 241] }
                });

                pdf.save(`trackify_report_${new Date().toISOString().split('T')[0]}.pdf`);
            }
        } catch (error) {
            console.error("PDF generation failed", error);
            alert("Failed to generate PDF report.");
        }
    };

    // Data prep for charts
    const pieData = analytics?.expenses_by_category ?
        Object.entries(analytics.expenses_by_category).map(([name, value]) => ({ name, value }))
        : [];

    const barData = analytics ? [
        { name: 'Income', amount: analytics.total_income },
        { name: 'Expenses', amount: analytics.total_expenses },
        { name: 'Savings', amount: Math.max(0, analytics.total_income - analytics.total_expenses) }
    ] : [];

    // Daily trend data: group transactions by date
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

    // Cumulative net savings over time
    const cumulativeData = (() => {
        let running = 0;
        return dailyTrendData.map(d => {
            running += d.income - d.expense;
            return { date: d.date, savings: Math.round(running) };
        });
    })();

    // Weekly spending pattern (Mon–Sun)
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = (() => {
        const totals = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const d = DAYS[new Date(t.date).getDay()];
            totals[d] += t.amount;
        });
        return DAYS.map(day => ({ day, amount: Math.round(totals[day]) }));
    })();

    // Top 5 expense categories (horizontal bar)
    const topCategories = analytics?.expenses_by_category
        ? Object.entries(analytics.expenses_by_category)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
        : [];

    // Savings rate radial gauge
    const savingsRate = analytics?.total_income > 0
        ? Math.min(100, Math.round(((analytics.total_income - analytics.total_expenses) / analytics.total_income) * 100))
        : 0;
    const radialData = [{ name: 'Saved', value: Math.max(0, savingsRate), fill: savingsRate >= 0 ? '#6366f1' : '#ef4444' }];

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-50 glass-header px-6 py-4 flex justify-between items-center transition-all duration-300">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl shadow-lg flex items-center justify-center -rotate-3">
                        <span className="text-xl font-black text-slate-900 tracking-tighter">Tr</span>
                    </div>
                    {/* Compact Title that fades in when scrolling down */}
                    <div style={headerTitleStyle} className="overflow-hidden">
                        <span className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">
                            Welcome, {user?.full_name?.split(' ')[0] || 'User'}
                        </span>
                    </div>
                </div>

                {/* Live Clock */}
                {clockTime && (
                    <div className="hidden md:flex flex-col items-center justify-center px-5 py-2 bg-slate-50/70 backdrop-blur-xl rounded-2xl border border-white/70 shadow-inner">
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-indigo-600" />
                            <span className="text-xl font-black text-slate-900 tracking-tight tabular-nums">
                                {clockTime}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-800 tracking-wider uppercase mt-0.5">
                            {clockDate}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 text-xs font-bold rounded-lg transition-all shadow-sm"
                            title="Download PDF Report"
                        >
                            PDF
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-900 text-xs font-bold rounded-lg transition-all shadow-sm"
                            title="Export to Excel"
                        >
                            Excel
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-slate-900 text-xs font-bold rounded-lg transition-all shadow-sm"
                            title="Export to CSV"
                        >
                            CSV
                        </button>
                    </div>
                    <button
                        onClick={handleResetData}
                        className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-red-100 hover:text-red-600 text-slate-900 font-bold rounded-lg border border-slate-200 transition-all shadow-sm hover:shadow"
                        title="Reset all amounts and figures"
                    >
                        <Trash2 size={16} strokeWidth={2.5} />
                        <span className="hidden sm:inline">Reset Data</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-red-100 hover:text-red-600 text-slate-900 font-bold rounded-lg border border-slate-200 transition-all shadow-sm hover:shadow"
                    >
                        <LogOut size={16} strokeWidth={2.5} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, staggerChildren: 0.1 }} ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section with Parallax Effect */}
                <div className="relative h-[40vh] min-h-[300px] flex items-center mb-12 pointer-events-none">
                    <div
                        style={titleStyle}
                        className="absolute inset-0 flex flex-col justify-center transform-gpu origin-top-left z-10"
                    >
                        <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] mb-4">
                            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900">Trackify</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-800 font-semibold max-w-2xl drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
                            Master your finances with beautiful visualizations and intelligent tracking.
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 relative z-20">
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }, hover: { scale: 1.02 } }} className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200 hover:-translate-y-1 transition-transform">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Total Income</h3>
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><PlusCircle size={20} /></div>
                        </div>
                        <p className="text-4xl font-black text-slate-900">{formatCurrency(analytics?.total_income)}</p>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }, hover: { scale: 1.02 } }} className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200 hover:-translate-y-1 transition-transform">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Total Expenses</h3>
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg"><MinusCircle size={20} /></div>
                        </div>
                        <p className="text-4xl font-black text-slate-900">{formatCurrency(analytics?.total_expenses)}</p>
                        {budget && (
                            <div className="mt-4 pt-4 border-t border-white/10/50">
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-slate-600">Budget Limit</span>
                                    <span className={analytics?.total_expenses > budget ? 'text-red-600' : 'text-emerald-600'}>
                                        {((analytics?.total_expenses / budget) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${analytics?.total_expenses > budget ? 'bg-red-500' : 'bg-indigo-600'}`}
                                        style={{ width: `${Math.min((analytics?.total_expenses / budget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }, hover: { scale: 1.02 } }} className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200 hover:-translate-y-1 transition-transform">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Net Savings</h3>
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Wallet size={20} /></div>
                        </div>
                        <p className={`text-4xl font-black ${(analytics?.total_income - analytics?.total_expenses) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.max(0, (analytics?.total_income || 0) - (analytics?.total_expenses || 0)))}
                        </p>
                    </motion.div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Forms Section */}
                    <div className="space-y-8">
                        {/* Transaction Form */}
                        <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Activity className="text-indigo-600" size={24} /> Add Transaction
                            </h3>
                            <form onSubmit={handleTransactionSubmit} className="space-y-4">
                                <div className="flex bg-slate-100/50 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setType('income')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'income' ? 'bg-slate-50 text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                    >
                                        Salary (Income)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('expense')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-slate-50 text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                    >
                                        Debit (Expense)
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Amount (₹)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Category</label>
                                    <input
                                        type="text"
                                        required
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                        placeholder={type === 'income' ? 'e.g. Salary, Freelance' : 'e.g. Groceries, Rent'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                        placeholder="Optional notes"
                                    />
                                </div>

                                <button type="submit" className={`w-full py-3 rounded-xl font-bold text-slate-900 shadow-lg transform transition hover:-translate-y-0.5 ${type === 'income' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm' : 'bg-red-500 hover:bg-red-600 shadow-sm'}`}>
                                    {type === 'income' ? 'Credit Account' : 'Debit Account'}
                                </button>
                            </form>
                        </div>

                        {/* Recurring Expenses (EMI) Form */}
                        <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Clock className="text-indigo-600" size={24} /> Recurring EMI
                                </h3>
                                <button
                                    onClick={() => setShowRecurringForm(!showRecurringForm)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-300"
                                >
                                    {showRecurringForm ? 'Cancel' : '+ Add New'}
                                </button>
                            </div>

                            {showRecurringForm ? (
                                <form onSubmit={handleRecurringSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">EMI Amount (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            value={reAmount}
                                            onChange={(e) => setReAmount(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                            placeholder="Monthly amount"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Day of Month</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                required
                                                value={reDay}
                                                onChange={(e) => setReDay(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Total Months</label>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                value={reMonths}
                                                onChange={(e) => setReMonths(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Category</label>
                                        <input
                                            type="text"
                                            required
                                            value={reCategory}
                                            onChange={(e) => setReCategory(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                            placeholder="e.g. Home Loan, Car EMI"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Description</label>
                                        <input
                                            type="text"
                                            value={reDescription}
                                            onChange={(e) => setReDescription(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-800 placeholder-slate-400"
                                            placeholder="Optional details"
                                        />
                                    </div>
                                    <button type="submit" className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold text-slate-900 shadow-lg shadow-sm transform transition hover:-translate-y-0.5">
                                        Set Recurring EMI
                                    </button>
                                </form>
                            ) : (
                                <p className="text-sm text-slate-500 italic">Setup an EMI to automatically track monthly deductions.</p>
                            )}

                            {/* Budget Form */}
                            <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
                                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Target className="text-purple-600" size={24} /> Set Debit Limit
                                </h3>
                                <form onSubmit={handleBudgetSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Monthly Budget (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={budgetLimit}
                                            onChange={(e) => setBudgetLimit(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-none bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500/30 font-medium text-slate-800 placeholder-slate-400"
                                            placeholder={budget ? formatCurrency(budget) : "0.00"}
                                        />
                                    </div>
                                    <button type="submit" className="w-full py-3 rounded-xl font-bold text-slate-900 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30 transform transition hover:-translate-y-0.5">
                                        {budget ? 'Update Limit' : 'Set Limit'}
                                    </button>
                                </form>
                            </div>

                            {/* Statement Upload */}
                            <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <UploadCloud className="text-blue-500" size={24} /> Smart Import
                                </h3>
                                <p className="text-sm text-slate-600 font-medium mb-6">Upload your bank statement PDF to automatically log your transactions.</p>

                                <div className="relative group cursor-pointer border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:bg-white/80 hover:border-indigo-400 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept="application/pdf"
                                        className="hidden"
                                    />
                                    <UploadCloud className={`mx-auto mb-3 ${uploading ? 'text-blue-500 animate-bounce' : 'text-slate-600 group-hover:text-blue-500'}`} size={32} />
                                    <p className="text-sm font-bold text-slate-800">
                                        {uploading ? 'Processing Statement...' : 'Click to Upload PDF'}
                                    </p>
                                </div>

                                {uploadMsg && (
                                    <div className={`mt-4 p-3 rounded-xl text-sm font-bold text-center ${uploadMsg.includes('Success') ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {uploadMsg}
                                    </div>
                                )}
                            </div>

                            {/* Active EMIs List */}
                            {recurringExpenses.length > 0 && (
                                <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <Clock className="text-indigo-600" size={24} /> Active EMIs
                                    </h3>
                                    <div className="space-y-4">
                                        {recurringExpenses.map((re) => (
                                            <div key={re.id} className="p-4 bg-white/80 rounded-2xl border border-slate-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">{re.category}</h4>
                                                        <p className="text-xs text-slate-500">{re.description}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${re.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                                                        {re.status}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-end mt-4">
                                                    <div className="text-xs font-bold text-slate-600">
                                                        <p>Progress: {re.months_paid}/{re.total_months} months</p>
                                                        <p className="mt-1 text-[10px]">Next: {new Date(re.next_deduction_date).toLocaleDateString()}</p>
                                                    </div>
                                                    <p className="text-lg font-black text-slate-900">{formatCurrency(re.amount)}</p>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-50 rounded-full mt-3 overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500"
                                                        style={{ width: `${(re.months_paid / re.total_months) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Visualizations & History */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Smart Financial Advice */}
                        {analytics?.financial_advice && analytics.financial_advice.length > 0 && (
                            <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200 bg-gradient-to-r from-indigo-50/80 to-emerald-50/80 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/80 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-tight flex items-center gap-3">
                                    <Sparkles className="text-amber-400" size={28} /> AI Financial Advisor
                                </h3>
                                <div className="space-y-4 relative z-10">
                                    {analytics.financial_advice.map((advice, index) => {
                                        let bgColor = 'bg-slate-50';
                                        let borderColor = 'border-slate-200';
                                        let icon = '💡';
                                        
                                        if (advice.startsWith('Alert:') || advice.startsWith('Warning:')) {
                                            bgColor = 'bg-red-100';
                                            borderColor = 'border-red-500/30';
                                            icon = '⚠️';
                                        } else if (advice.startsWith('Great job!')) {
                                            bgColor = 'bg-emerald-100';
                                            borderColor = 'border-emerald-500/30';
                                            icon = '🎉';
                                        } else if (advice.startsWith('Caution:')) {
                                            bgColor = 'bg-amber-100';
                                            borderColor = 'border-amber-500/30';
                                            icon = '⚡';
                                        }
                                        
                                        return (
                                            <div key={index} className={`p-4 rounded-2xl border ${borderColor} ${bgColor} flex items-start gap-4 transition-transform hover:-translate-y-1`}>
                                                <span className="text-2xl mt-1">{icon}</span>
                                                <p className="text-slate-800 font-medium leading-relaxed">{advice}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Visualizations Container */}
                        <div id="charts-to-capture" className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                            <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Financial Insights</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Summary Bar Chart */}
                                    <div className="h-64 flex flex-col items-center">
                                        <h4 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Income vs Expenses</h4>
                                        <ResponsiveContainer width="100%" height="80%">
                                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" tick={{ fill: '#f8fafc', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                                <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fill: '#f8fafc', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    formatter={(value) => formatCurrency(value)}
                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                />
                                                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                                    {barData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : entry.name === 'Expenses' ? '#ef4444' : '#3b82f6'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Category Pie Chart */}
                                    <div className="h-64 flex flex-col items-center">
                                        <h4 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Expenses by Category</h4>
                                        {pieData.length > 0 ? (
                                            <ResponsiveContainer width={200} height={200}>
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={70}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-slate-600 font-medium text-sm">
                                                No expense data yet
                                            </div>
                                        )}
                                        {pieData.length > 0 && <div className="mt-2 text-xs flex gap-2 flex-wrap items-center justify-center">
                                            {pieData.map((item, i) => (
                                                <span key={i} className="flex items-center gap-1 font-medium"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>{item.name}</span>
                                            ))}
                                        </div>}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Transactions List */}
                            <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-900 mb-6">Recent Transactions</h3>

                                {transactions.length === 0 ? (
                                    <div className="text-center py-10 border-white/10 rounded-2xl border border-dashed border-white/10">
                                        <p className="text-slate-600 font-medium">No transactions recorded yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {transactions.slice(0, 10).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between p-4 bg-slate-100/50 rounded-2xl hover:bg-slate-50/10 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                        {t.type === 'income' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{t.category}</p>
                                                        <p className="text-xs text-slate-600 font-medium">
                                                            {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            {t.description && ` • ${t.description}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className={`font-black tracking-tight ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Extra Analytics Grid ─────────────────────────── */}
                    {transactions.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">

                            {/* Weekly Spending Pattern */}
                            <div className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200">
                                <h3 className="text-base font-black text-slate-900 mb-1 tracking-tight">Weekly Pattern</h3>
                                <p className="text-xs text-slate-600 font-medium mb-4">Expenses by day of week</p>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={weeklyData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="30%">
                                        <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                        <YAxis hide />
                                        <Tooltip
                                            formatter={(v) => [formatCurrency(v), 'Spent']}
                                            contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '8px 14px', fontSize: 12 }}
                                        />
                                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                            {weeklyData.map((entry, i) => {
                                                const max = Math.max(...weeklyData.map(d => d.amount));
                                                return <Cell key={i} fill={entry.amount === max ? '#ef4444' : '#6366f1'} fillOpacity={entry.amount === max ? 1 : 0.5} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <p className="text-[10px] text-center text-slate-600 font-semibold mt-1 uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Highest spend day</span>
                                </p>
                            </div>

                            {/* Top Expense Categories */}
                            <div className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200">
                                <h3 className="text-base font-black text-slate-900 mb-1 tracking-tight">Top Categories</h3>
                                <p className="text-xs text-slate-600 font-medium mb-4">Where your money goes</p>
                                {topCategories.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="name" tick={{ fill: '#f8fafc', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={72} />
                                            <Tooltip
                                                formatter={(v) => [formatCurrency(v), 'Spent']}
                                                contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '8px 14px', fontSize: 12 }}
                                            />
                                            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                                {topCategories.map((_, i) => (
                                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-44 text-slate-600 text-sm font-medium">No expense data yet</div>
                                )}
                            </div>

                            {/* Savings Rate Gauge */}
                            <div className="glass rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col">
                                <h3 className="text-base font-black text-slate-900 mb-1 tracking-tight">Savings Rate</h3>
                                <p className="text-xs text-slate-600 font-medium mb-2">% of income saved</p>
                                <div className="flex-1 flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <RadialBarChart
                                            innerRadius="60%"
                                            outerRadius="90%"
                                            data={radialData}
                                            startAngle={210}
                                            endAngle={-30}
                                        >
                                            <defs>
                                                <linearGradient id="radialGrad" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#818cf8" />
                                                    <stop offset="100%" stopColor="#6366f1" />
                                                </linearGradient>
                                            </defs>
                                            <RadialBar
                                                background={{ fill: '#e2e8f0' }}
                                                dataKey="value"
                                                cornerRadius={8}
                                                max={100}
                                            />
                                        </RadialBarChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className={`text-3xl font-black tabular-nums ${savingsRate >= 20 ? 'text-indigo-600' : savingsRate >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                            {savingsRate}%
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Saved</span>
                                    </div>
                                </div>
                                <p className={`text-xs text-center font-bold mt-1 ${savingsRate >= 20 ? 'text-indigo-500' : savingsRate >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                    {savingsRate >= 20 ? '🎉 Great job!' : savingsRate >= 0 ? '⚠️ Try to save more' : '🚨 Over budget!'}
                                </p>
                            </div>
                        </div>
                    )}

                {/* ── Spending Trends ─────────────────────────────── */}
                {dailyTrendData.length > 0 && (
                    <div className="mt-8 space-y-8">
                        {/* Daily Income vs Expense Line Chart */}
                        <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200">
                            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Spending Trends</h3>
                            <p className="text-sm text-slate-600 font-medium mb-8">Daily income &amp; expense activity over time</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f030" />
                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                    <Tooltip
                                        formatter={(value, name) => [formatCurrency(value), name === 'income' ? 'Income' : 'Expense']}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: '12px 16px', fontSize: 13 }}
                                    />
                                    <Area type="monotone" dataKey="income" fill="url(#incomeGradient)" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                                    <Area type="monotone" dataKey="expense" fill="url(#expenseGradient)" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#ef4444' }} />
                                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={0} dot={false} />
                                    <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={0} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-4">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Income
                                </span>
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Expenses
                                </span>
                            </div>
                        </div>

                        {/* Cumulative Net Savings Area Chart */}
                        <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200 bg-gradient-to-br from-indigo-500/5 to-blue-500/5">
                            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Cumulative Savings</h3>
                            <p className="text-sm text-slate-600 font-medium mb-8">Your running net savings growth over time</p>
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={cumulativeData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f030" />
                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v < -1000 ? `-${(Math.abs(v) / 1000).toFixed(0)}k` : v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                    <Tooltip
                                        formatter={(value) => [formatCurrency(value), 'Net Savings']}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: '12px 16px', fontSize: 13 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="savings"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fill="url(#savingsGradient)"
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </motion.main>
        </div>
    );
}
