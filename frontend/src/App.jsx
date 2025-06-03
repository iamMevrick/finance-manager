import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// Imported Sun and Moon for theme toggle, and Wallet for the new logo
import { PlusCircle, LogOut, TrendingUp, TrendingDown, CalendarDays, Type, Edit3, Trash2, Eye, EyeOff, UserCircle, BarChart2, ListChecks, Download, Sun, Moon, Wallet } from 'lucide-react';
import { format } from 'date-fns';

// --- Supabase Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Helper Functions ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

// MODIFIED: Completed the formatDateForDisplay function
const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy'); // Corrected format string
  } catch (error) {
    console.error("Error formatting date:", dateString, error); // Added for robustness
    return 'Invalid Date';
  }
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658']; // Added more colors
const INCOME_COLOR = 'text-green-600 dark:text-green-500';
const EXPENSE_COLOR = 'text-red-600 dark:text-red-500';

// --- Main App Component ---
function App() {
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const user = session?.user;

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // MODIFIED: useMemo hook to calculate incomeCategoryData and renamed categoryData to expenseCategoryData
  const { totalIncome, totalExpenses, balance, expenseCategoryData, incomeCategoryData } = useMemo(() => {
    let income = 0, expenses = 0;
    const incomeByCategory = {};
    const expenseByCategory = {};

    transactions.forEach(tx => {
      if (tx.amount == null || isNaN(parseFloat(tx.amount))) return; // Robust check for valid amount
      const amount = parseFloat(tx.amount);
      if (tx.type === 'income') {
        income += amount;
        incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + amount;
      } else if (tx.type === 'expense') { // Be specific for expense type
        expenses += amount;
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amount;
      }
    });
    return {
      totalIncome: income, 
      totalExpenses: expenses, 
      balance: income - expenses,
      incomeCategoryData: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      expenseCategoryData: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [transactions]);
  
  const fetchTransactions = useCallback(async () => {
    if (user) {
      setDataLoading(true);
      setError('');
      try {
        const { data, error } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
        if (error) throw error;
        setTransactions(data || []);
      } catch (err) {
        setError('Failed to fetch transactions.');
        console.error("Fetch transactions error:", err);
      } finally {
        setDataLoading(false);
      }
    } else {
      setTransactions([]);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSignup = async (email, password) => {
    setAuthLoading(true); setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    setAuthLoading(false);
  };
  
  const handleLogin = async (email, password) => {
    setAuthLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setAuthLoading(false);
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addTransaction = async (transaction) => {
    if (!user) return setError("You must be logged in.");
    setDataLoading(true); setError('');
    try {
      const { description, amount, type, category, date } = transaction;
      const { error } = await supabase.from('transactions').insert([{ user_id: user.id, description, amount, type, category, date }]);
      if (error) throw error;
      await fetchTransactions();
      setCurrentPage('dashboard');
    } catch (err) {
      setError('Failed to add transaction.');
      console.error("Add transaction error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const deleteTransaction = async (id) => {
    if (!user) return setError("You must be logged in.");
    setDataLoading(true); setError('');
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      await fetchTransactions();
    } catch (err) {
      setError('Failed to delete transaction.');
      console.error("Delete transaction error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return alert("No transactions to export.");
    const headers = ["Date", "Description", "Category", "Type", "Amount (INR)"];
    const csvRows = [headers.join(','), ...transactions.map(tx => {const dateStr = formatDateForDisplay(tx.date).replace(/,/g, ''); const descriptionStr = `"${(tx.description || '').replace(/"/g, '""')}"`; return [dateStr, descriptionStr, tx.category, tx.type, tx.amount].join(',');})];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) return <LoadingSpinner message="Initializing Application..." />;
  
  const mainAppDivClasses = "min-h-screen font-sans flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300";

  if (!session) {
    return <div className={mainAppDivClasses}><AuthPage onLogin={handleLogin} onSignup={handleSignup} error={error} loading={authLoading} /></div>;
  }

  return (
    <div className={mainAppDivClasses}>
      <Navbar onLogout={handleLogout} setCurrentPage={setCurrentPage} currentUserEmail={user.email} theme={theme} setTheme={setTheme} />
      <main className="flex-grow p-4 md:p-8">
        {error && <div className="mb-4 p-3 bg-red-500 text-white rounded-md text-center" onClick={() => setError('')}>{error}</div>}
        {currentPage === 'dashboard' && (
          <DashboardPage
            transactions={transactions}
            totalIncome={totalIncome} totalExpenses={totalExpenses} balance={balance}
            expenseCategoryData={expenseCategoryData} // MODIFIED: Renamed prop
            incomeCategoryData={incomeCategoryData}   // NEW: Passed income category data
            onDeleteTransaction={deleteTransaction}
            setCurrentPage={setCurrentPage} onExportCSV={exportToCSV} isLoading={dataLoading}
          />
        )}
        {currentPage === 'addTransaction' && (
          <AddTransactionPage onAddTransaction={addTransaction} loading={dataLoading} />
        )}
      </main>
      <Footer />
    </div>
  );
}

// --- Sub-Components ---
const LoadingSpinner = ({ message, small }) => (<div className={`flex items-center justify-center ${small ? 'py-4' : 'min-h-screen bg-slate-50 dark:bg-slate-900'}`}><div className={`animate-spin rounded-full border-sky-500 ${small ? 'h-8 w-8 border-t-2 border-b-2' : 'h-16 w-16 border-t-4 border-b-4'}`}></div><p className={`ml-3 text-sky-500 dark:text-sky-400 ${small ? 'text-base' : 'text-xl'}`}>{message}</p></div>);
const Navbar = ({ onLogout, setCurrentPage, currentUserEmail, theme, setTheme }) => {const toggleTheme = () => {setTheme(theme === 'light' ? 'dark' : 'light');};return (<nav className="bg-white dark:bg-slate-800 p-4 shadow-md dark:shadow-lg border-b border-slate-200 dark:border-slate-700"><div className="container mx-auto flex justify-between items-center"><div className="flex items-center space-x-2"><Wallet className="text-sky-500 dark:text-sky-400 h-8 w-8" /><h1 className="text-2xl font-bold text-sky-500 dark:text-sky-400">FinanceTracker</h1></div><div className="flex items-center space-x-2 md:space-x-4"><button onClick={() => setCurrentPage('dashboard')} className="px-2 py-2 md:px-3 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1"><BarChart2 size={18} /> <span className="hidden sm:inline">Dashboard</span></button><button onClick={() => setCurrentPage('addTransaction')} className="px-2 py-2 md:px-3 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1"><PlusCircle size={18} /> <span className="hidden sm:inline">Add New</span></button><button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>{currentUserEmail && <div className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">{currentUserEmail}</div>}<button onClick={onLogout} className="bg-sky-500 hover:bg-sky-600 text-white px-2 py-2 md:px-3 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"><LogOut size={18} /> <span className="hidden sm:inline">Logout</span></button></div></div></nav>);};
const AuthPage = ({ onLogin, onSignup, error, loading }) => {const [email, setEmail] = useState('');const [password, setPassword] = useState('');const [isLogin, setIsLogin] = useState(true);const [showPassword, setShowPassword] = useState(false);const handleSubmit = (e) => {e.preventDefault();if (!email || !password) return;if (isLogin) onLogin(email, password);else onSignup(email, password);};return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] sm:min-h-[calc(100vh-200px)]"><div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border dark:border-slate-700"><div className="flex justify-center"><UserCircle className="h-16 w-16 text-sky-500 dark:text-sky-400" /></div><h2 className="text-2xl sm:text-3xl font-bold text-center text-sky-500 dark:text-sky-400">{isLogin ? 'Welcome Back!' : 'Create Account'}</h2><p className="text-center text-slate-500 dark:text-slate-400 text-sm sm:text-base">{isLogin ? "Log in to track your finances." : "Sign up to get started."}</p>{error && <p className="text-red-500 bg-red-100 dark:text-red-400 dark:bg-red-900/30 p-2 rounded-md text-sm text-center">{error}</p>}<form onSubmit={handleSubmit} className="space-y-5"><div><label htmlFor="email-auth" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label><input id="email-auth" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" placeholder="you@example.com"/></div><div><label htmlFor="password-auth"className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label><div className="mt-1 relative"><input id="password-auth" name="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} required minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" placeholder="••••••••"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div><button type="submit" disabled={loading} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-800 disabled:opacity-50">{loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}</button></form><p className="text-sm text-center text-slate-500 dark:text-slate-400">{isLogin ? "Don't have an account?" : 'Already have an account?'}<button onClick={() => {setIsLogin(!isLogin); setError('');}} className="ml-1 font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300">{isLogin ? 'Sign Up' : 'Log In'}</button></p></div></div>);};

// MODIFIED: DashboardPage now accepts and uses incomeCategoryData
const DashboardPage = ({ transactions, totalIncome, totalExpenses, balance, expenseCategoryData, incomeCategoryData, onDeleteTransaction, setCurrentPage, onExportCSV, isLoading }) => {
  if (isLoading && transactions.length === 0) {
    return <LoadingSpinner message="Fetching your financial data..." small />;
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-slate-100">Dashboard</h2>
        <button onClick={onExportCSV} disabled={transactions.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg flex items-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={18} /><span>Export to CSV</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="Total Income" amount={totalIncome} icon={<TrendingUp />} color="green" />
        <SummaryCard title="Total Expenses" amount={totalExpenses} icon={<TrendingDown />} color="red" />
        <SummaryCard title="Net Balance" amount={balance} icon={<span className="font-bold text-lg">₹</span>} color="sky" />
      </div>
      
      {transactions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Income vs Expenses Overview">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[{ name: 'Finances', income: totalIncome, expenses: totalExpenses }]} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-slate-700" />
                <XAxis dataKey="name" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" tickFormatter={formatCurrency} width={80} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', darkBackgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #e0e0e0', darkBorder: '1px solid #334155' }} labelStyle={{ color: '#1e293b', darkColor: '#f1f5f9' }} itemStyle={{ color: '#334155', darkColor: '#cbd5e1' }} />
                <Legend wrapperStyle={{ color: '#374151', darkColor: '#9ca3af' }} />
                <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} barSize={50} />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          
          <ChartCard title="Expense Categories">
            {expenseCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie data={expenseCategoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value" strokeWidth={2} className="stroke-white dark:stroke-slate-800">
                    {expenseCategoryData.map((entry, index) => (<Cell key={`cell-expense-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', darkBackgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #e0e0e0', darkBorder: '1px solid #334155' }} />
                  <Legend wrapperStyle={{ color: '#374151', darkColor: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<p className="text-center py-10 text-slate-500 dark:text-slate-400">No expense data for chart.</p>)}
          </ChartCard>

          {/* NEW: Income Categories Pie Chart */}
          <ChartCard title="Income Categories">
            {incomeCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie data={incomeCategoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#82ca9d" dataKey="value" strokeWidth={2} className="stroke-white dark:stroke-slate-800">
                    {incomeCategoryData.map((entry, index) => (<Cell key={`cell-income-${index}`} fill={COLORS[(index + Math.floor(COLORS.length / 2)) % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', darkBackgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #e0e0e0', darkBorder: '1px solid #334155' }} />
                  <Legend wrapperStyle={{ color: '#374151', darkColor: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<p className="text-center py-10 text-slate-500 dark:text-slate-400">No income data for chart.</p>)}
          </ChartCard>

        </div>
      ) : ( !isLoading && 
        <div className="text-center py-10 bg-slate-100 dark:bg-slate-800 rounded-lg shadow-md">
          <ListChecks size={48} className="mx-auto text-sky-500 mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Transactions Yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">Start by adding your first transaction.</p>
          <button onClick={() => setCurrentPage('addTransaction')} className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 px-5 rounded-lg flex items-center mx-auto space-x-2">
            <PlusCircle size={20} /><span>Add New Transaction</span>
          </button>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl shadow-lg border dark:border-slate-700 mt-6">
        <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">All Transactions</h3>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">{formatDateForDisplay(tx.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{tx.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{tx.type}</span>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${tx.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => onDeleteTransaction(tx.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1" aria-label="Delete transaction">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ( !isLoading && <p className="text-slate-500 dark:text-slate-400 text-center py-5">No transactions to display.</p> )}
      </div>
    </div>
  );
};

const SummaryCard = ({ title, amount, icon, color }) => {const colorVariants = { green: { border: 'dark:border-green-500 border-green-300', text: 'text-green-600 dark:text-green-400', bgIcon: 'bg-green-100 dark:bg-green-500/20' }, red: { border: 'dark:border-red-500 border-red-300', text: 'text-red-600 dark:text-red-400', bgIcon: 'bg-red-100 dark:bg-red-500/20' }, sky: { border: 'dark:border-sky-500 border-sky-300', text: 'text-sky-600 dark:text-sky-400', bgIcon: 'bg-sky-100 dark:bg-sky-500/20' }};const selectedColor = colorVariants[color] || colorVariants.sky;return (<div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg border dark:border-slate-700 border-l-4 ${selectedColor.border}`}><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p><p className={`text-2xl md:text-3xl font-bold ${selectedColor.text}`}>{formatCurrency(amount)}</p></div><div className={`p-3 rounded-full ${selectedColor.bgIcon}`}><span className={selectedColor.text}>{React.cloneElement(icon, { size: 24 })}</span></div></div></div>);};
const ChartCard = ({ title, children }) => (<div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl shadow-lg border dark:border-slate-700"><h3 className="text-lg sm:text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">{title}</h3>{children}</div>);
const AddTransactionPage = ({ onAddTransaction, loading }) => {const [description, setDescription] = useState('');const [amount, setAmount] = useState('');const [type, setType] = useState('expense');const [category, setCategory] = useState('Other');const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));const [formError, setFormError] = useState('');const categories = useMemo(() => ({expense: ['Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Education', 'Bills', 'Subscription', 'Other'],income: ['Salary', 'Bonus', 'Investment', 'Gift', 'Freelance', 'Rental', 'Interest', 'Other']}), []);useEffect(() => { setCategory(categories[type][0] || 'Other'); }, [type, categories]);const handleSubmit = (e) => {e.preventDefault();setFormError('');if (!description.trim() || !amount || !date || !category) { setFormError("Please fill in all fields."); return; }if (parseFloat(amount) <= 0) { setFormError("Amount must be greater than zero."); return; }onAddTransaction({ description: description.trim(), amount, type, category, date });};return (<div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl border dark:border-slate-700"><h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-sky-600 dark:text-sky-400">Add New Transaction</h2>{formError && <p className="mb-4 text-red-500 bg-red-100 dark:text-red-400 dark:bg-red-900/30 p-2 rounded-md text-sm text-center">{formError}</p>}<form onSubmit={handleSubmit} className="space-y-5"><div><label htmlFor="description-add" className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center"><Edit3 size={16} className="mr-2 text-sky-500 dark:text-sky-400" /> Description</label><input id="description-add" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" placeholder="e.g., Groceries, Salary"/></div><div><label htmlFor="amount-add" className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center"><span className="font-bold text-lg mr-2 text-sky-500 dark:text-sky-400">₹</span> Amount (INR)</label><input id="amount-add" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" placeholder="e.g., 1500.50"/></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label htmlFor="type-add" className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center"><Type size={16} className="mr-2 text-sky-500 dark:text-sky-400" /> Type</label><select id="type-add" value={type} onChange={(e) => setType(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></div><div><label htmlFor="category-add" className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center"><ListChecks size={16} className="mr-2 text-sky-500 dark:text-sky-400" /> Category</label><select id="category-add" value={category} onChange={(e) => setCategory(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm">{categories[type].map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div></div><div><label htmlFor="date-add" className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center"><CalendarDays size={16} className="mr-2 text-sky-500 dark:text-sky-400" /> Date</label><input id="date-add" type="date" value={date} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"/></div><button type="submit" disabled={loading} className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-800 disabled:opacity-50"><PlusCircle size={20} className="mr-2" />{loading ? 'Adding...' : 'Add Transaction'}</button></form></div>);};
const Footer = ({}) => (<footer className="bg-slate-100 dark:bg-slate-800 text-center p-4 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 mt-auto">&copy; {new Date().getFullYear()} FinanceTracker. Developed by Muskan.</footer>);

export default App;
