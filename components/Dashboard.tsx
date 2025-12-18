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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#3b82f6'];

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
        // Track expenses by category
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

  // Aggregate monthly data for the bar chart and line chart
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expense: number; sortKey: string }> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      // Ensure date is valid, fallback if parsing fails
      if (isNaN(date.getTime())) return;
      
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleString('default', { month: 'short', year: '2-digit' });

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
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
      </div>
      <div className={`p-3 rounded-full ${colorClass}`}>
        {icon}
      </div>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <Wallet className="w-12 h-12 text-slate-300 mb-2" />
        <p className="text-slate-500">No transaction data available yet. Upload documents to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Income" 
          amount={summary.totalIncome} 
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />} 
          colorClass="bg-emerald-100"
        />
        <StatCard 
          title="Total Expenses" 
          amount={summary.totalExpense} 
          icon={<TrendingDown className="w-6 h-6 text-rose-600" />} 
          colorClass="bg-rose-100"
        />
        <StatCard 
          title="Net Profit" 
          amount={summary.netProfit} 
          icon={<DollarSign className="w-6 h-6 text-blue-600" />} 
          colorClass={summary.netProfit >= 0 ? "bg-blue-100" : "bg-orange-100"}
        />
      </div>

      {/* Income vs Expenses Trend Line Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h4 className="text-lg font-semibold text-slate-800 mb-4">Income vs Expenses Trend</h4>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-4">Financial Performance (Bar)</h4>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="text-lg font-semibold text-slate-800 mb-4">Expense Distribution</h4>
          <div className="h-80 w-full flex">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value: number) => `$${value.toLocaleString()}`}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/3 overflow-y-auto max-h-80 text-sm">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center mb-2">
                  <span 
                    className="w-3 h-3 rounded-full mr-2 block" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></span>
                  <div className="flex-1 truncate text-slate-600">{entry.name}</div>
                  <div className="font-semibold text-slate-800 ml-2">
                    ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;