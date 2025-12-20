
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { Transaction, TransactionType } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      categoryTotals
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
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);

      if (!data[key]) {
        data[key] = { month: monthLabel, income: 0, expense: 0, sortKey: key };
      }

      if (t.type === TransactionType.INCOME) {
        data[key].income += t.amount;
      } else {
        data[key].expense += t.amount;
      }
    });

    return Object.values(data).sort((a, b) => a.sortKey.localeCompare(b.sortKey)); 
  }, [transactions]);

  const StatCard = ({ title, amount, icon, colorClass }: any) => (
    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-xl md:text-2xl font-black text-slate-800 truncate">
          ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}
        </h3>
      </div>
      <div className={`p-2.5 md:p-3 rounded-xl ${colorClass} flex-shrink-0 ml-4`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <Wallet className="w-12 h-12 text-slate-200 mb-4" />
        <p className="text-slate-400 font-medium">No financial data yet. Upload a statement to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
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
          title="Profit" 
          amount={summary.netProfit} 
          icon={<DollarSign className="text-blue-600" />} 
          colorClass={summary.netProfit >= 0 ? "bg-blue-50" : "bg-orange-50"}
        />
      </div>

      <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-100">
        <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Cash Flow Overview</h4>
        <div className="h-64 md:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
              <YAxis tickLine={false} axisLine={false} hide />
              <Tooltip 
                formatter={(value: number) => [`$${new Intl.NumberFormat('en-US').format(value)}`, '']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-100">
          <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Expense Breakdown</h4>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-56 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number) => `$${new Intl.NumberFormat('en-US').format(value)}`}
                     contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 overflow-y-auto max-h-56 space-y-3">
              {pieData.slice(0, 5).map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center min-w-0">
                    <span 
                      className="w-2 h-2 rounded-full mr-2 flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></span>
                    <span className="truncate text-slate-500 font-medium">{entry.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 ml-2">${Math.round(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-100">
           <h4 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Recent Activity Volume</h4>
           <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData.slice(-6)}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
