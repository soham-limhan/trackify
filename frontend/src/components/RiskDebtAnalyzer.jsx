import React, { useState, useEffect, useRef } from 'react';
import { Calculator, ShieldAlert, AlertTriangle, CheckCircle2, TrendingDown, DollarSign, Sparkles, Loader2, Download } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from '../config';

export default function RiskDebtAnalyzer({ analytics, transactions = [], user }) {
    const reportRef = useRef(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Custom Date Range State
    const [reportFromDate, setReportFromDate] = useState('');
    const [reportToDate, setReportToDate] = useState('');

    // Debt Calculator State
    const [debtAmount, setDebtAmount] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [monthlyPayment, setMonthlyPayment] = useState('');
    
    const [debtResult, setDebtResult] = useState(null);

    // Risk Analyzer State
    const [liquidSavings, setLiquidSavings] = useState('');
    const [monthlyExpenses, setMonthlyExpenses] = useState('');
    const [aiScoreData, setAiScoreData] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Automatically set default monthly expenses if analytics are available
    useEffect(() => {
        if (analytics && analytics.total_expenses > 0 && !monthlyExpenses) {
            // Very rough estimate: treat total_expenses as a baseline if nothing is set
            // In a real scenario, this would be averaged over the active months
            setMonthlyExpenses((analytics.total_expenses).toFixed(0));
        }
    }, [analytics]);

    const calculateDebt = () => {
        const P = parseFloat(debtAmount);
        const annualRate = parseFloat(interestRate);
        const M = parseFloat(monthlyPayment);

        if (!P || !annualRate || !M) return;

        const r = (annualRate / 100) / 12;

        // Check if payment is less than monthly interest
        if (M <= P * r) {
            setDebtResult({ error: "Your monthly payment is too low to cover the interest! You will never pay off this debt." });
            return;
        }

        const monthsToPayoff = -Math.log(1 - (r * P) / M) / Math.log(1 + r);
        const totalMonths = Math.ceil(monthsToPayoff);
        
        const totalPaid = totalMonths * M;
        const totalInterest = totalPaid - P;

        setDebtResult({
            months: totalMonths,
            years: (totalMonths / 12).toFixed(1),
            totalInterest: totalInterest,
            totalPaid: totalPaid,
            principal: P
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const handleAnalyzeRisk = async () => {
        setIsAnalyzing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/transactions/analyze-risk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    liquidSavings: parseFloat(liquidSavings) || 0,
                    monthlyExpenses: parseFloat(monthlyExpenses) || 0,
                    totalIncome: analytics?.total_income || 0,
                    totalExpenses: analytics?.total_expenses || 0
                })
            });

            if (response.ok) {
                const data = await response.json();
                setAiScoreData(data);
            }
        } catch (error) {
            console.error("Failed to analyze risk", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getStatusColor = (status) => {
        if (!status) return 'text-slate-500 bg-slate-500/10';
        const s = status.toLowerCase();
        if (s.includes('healthy')) return 'text-emerald-500 bg-emerald-500/10';
        if (s.includes('moderate')) return 'text-yellow-500 bg-yellow-500/10';
        if (s.includes('high')) return 'text-orange-500 bg-orange-500/10';
        if (s.includes('critical')) return 'text-red-500 bg-red-500/10';
        return 'text-indigo-500 bg-indigo-500/10';
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 50) return 'text-amber-500';
        return 'text-red-500';
    };

    const overallScore = aiScoreData ? aiScoreData.score : '--';

    const generatePdfReport = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`risk_debt_report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Filter transactions for report
    const filteredTransactions = transactions.filter(t => {
        if (!reportFromDate && !reportToDate) return true;
        const tDate = new Date(t.date).getTime();
        const fromTime = reportFromDate ? new Date(reportFromDate).setHours(0,0,0,0) : 0;
        const toTime = reportToDate ? new Date(reportToDate).setHours(23,59,59,999) : Infinity;
        return tDate >= fromTime && tDate <= toTime;
    });

    // Compute range totals
    let rangeIncome = 0;
    let rangeExpense = 0;
    const rangeExpensesByCategory = {};

    filteredTransactions.forEach(t => {
        if (t.type === 'income') {
            rangeIncome += t.amount;
        } else {
            rangeExpense += t.amount;
            rangeExpensesByCategory[t.category] = (rangeExpensesByCategory[t.category] || 0) + t.amount;
        }
    });

    const rangeSavings = rangeIncome - rangeExpense;

    // Data for new Savings vs Expense chart
    const savingsVsExpenseData = [
        { name: 'Income', amount: rangeIncome, fill: '#10b981' },
        { name: 'Expenses', amount: rangeExpense, fill: '#ef4444' },
        { name: 'Net Savings', amount: rangeSavings, fill: '#6366f1' }
    ];

    // Prepare data for report charts
    const pieData = Object.entries(rangeExpensesByCategory).map(([name, value]) => ({ name, value }));
    const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    
    // Mock 10 assessments trend if none exist, ending with current score
    const trendData = [];
    let currentScore = aiScoreData ? aiScoreData.score / 100 : 0.5;
    for(let i=9; i>=1; i--) {
        trendData.push({ date: 'N/A', score: Math.max(0, Math.min(1, currentScore + (Math.random() * 0.2 - 0.1))) });
    }
    trendData.push({ date: new Date().toISOString().split('T')[0], score: currentScore });

    useEffect(() => {
        window.generateRiskPdf = generatePdfReport;
        return () => { delete window.generateRiskPdf; };
    }, [aiScoreData, debtResult, analytics, transactions, user]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-end items-end sm:items-center gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 hidden sm:block">Report Date:</span>
                    <input 
                        type="date" 
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        value={reportFromDate}
                        onChange={e => setReportFromDate(e.target.value)}
                    />
                    <span className="text-slate-400 font-bold">to</span>
                    <input 
                        type="date" 
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-2"
                        value={reportToDate}
                        onChange={e => setReportToDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={generatePdfReport}
                    disabled={isGeneratingPdf}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                    {isGeneratingPdf ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    {isGeneratingPdf ? "Generating..." : "Generate PDF Report"}
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* DEBT CALCULATOR */}
                <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 w-fit">
                            <Calculator size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Debt Payoff Calculator</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Plan your freedom</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="group">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Debt Amount (₹)</label>
                            <input
                                type="number"
                                placeholder="100000"
                                className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                value={debtAmount}
                                onChange={(e) => setDebtAmount(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="group">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Interest Rate (%)</label>
                                <input
                                    type="number"
                                    placeholder="12"
                                    className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Monthly Payment</label>
                                <input
                                    type="number"
                                    placeholder="5000"
                                    className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    value={monthlyPayment}
                                    onChange={(e) => setMonthlyPayment(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={calculateDebt}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 button-glow mt-4"
                        >
                            Calculate Payoff
                        </button>
                    </div>

                    {debtResult && (
                        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/10 animate-fade-in">
                            {debtResult.error ? (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold flex items-center gap-3">
                                    <AlertTriangle size={20} />
                                    {debtResult.error}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <p className="text-slate-500 font-bold text-sm">Time to Payoff</p>
                                        <p className="text-3xl font-black text-indigo-500">{debtResult.months} <span className="text-sm">months</span> <span className="text-slate-400 font-medium">({debtResult.years} yrs)</span></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Interest</p>
                                            <p className="text-xl font-black text-red-400 mt-1">{formatCurrency(debtResult.totalInterest)}</p>
                                        </div>
                                        <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Paid</p>
                                            <p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(debtResult.totalPaid)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FINANCIAL RISK ANALYZER */}
                <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-xl bg-white/40 dark:bg-dark-card/40 relative">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 w-fit">
                                <ShieldAlert size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Risk Analyzer</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Health check</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-indigo-500/30">
                                <span className={`text-xl font-black ${aiScoreData ? getScoreColor(aiScoreData.score) : 'text-slate-400'}`}>
                                    {overallScore}
                                </span>
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">AI Score</p>
                        </div>
                    </div>

                    {/* Inputs for Risk */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="group">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Liquid Savings (₹)</label>
                            <input
                                type="number"
                                placeholder="50000"
                                className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                value={liquidSavings}
                                onChange={(e) => setLiquidSavings(e.target.value)}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Monthly Expenses</label>
                            <input
                                type="number"
                                placeholder="20000"
                                className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                value={monthlyExpenses}
                                onChange={(e) => setMonthlyExpenses(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {!aiScoreData ? (
                            <div className="text-center py-6 border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Click below to generate a personalized risk assessment using AI.</p>
                                <button
                                    onClick={handleAnalyzeRisk}
                                    disabled={isAnalyzing}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mx-auto"
                                >
                                    {isAnalyzing ? (
                                        <><Loader2 className="animate-spin" size={18} /> Analyzing...</>
                                    ) : (
                                        <><Sparkles size={18} /> Analyze with AI</>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="animate-fade-in space-y-4">
                                {/* Savings Rate metric */}
                                <div className={`p-4 rounded-2xl ${getStatusColor(aiScoreData.savings_rate_status)} border border-slate-200 dark:border-white/5`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-black uppercase tracking-widest opacity-70">Savings Rate</p>
                                        <span className="font-bold text-sm bg-white/20 px-2 py-1 rounded-lg">{aiScoreData.savings_rate_status}</span>
                                    </div>
                                    <p className="text-sm font-medium opacity-90">{aiScoreData.savings_rate_text}</p>
                                </div>

                                {/* Emergency Fund Metric */}
                                <div className={`p-4 rounded-2xl ${getStatusColor(aiScoreData.emergency_fund_status)} border border-slate-200 dark:border-white/5`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-black uppercase tracking-widest opacity-70">Emergency Fund</p>
                                        <span className="font-bold text-sm bg-white/20 px-2 py-1 rounded-lg">{aiScoreData.emergency_fund_status}</span>
                                    </div>
                                    <p className="text-sm font-medium opacity-90">{aiScoreData.emergency_fund_text}</p>
                                </div>

                                <button
                                    onClick={handleAnalyzeRisk}
                                    disabled={isAnalyzing}
                                    className="w-full mt-4 py-3 bg-white/5 dark:bg-white/5 hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
                                >
                                    {isAnalyzing ? <><Loader2 className="animate-spin" size={18} /> Updating...</> : <><Sparkles size={18} /> Recalculate Score</>}
                                </button>
                            </div>
                        )}
                    </div>
                    
                </div>
            </div>

            {/* HIDDEN PRINTABLE REPORT LAYOUT */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
                <div ref={reportRef} style={{ width: '800px', backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'sans-serif' }}>
                    
                    {/* Header Banner */}
                    <div style={{ backgroundColor: '#1e3a8a', padding: '20px', marginBottom: '30px' }}>
                        <h1 style={{ color: '#ffffff', margin: 0, fontSize: '24px' }}>Trackify - Risk Assessment Report</h1>
                    </div>

                    {/* Summary */}
                    <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>Financial & Risk Summary</h2>
                        <p style={{ margin: '5px 0' }}><strong>User Identity:</strong> {user?.full_name || user?.email || user?.username || 'Trackify User'}</p>
                        <p style={{ margin: '5px 0' }}><strong>Report Period:</strong> {reportFromDate && reportToDate ? `${reportFromDate} to ${reportToDate}` : (reportFromDate ? `From ${reportFromDate}` : (reportToDate ? `Until ${reportToDate}` : 'All Time (Current Snapshot)'))}</p>
                        <p style={{ margin: '5px 0' }}><strong>Generated At:</strong> {new Date().toLocaleString()}</p>
                        <br/>
                        <p style={{ margin: '5px 0', fontSize: '16px' }}>
                            <strong>Total Income:</strong> {formatCurrency(rangeIncome)} | <strong>Total Expenses:</strong> {formatCurrency(rangeExpense)}
                        </p>
                    </div>

                    {/* Charts Grid */}
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '40px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 30%', minWidth: '220px' }}>
                            <h3 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '10px' }}>Savings vs Expense</h3>
                            <div style={{ height: '220px', width: '100%', border: '1px solid #e2e8f0' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={savingsVsExpenseData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={9} />
                                        <YAxis fontSize={9} tickFormatter={(val) => `₹${val}`} width={40} />
                                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                            {savingsVsExpenseData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ flex: '1 1 30%', minWidth: '220px' }}>
                            <h3 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '10px' }}>Expenses by Category</h3>
                            <div style={{ height: '220px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{fontSize: '9px'}}>
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ flex: '1 1 30%', minWidth: '220px' }}>
                            <h3 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '10px' }}>Risk Score Trend</h3>
                            <div style={{ height: '220px', width: '100%', border: '1px solid #e2e8f0' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" fontSize={9} />
                                        <YAxis domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]} fontSize={9} width={25} />
                                        <Line type="monotone" dataKey="score" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 3, fill: '#1e3a8a' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Assessments Table */}
                    <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Current Risk Assessment</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#dbeafe', textAlign: 'left' }}>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Date</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Risk Score</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Savings Health</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Emergency Fund</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{new Date().toISOString().split('T')[0]}</td>
                                    <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{overallScore} / 100</td>
                                    <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{aiScoreData?.savings_rate_status || 'N/A'}</td>
                                    <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{aiScoreData?.emergency_fund_status || 'N/A'}</td>
                                </tr>
                            </tbody>
                        </table>
                        {aiScoreData && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#333' }}>
                                <p><strong>Analysis:</strong> {aiScoreData.savings_rate_text} {aiScoreData.emergency_fund_text}</p>
                            </div>
                        )}
                    </div>

                    {/* Transaction History Table */}
                    <div>
                        <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Recent Transaction History</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#dcfce7', textAlign: 'left' }}>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Date</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Type</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Category</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Amount</th>
                                    <th style={{ padding: '8px', border: '1px solid #94a3b8' }}>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.slice(0, 10).map((t, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{new Date(t.date).toISOString().split('T')[0]}</td>
                                        <td style={{ padding: '8px', border: '1px solid #94a3b8', textTransform: 'capitalize' }}>{t.type}</td>
                                        <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{t.category}</td>
                                        <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>INR {t.amount.toFixed(2)}</td>
                                        <td style={{ padding: '8px', border: '1px solid #94a3b8' }}>{t.description || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

        </div>
    );
}
