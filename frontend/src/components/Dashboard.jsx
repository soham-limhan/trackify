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

// Default query run automatically when AI tab opens
const DEFAULT_AI_QUERY = 'Give me the detail insights regarding my transactions and suggest the best way to improve my savings';

/** Ensure an LLM field is always a proper array — guards against the model returning a string. */
const toArray = (val) => (Array.isArray(val) ? val : []);

/** Ensure an LLM field is always a displayable string. */
const toStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const fs = val?.financial_summary || (val?.income !== undefined ? val : null);
    if (fs?.income !== undefined) {
      const rate = fs.savings_rate ?? null;
      const savings = fs.savings ?? (fs.income - (fs.expenses || 0));
      return `Income Rs.${Number(fs.income).toLocaleString('en-IN')} | Expenses Rs.${Number(fs.expenses||0).toLocaleString('en-IN')} | Savings Rs.${Number(savings).toLocaleString('en-IN')}${rate !== null ? ` | Savings rate ${rate}%` : ''}.`;
    }
    return JSON.stringify(val);
  }
  return String(val);
};

/** Smart summary renderer: metric cards for financial objects, quote block for strings. */
const SummaryDisplay = ({ summary, dark = false }) => {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(Number(n)||0);
  const fs = (summary && typeof summary === 'object')
    ? (summary.financial_summary || (summary.income !== undefined ? summary : null))
    : null;

  if (fs) {
    const rate = fs.savings_rate ?? (fs.income ? ((((fs.savings ?? fs.income-(fs.expenses||0))/fs.income)*100)).toFixed(1) : null);
    const savings = fs.savings ?? (fs.income - (fs.expenses||0));
    const metrics = [
      { label:'Total Income',   value: fmt(fs.income),    clr:'emerald' },
      { label:'Total Expenses', value: fmt(fs.expenses),  clr:'red'     },
      { label:'Net Savings',    value: fmt(savings),      clr:'indigo'  },
      { label:'Savings Rate',   value: rate ? `${rate}%` : '--', clr:'amber' },
    ];
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(({ label, value, clr }) => (
          <div key={label} style={{ background:`rgba(var(--${clr}-rgb,99,102,241),0.08)`, border:`1px solid rgba(var(--${clr}-rgb,99,102,241),0.2)` }} className="p-5 rounded-[1.8rem] text-center">
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{color:`var(--${clr}-400, #a5b4fc)`}}>{label}</p>
            <p className="text-lg font-black tabular-nums" style={{color:`var(--${clr}-300, #c7d2fe)`}}>{value}</p>
          </div>
        ))}
      </div>
    );
  }
  const text = toStr(summary);
  if (!text) return null;
  return (
    <p className={`font-bold text-base leading-relaxed italic ${ dark ? 'text-white' : 'text-slate-950' }`}>
      "{text}"
    </p>
  );
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [budget, setBudget] = useState(null);

    // Per-section loading skeletons
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(true);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const [loadingBudget, setLoadingBudget] = useState(true);
    const [loadingRecurring, setLoadingRecurring] = useState(true);

    // Form States
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('expense');
    const [budgetLimit, setBudgetLimit] = useState('');
    // Recurring-credit toggle inside Log Entry form
    const [isRecurring, setIsRecurring]   = useState(false);
    const [dayOfMonth,  setDayOfMonth]    = useState(1);
    const [recurMonths, setRecurMonths]   = useState(12);

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
    const [activeTab, setActiveTab] = useState('overview');
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_QUERY);
    // Streaming AI state
    const [streamingTokens, setStreamingTokens] = useState('');
    const [parsedStream, setParsedStream] = useState({});
    const [aiElapsed, setAiElapsed] = useState(0);
    const [aiError, setAiError] = useState(null);
    const abortControllerRef = useRef(null);
    const aiTimerRef = useRef(null);

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

        // Fire-and-forget: load the Ollama model into memory now so AI Advisor is instant later
        fetch(`${API_BASE_URL}/api/transactions/ai-warmup`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {}); // silently ignore if Ollama is not running

        return () => window.removeEventListener('scroll', handleScroll);
    }, [navigate]);

    const fetchData = () => {
        // Each request resolves independently — data renders as it arrives
        const handle401 = (err) => {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            }
        };

        setLoadingUser(true);
        axiosInstance.get('/auth/me')
            .then(r => setUser(r.data))
            .catch(handle401)
            .finally(() => setLoadingUser(false));

        setLoadingTransactions(true);
        axiosInstance.get('/transactions/')
            .then(r => setTransactions(r.data))
            .catch(err => console.error('transactions fetch:', err))
            .finally(() => setLoadingTransactions(false));

        setLoadingAnalytics(true);
        axiosInstance.get('/transactions/analytics')
            .then(r => setAnalytics(r.data))
            .catch(err => console.error('analytics fetch:', err))
            .finally(() => setLoadingAnalytics(false));

        setLoadingBudget(true);
        axiosInstance.get('/transactions/budget')
            .then(r => { if (r.data) setBudget(r.data.limit_amount); })
            .catch(err => console.error('budget fetch:', err))
            .finally(() => setLoadingBudget(false));

        setLoadingRecurring(true);
        axiosInstance.get('/transactions/recurring')
            .then(r => setRecurringExpenses(r.data))
            .catch(err => console.error('recurring fetch:', err))
            .finally(() => setLoadingRecurring(false));
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const cancelAI = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        clearInterval(aiTimerRef.current);
        setLoadingAI(false);
        setStreamingTokens('');
        setParsedStream({});
        setAiElapsed(0);
    };

    // Safely parse the accumulating JSON stream outside of render
    useEffect(() => {
        if (!streamingTokens) { setParsedStream({}); return; }
        try {
            // Happy path: full valid JSON
            setParsedStream(JSON.parse(streamingTokens));
        } catch {
            // Partial JSON — extract what we can via regex
            const partial = {};
            const sumMatch = streamingTokens.match(/"summary"\s*:\s*"([^"]+)/);
            if (sumMatch) partial.summary = sumMatch[1];
            try {
                const insightMatch = streamingTokens.match(/"key_insights"\s*:\s*(\[[^\]]*\])/);
                if (insightMatch) partial.key_insights = JSON.parse(insightMatch[1]);
            } catch { /* incomplete array, skip */ }
            try {
                const tipsMatch = streamingTokens.match(/"savings_tips"\s*:\s*(\[[^\]]*\])/);
                if (tipsMatch) partial.savings_tips = JSON.parse(tipsMatch[1]);
            } catch { /* incomplete array, skip */ }
            try {
                const alertMatch = streamingTokens.match(/"risk_alerts"\s*:\s*(\[[^\]]*\])/);
                if (alertMatch) partial.risk_alerts = JSON.parse(alertMatch[1]);
            } catch { /* incomplete array, skip */ }
            setParsedStream(partial);
        }
    }, [streamingTokens]);

    const fetchAiAdvice = async (forceQuery = null) => {
        if (aiAdvice && !forceQuery && !aiPrompt) return;

        // Cancel any in-flight stream
        cancelAI();

        const queryToSend = forceQuery || aiPrompt || null;
        setLoadingAI(true);
        setAiAdvice(null);
        setAiError(null);
        setStreamingTokens('');
        setAiElapsed(0);

        // Start elapsed timer
        const startTime = Date.now();
        aiTimerRef.current = setInterval(() => {
            setAiElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(
                `${API_BASE_URL}/api/transactions/ai-advice/stream`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ user_query: queryToSend }),
                    signal: controller.signal
                }
            );

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6);

                    if (payload === '[DONE]') {
                        // Parse the complete accumulated JSON
                        try {
                            const parsed = JSON.parse(accumulated);
                            // Force every array field to actually be an array
                            // (the LLM occasionally returns a string or omits the field)
                            parsed.summary = toStr(parsed.summary) || 'N/A';
                            parsed.key_insights = toArray(parsed.key_insights);
                            parsed.savings_tips = toArray(parsed.savings_tips);
                            parsed.risk_alerts = toArray(parsed.risk_alerts);
                            setAiAdvice(parsed);
                        } catch (e) {
                            setAiError('Could not parse AI response. Please try again.');
                        }
                        setLoadingAI(false);
                        clearInterval(aiTimerRef.current);
                        setStreamingTokens('');
                        return;
                    }

                    if (payload.startsWith('[ERROR]')) {
                        setAiError(payload.replace('[ERROR] ', ''));
                        setLoadingAI(false);
                        clearInterval(aiTimerRef.current);
                        return;
                    }

                    // Unescape \n back to real newlines for display
                    const token = payload.replace(/\\n/g, '\n');
                    accumulated += token;
                    setStreamingTokens(accumulated);
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('AI streaming error:', err);
                setAiError('Connection failed. Is the backend running?');
            }
        } finally {
            clearInterval(aiTimerRef.current);
            setLoadingAI(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ai') {
            // Auto-run with the default query on first load
            fetchAiAdvice(DEFAULT_AI_QUERY);
        }
        // Cancel stream when leaving AI tab
        return () => { if (activeTab === 'ai') cancelAI(); };
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
            if (isRecurring) {
                // Post to the recurring endpoint so it repeats monthly
                await axiosInstance.post('/transactions/recurring', {
                    amount:       parseFloat(amount),
                    category,
                    description,
                    day_of_month: parseInt(dayOfMonth),
                    total_months: parseInt(recurMonths),
                    // Pass the type so income credits (salary) work correctly
                    type,
                });
            } else {
                await axiosInstance.post('/transactions/', {
                    amount: parseFloat(amount),
                    type,
                    category,
                    description,
                });
            }
            setAmount('');
            setCategory('');
            setDescription('');
            setIsRecurring(false);
            setDayOfMonth(1);
            setRecurMonths(12);
            fetchData();
        } catch (error) {
            console.error('Error adding transaction', error);
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
    const [trendFrom, setTrendFrom] = useState('');
    const [trendTo,   setTrendTo]   = useState('');

    // All-time daily trend
    const dailyTrendData = (() => {
        const byDate = {};
        transactions.forEach(t => {
            const day = new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (!byDate[day]) byDate[day] = { date: day, income: 0, expense: 0, _ts: new Date(t.date).getTime() };
            if (t.type === 'income') byDate[day].income += t.amount;
            else byDate[day].expense += t.amount;
        });
        return Object.values(byDate).sort((a, b) => a._ts - b._ts);
    })();

    // Apply custom date range filter (or fall back to last 30 days when nothing is set)
    const filteredTrendData = (() => {
        const fromMs = trendFrom ? new Date(trendFrom).setHours(0,0,0,0) : null;
        const toMs   = trendTo   ? new Date(trendTo).setHours(23,59,59,999) : null;
        if (fromMs || toMs) {
            return dailyTrendData.filter(d => {
                if (fromMs && d._ts < fromMs) return false;
                if (toMs   && d._ts > toMs)   return false;
                return true;
            });
        }
        return dailyTrendData.slice(-30); // default: last 30 days
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
                                className={`flex items-center gap-3 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
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
                <div className="relative overflow-hidden rounded-[3rem] dark-card px-12 py-16 mb-12 shadow-2xl">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div>
                            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Portfolio Insights</p>
                            {loadingUser ? (
                                <div className="space-y-3 mb-4">
                                    <div className="skeleton-dark h-14 w-72 rounded-2xl" />
                                </div>
                            ) : (
                                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-4">
                                    Hello, {user?.full_name?.split(' ')[0] || 'User'}!
                                </h1>
                            )}
                            <div className="flex items-center gap-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">{clockDate}</span>
                                <span className="text-indigo-500">•</span>
                                <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5 tabular-nums">{clockTime}</span>
                            </div>
                        </div>
                        <div className="flex gap-8">
                            <div className="text-right">
                                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mb-1">Net Savings</p>
                                {loadingAnalytics ? (
                                    <div className="skeleton-dark h-10 w-40 rounded-xl ml-auto" />
                                ) : (
                                    <p className={`text-4xl font-black ${
                                        (analytics?.total_income - analytics?.total_expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    } tracking-tighter`}>
                                        {formatCurrency((analytics?.total_income || 0) - (analytics?.total_expenses || 0))}
                                    </p>
                                )}
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
                                    {/* Income */}
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 w-fit mb-6">
                                            <PlusCircle size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Income</h3>
                                        {loadingAnalytics
                                            ? <div className="skeleton h-10 w-36 rounded-xl" />
                                            : <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(analytics?.total_income)}</p>
                                        }
                                    </div>
                                    {/* Expenses */}
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 w-fit mb-6">
                                            <MinusCircle size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Expenses</h3>
                                        {loadingAnalytics
                                            ? <div className="skeleton h-10 w-36 rounded-xl" />
                                            : <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(analytics?.total_expenses)}</p>
                                        }
                                    </div>
                                    {/* Cash on hand */}
                                    <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative group hover:-translate-y-2 transition-transform">
                                        <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 w-fit mb-6">
                                            <Wallet size={32} />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Cash On Hand</h3>
                                        {loadingAnalytics
                                            ? <div className="skeleton h-10 w-36 rounded-xl" />
                                            : <p className="text-4xl font-black text-indigo-600 tracking-tighter">{formatCurrency((analytics?.total_income || 0) - (analytics?.total_expenses || 0))}</p>
                                        }
                                    </div>
                                </div>

                                {/* Analytics Charts */}
                                <div id="charts-to-capture" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="glass-panel rounded-[3rem] p-10 bg-white/50 dark:bg-dark-card/30 border border-slate-200 dark:border-white/5">
                                        {/* Header row */}
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Spending vs Saving Trends</h3>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                                    {filteredTrendData.length} day{filteredTrendData.length !== 1 ? 's' : ''} shown
                                                </p>
                                            </div>
                                            {/* Quick range pills */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {[['7D',7],['30D',30],['90D',90],['All',null]].map(([label, days]) => {
                                                    const isActive = (() => {
                                                        if (!trendFrom && !trendTo) return days === 30;
                                                        if (days === null) return !trendFrom && !trendTo;
                                                        return false;
                                                    })();
                                                    return (
                                                        <button
                                                            key={label}
                                                            onClick={() => {
                                                                setTrendFrom('');
                                                                setTrendTo('');
                                                                if (days !== null) {
                                                                    const d = new Date();
                                                                    d.setDate(d.getDate() - days);
                                                                    setTrendFrom(d.toISOString().slice(0,10));
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                                isActive
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                                                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-indigo-500/40 hover:text-indigo-500'
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Custom date range inputs */}
                                        <div className="flex items-center gap-3 mb-8 flex-wrap">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custom range</span>
                                            <input
                                                type="date"
                                                value={trendFrom}
                                                max={trendTo || undefined}
                                                onChange={e => setTrendFrom(e.target.value)}
                                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                            />
                                            <span className="text-slate-300 dark:text-slate-600 font-black">→</span>
                                            <input
                                                type="date"
                                                value={trendTo}
                                                min={trendFrom || undefined}
                                                onChange={e => setTrendTo(e.target.value)}
                                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                            />
                                            {(trendFrom || trendTo) && (
                                                <button
                                                    onClick={() => { setTrendFrom(''); setTrendTo(''); }}
                                                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors px-2"
                                                >✕ Clear</button>
                                            )}
                                        </div>

                                        {/* Legend */}
                                        <div className="flex items-center gap-6 mb-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-1 rounded-full bg-emerald-500"/>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Income</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-1 rounded-full bg-red-500"/>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Spending</span>
                                            </div>
                                        </div>

                                        <div className="h-[280px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={filteredTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f030" />
                                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '1.5rem', border: 'none', background: '#0f172a', color: '#fff', fontSize: 12 }}
                                                        formatter={(v, name) => [formatCurrency(v), name === 'income' ? 'Income' : 'Spending']}
                                                    />
                                                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fill="rgba(16,185,129,0.08)" dot={false} />
                                                    <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fill="rgba(239,68,68,0.08)" dot={false} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="glass-panel rounded-[3rem] p-10 bg-white/50 dark:bg-dark-card/30 border border-slate-200 dark:border-white/5 flex flex-col">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Category Allocation</h3>
                                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                                {pieData.length} categories
                                            </span>
                                        </div>

                                        {pieData.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-bold">No expense data yet</div>
                                        ) : (() => {
                                            const totalPie = pieData.reduce((s, d) => s + d.value, 0);
                                            const sorted   = [...pieData].sort((a, b) => b.value - a.value);
                                            return (
                                                <div className="flex flex-col gap-8">
                                                    {/* Donut + centre stat */}
                                                    <div className="relative h-[240px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={sorted}
                                                                    cx="50%" cy="50%"
                                                                    innerRadius={72} outerRadius={104}
                                                                    paddingAngle={4}
                                                                    dataKey="value"
                                                                    stroke="none"
                                                                    startAngle={90} endAngle={-270}
                                                                >
                                                                    {sorted.map((_, i) => (
                                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} cornerRadius={8} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    content={({ active, payload }) => {
                                                                        if (!active || !payload?.length) return null;
                                                                        const d = payload[0];
                                                                        const pct = ((d.value / totalPie) * 100).toFixed(1);
                                                                        return (
                                                                            <div className="px-4 py-3 rounded-2xl text-white text-xs font-black shadow-2xl" style={{ background: d.payload.fill, minWidth: 140 }}>
                                                                                <p className="uppercase tracking-widest text-[9px] opacity-70 mb-1">{d.name}</p>
                                                                                <p className="text-base">{formatCurrency(d.value)}</p>
                                                                                <p className="opacity-70">{pct}% of spend</p>
                                                                            </div>
                                                                        );
                                                                    }}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                        {/* Centre label */}
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Spend</p>
                                                            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-1">{formatCurrency(totalPie)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Legend rows */}
                                                    <div className="space-y-3">
                                                        {sorted.map((item, i) => {
                                                            const pct = ((item.value / totalPie) * 100).toFixed(1);
                                                            const clr = COLORS[i % COLORS.length];
                                                            return (
                                                                <div key={item.name} className="flex items-center gap-3 group">
                                                                    {/* Colour dot */}
                                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: clr }} />
                                                                    {/* Category name */}
                                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex-1 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                                        {item.name}
                                                                    </span>
                                                                    {/* Progress bar */}
                                                                    <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full transition-all duration-700"
                                                                            style={{ width: `${pct}%`, background: clr }}
                                                                        />
                                                                    </div>
                                                                    {/* Amount + % */}
                                                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
                                                                    <span className="text-xs font-black text-slate-700 dark:text-white tabular-nums w-24 text-right">{formatCurrency(item.value)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
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
                                            {/* Income / Expense toggle */}
                                            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl">
                                                <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'income' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400'}`}>Income</button>
                                                <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${type === 'expense' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400'}`}>Expense</button>
                                            </div>

                                            {/* Core fields */}
                                            <div className="space-y-4">
                                                <input type="number" required placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20 text-slate-900 dark:text-white bg-transparent" />
                                                <input type="text" required placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20 text-slate-900 dark:text-white bg-transparent" />
                                                <input type="text" placeholder="Narrative" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-slate-200 dark:border-white/5 font-bold outline-none ring-2 ring-transparent focus:ring-indigo-600/20 text-slate-900 dark:text-white bg-transparent" />
                                            </div>

                                            {/* ── Repeat monthly toggle ─────────────────────────── */}
                                            <div className={`rounded-2xl border transition-all overflow-hidden ${ isRecurring ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-200 dark:border-white/5' }`}>
                                                {/* Toggle row */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsRecurring(r => !r)}
                                                    className="w-full flex items-center justify-between px-5 py-4"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">🔁</span>
                                                        <div className="text-left">
                                                            <p className="text-xs font-black text-slate-700 dark:text-slate-200">Repeat monthly</p>
                                                            <p className="text-[10px] text-slate-400">e.g. salary, rent, subscription</p>
                                                        </div>
                                                    </div>
                                                    {/* Pill switch */}
                                                    <div className={`w-11 h-6 rounded-full transition-colors relative ${ isRecurring ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700' }`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${ isRecurring ? 'translate-x-6' : 'translate-x-1' }`} />
                                                    </div>
                                                </button>

                                                {/* Expanded options */}
                                                {isRecurring && (
                                                    <div className="px-5 pb-5 space-y-4 border-t border-indigo-500/10">
                                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Day of month</label>
                                                                <input
                                                                    type="number"
                                                                    min={1} max={28}
                                                                    value={dayOfMonth}
                                                                    onChange={e => setDayOfMonth(e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-xl border border-indigo-500/20 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                                                                />
                                                                <p className="text-[9px] text-slate-400 mt-1">Credited on the {dayOfMonth}{dayOfMonth==1?'st':dayOfMonth==2?'nd':dayOfMonth==3?'rd':'th'} of each month</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Duration</label>
                                                                <select
                                                                    value={recurMonths}
                                                                    onChange={e => setRecurMonths(e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-xl border border-indigo-500/20 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                                                                >
                                                                    {[3,6,12,24,36,60].map(m => (
                                                                        <option key={m} value={m}>{m} months{m===12?' (1 yr)':m===24?' (2 yr)':m===36?' (3 yr)':m===60?' (5 yr)':''}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/15">
                                                            <span className="text-indigo-400 text-xs">ℹ</span>
                                                            <p className="text-[10px] font-bold text-indigo-400">
                                                                {amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '...'} will be auto-recorded on the {dayOfMonth}{dayOfMonth==1?'st':dayOfMonth==2?'nd':dayOfMonth==3?'rd':'th'} for {recurMonths} months
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="submit"
                                                className={`w-full py-4 rounded-2xl font-black text-white hover:scale-[1.02] transform transition-all active:scale-95 ${ type === 'income' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'} shadow-2xl`}
                                            >
                                                {isRecurring ? '🔁 Set Recurring' : 'Commit Record'}
                                            </button>
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
                                                            <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-[9px] font-black uppercase tracking-tighter rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">{t.category}</span>
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
                                    <div className="dark-card rounded-[4rem] overflow-hidden relative" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                                        {/* Header bar */}
                                        <div className="relative z-10 flex items-center justify-between px-10 pt-10 pb-6 border-b border-white/5">
                                            <div className="flex items-center gap-4">
                                                <Sparkles className="text-indigo-400 animate-spin-slow" size={28} />
                                                <div>
                                                    <p className="text-white font-black text-lg tracking-tight">
                                                        {aiElapsed < 5 ? 'Warming up LLM...' : streamingTokens ? 'Building your report...' : 'Generating insights...'}
                                                    </p>
                                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                                        {aiElapsed}s elapsed
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={cancelAI}
                                                className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        {/* Live informative preview — driven by parsedStream state, never inline parsing */}
                                        <div className="relative z-10 px-10 py-8 space-y-6">
                                            {(parsedStream.summary || toArray(parsedStream.key_insights).length || toArray(parsedStream.savings_tips).length || toArray(parsedStream.risk_alerts).length) ? (
                                                <div className="space-y-6">
                                                    {parsedStream.summary && (
                                                        <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10">
                                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Sparkles size={12}/> Summary
                                                            </p>
                                                            <SummaryDisplay summary={parsedStream.summary} dark={true} />
                                                            <span className="cursor-blink ml-1 text-indigo-400"/>
                                                        </div>
                                                    )}
                                                    {toArray(parsedStream.key_insights).length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 px-2">Key Insights</p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {toArray(parsedStream.key_insights).map((ins, i) => (
                                                                    <div key={i} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col gap-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">{ins.category}</span>
                                                                            <span className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase ${ins.priority === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{ins.priority}</span>
                                                                        </div>
                                                                        <p className="text-sm font-bold text-white leading-snug">{ins.action}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(toArray(parsedStream.savings_tips).length > 0 || toArray(parsedStream.risk_alerts).length > 0) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {toArray(parsedStream.risk_alerts).length > 0 && (
                                                                <div className="space-y-3">
                                                                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2 px-2"><AlertTriangle size={10}/> Risk Alerts</p>
                                                                    {toArray(parsedStream.risk_alerts).map((a, i) => (
                                                                        <div key={i} className="flex gap-3 p-4 rounded-[1.5rem] bg-red-500/5 border border-red-500/10 text-xs font-bold text-red-300/80">
                                                                            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={14}/> {a}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {toArray(parsedStream.savings_tips).length > 0 && (
                                                                <div className="space-y-3">
                                                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 px-2"><TrendingUp size={10}/> Savings Tips</p>
                                                                    {toArray(parsedStream.savings_tips).map((t, i) => (
                                                                        <div key={i} className="flex gap-3 p-4 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/10 text-xs font-bold text-emerald-300/80">
                                                                            <TrendingUp className="text-emerald-400 shrink-0 mt-0.5" size={14}/> {t}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                                                    <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                                                        <Sparkles className="text-indigo-400 animate-pulse" size={24}/>
                                                    </div>
                                                    <p className="text-slate-400 font-bold text-sm">
                                                        {aiElapsed < 5 ? 'Loading model into memory...' : 'Analysing your transactions...'}
                                                    </p>
                                                    <span className="cursor-blink text-indigo-400"/>
                                                </div>
                                            )}
                                        </div>

                                        {/* Indeterminate progress bar */}
                                        <div className="relative z-10 px-10 pb-10">
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-indigo-600"
                                                    animate={{ x: ['-100%', '200%'] }}
                                                    transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : aiError ? (
                                    <div className="dark-card rounded-[4rem] p-20 text-center space-y-8" style={{border:'1px solid rgba(239,68,68,0.2)'}}>
                                        <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20">
                                            <AlertTriangle className="text-red-400" size={40} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white tracking-tight mb-2">AI Advisor Unavailable</h3>
                                            <p className="text-red-400/70 font-bold text-sm">{aiError}</p>
                                        </div>
                                        <button
                                            onClick={() => { setAiError(null); fetchAiAdvice(); }}
                                            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : aiAdvice ? (
                                    <div className="space-y-10">
                                        <div className="dark-card rounded-[4rem] p-16 shadow-2xl relative overflow-hidden" style={{background: 'linear-gradient(135deg, #0d0f2b 0%, #050914 50%, #061a12 100%)'}}>
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
                                                    <SummaryDisplay summary={aiAdvice.summary} dark={false} />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    {toArray(aiAdvice.key_insights).map((insight, i) => (
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
                                                            {toArray(aiAdvice.risk_alerts).map((alert, i) => (
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
                                                            {toArray(aiAdvice.savings_tips).map((tip, i) => (
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
                                    <div className="dark-card rounded-[4rem] p-32 text-center space-y-12" style={{border: '1px solid rgba(99,102,241,0.15)'}}>
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
                                                className="w-full rounded-3xl px-8 py-5 text-sm font-bold text-slate-900 dark:text-white outline-none border border-slate-200 dark:border-white/5 focus:ring-2 focus:ring-indigo-600/20"
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
                                            <input type="number" required placeholder="Ceiling (₹)" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} className="w-full px-8 py-5 rounded-3xl border border-slate-200 dark:border-white/5 font-bold text-slate-900 dark:text-white outline-none ring-2 ring-transparent focus:ring-indigo-600/20" />
                                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs">{budget ? 'Update Cap' : 'Establish Cap'}</button>
                                        </form>
                                    </div>
                                    <div className="dark-card rounded-[3rem] p-12 shadow-xl">
                                        <h3 className="text-xl font-black text-white mb-10 flex items-center gap-4">
                                            <Clock className="text-indigo-500" /> EMI Pipeline
                                        </h3>
                                        <form onSubmit={handleRecurringSubmit} className="space-y-6">
                                            <input type="number" required placeholder="Quantum (₹)" value={reAmount} onChange={e => setReAmount(e.target.value)} className="w-full px-8 py-5 rounded-3xl font-bold outline-none" />
                                            <div className="grid grid-cols-2 gap-6">
                                                <input type="number" min="1" max="31" placeholder="DOM" value={reDay} onChange={e => setReDay(e.target.value)} className="px-8 py-5 rounded-3xl font-bold outline-none" />
                                                <input type="number" min="1" placeholder="Cycles" value={reMonths} onChange={e => setReMonths(e.target.value)} className="px-8 py-5 rounded-3xl font-bold outline-none" />
                                            </div>
                                            <input type="text" required placeholder="Class" value={reCategory} onChange={e => setReCategory(e.target.value)} className="w-full px-8 py-5 rounded-3xl font-bold outline-none" />
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
                                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{re.description || 'Commitment'}</p>
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
                                            <div className="col-span-full py-40 text-center space-y-6">
                                                <Clock size={64} className="mx-auto text-slate-300 dark:text-slate-700" />
                                                <p className="text-lg font-black italic uppercase tracking-widest text-slate-400 dark:text-slate-600">No Obligations Found</p>
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
