
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { Transaction, TransactionType } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let uncategorizedCount = 0;
    const categoryTotals: Record<string, number> = {};

    transactions.forEach(t => {
      const isUncategorized = t.category === 'Uncategorized' || !t.categoryId;
      if (isUncategorized) uncategorizedCount++;

      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    });

    const healthScore = transactions.length > 0 
      ? Math.round(((transactions.length - uncategorizedCount) / transactions.length) * 100) 
      : 100;

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      categoryTotals,
      uncategorizedCount,
      healthScore
    };
  }, [transactions]);

  const pieData = useMemo(() => {
    return Object.entries(summary.categoryTotals)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [summary.categoryTotals]);

  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expense: number; sortKey: string }> = {};
    
    transactions.forEach(t => {
      if (!t.date) return;
      
      // Use string slicing YYYY-MM to avoid timezone shifts affecting the month bucket
      const monthKey = t.date.substring(0, 7); // "2023-12"
      
      if (!data[monthKey]) {
        // Create label manually to avoid any Date object timezone shifts
        const [year, month] = monthKey.split('-');
        const monthIndex = parseInt(month) - 1;
        const monthLabel = (monthIndex >= 0 && monthIndex < 12) 
          ? `${MONTHS[monthIndex]} '${year.slice(2)}`
          : monthKey;
        
        data[monthKey] = { month: monthLabel, income: 0, expense: 0, sortKey: monthKey };
      }

      if (t.type === TransactionType.INCOME) {
        data[monthKey].income += t.amount;
      } else {
        data[monthKey].expense += t.amount;
      }
    });

    return Object.values(data).sort((a, b) => a.sortKey.localeCompare(b.sortKey)); 
  }, [transactions]);

  const StatCard = ({ title, amount, icon, colorClass }: any) => (
    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
        <h3 className="text-lg md:text-2xl font-black text-slate-800 truncate">
          ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}
        </h3>
      </div>
      <div className={`p-2.5 md:p-3 rounded-xl ${colorClass} self-start md:self-center`}>
        {React.cloneElement(icon, { size: 18 })}
      </div>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 px-6 text-center">
        <Wallet className="w-12 h-12 text-slate-200 mb-4" />
        <h3 className="font-black text-slate-800 mb-1">Financial Data Needed</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">Upload a bank statement to generate your P&L and balance sheet dashboards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in pb-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          title="Income" 
          amount={summary.totalIncome} 
          icon={<TrendingUp className="text-emerald-600" />} 
          colorClass="bg-emerald-50"
        />
        <StatCard 
          title="Expenses" 
          amount={summary.totalExpense} 
          icon={<TrendingDown className="text-rose-600" />} 
          colorClass="bg-rose-50"
        />
        <StatCard 
          title="Net Profit" 
          amount={summary.netProfit} 
          icon={<DollarSign className="text-blue-600" />} 
          colorClass={summary.netProfit >= 0 ? "bg-blue-50" : "bg-orange-50"}
        />
        <div className="bg-slate-900 p-4 md:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-white border border-white/10">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Data Health</p>
            <h3 className="text-lg md:text-2xl font-black">{summary.healthScore}%</h3>
          </div>
          <div className={`p-2.5 rounded-xl self-start md:self-center ${summary.healthScore > 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {summary.healthScore > 90 ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          </div>
        </div>
      </div>

      {summary.uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-600 w-5 h-5 shrink-0" />
            <p className="text-xs md:text-sm font-bold text-amber-800 leading-tight">
              You have {summary.uncategorizedCount} unmapped records. Map these for an accurate loan report.
            </p>
          </div>
          <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-xl border border-amber-100 whitespace-nowrap">
            Needs Action
          </div>
        </div>
      )}

      <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <h4 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Cash Flow Timeline</h4>
        <div className="h-56 md:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Tooltip 
                formatter={(value: number) => [`$${new Intl.NumberFormat('en-US').format(value)}`, '']}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line type="monotone" dataKey="income" name="Income" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <h4 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Expense Categories</h4>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-48 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number) => `$${new Intl.NumberFormat('en-US').format(value)}`}
                     contentStyle={{ borderRadius: '16px', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {pieData.slice(0, 4).map((entry, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="truncate text-[11px] font-black uppercase text-slate-500 tracking-tight">{entry.name}</span>
                  </div>
                  <span className="font-black text-xs text-slate-800 ml-2">${Math.round(entry.value).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
           <h4 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Transaction Volume</h4>
           <div className="h-48 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData.slice(-6)}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                <Bar dataKey="income" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
    