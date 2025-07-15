"use client"

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle, LayoutDashboard, Briefcase, List, Settings, LogOut, Menu } from "lucide-react";
import { signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useSWR, { mutate } from "swr";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement, // <-- Add this line
  LineElement,  // <-- Add this line for completeness
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

// Add Transaction type
interface Transaction {
  id: string;
  category: string;
  date: string;
  amount: number;
  [key: string]: any;
}

// Firestore fetcher for SWR
const fetchTransactions: (uid: string) => Promise<Transaction[]> = async (uid) => {
  if (!uid) return [];
  const userTransactionsRef = collection(db, "users", uid, "transactions");
  const querySnapshot = await getDocs(userTransactionsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ category: "", amount: "", date: "", note: "" });
  const [formErrors, setFormErrors] = useState<{ category?: string; amount?: string; date?: string }>({});
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurring, setRecurring] = useState({ frequency: 'Monthly', endDate: '' });
  const [showSidebar, setShowSidebar] = useState(false);

  const expenseCategories = [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Other",
  ];
  const incomeCategories = [
    "Salary",
    "Business",
    "Investments",
    "Gifts",
    "Other Income",
  ];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  // Load custom categories from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("customCategories");
    if (stored) setCustomCategories(JSON.parse(stored));
  }, []);
  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem("customCategories", JSON.stringify(customCategories));
  }, [customCategories]);

  // When switching entryType, reset category
  useEffect(() => {
    setForm(f => ({ ...f, category: "" }));
  }, [entryType]);

  function handleAddCategory() {
    const cat = newCategory.trim();
    if (!cat || expenseCategories.includes(cat) || incomeCategories.includes(cat) || customCategories.includes(cat)) return;
    setCustomCategories([...customCategories, cat]);
    setNewCategory("");
    setShowAddCategory(false);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    });
    return () => unsubscribe();
  }, [router]);

  // Automate archive/delete at the start of each month using Firestore for lastResetMonth
  useEffect(() => {
    if (!user) return;
    const checkAndResetMonth = async () => {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // 'YYYY-MM'
      const userDocRef = doc(db, "users", user.uid);
      let lastResetMonth = null;
      try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          lastResetMonth = userDocSnap.data().lastResetMonth;
        }
      } catch (e) {
        // If user doc doesn't exist, create it below
      }
      if (lastResetMonth !== currentMonth) {
        await archiveAllTransactions();
        // Only update the field if needed
        try {
          await setDoc(userDocRef, { lastResetMonth: currentMonth }, { merge: true });
        } catch (e) {
          // handle error
        }
      }
    };
    checkAndResetMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleMenuClick = (path: string) => {
    if (pathname !== path) router.push(path);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Helper for quick date selection
  function getDateString(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  const today = getDateString(0);
  const tomorrow = getDateString(1);
  const yesterday = getDateString(-1);

  function validateForm() {
    const errors: { category?: string; amount?: string; date?: string } = {};
    if (!form.category) errors.category = "Category is required.";
    if (!form.amount) errors.amount = "Amount is required.";
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) errors.amount = "Amount must be a positive number.";
    if (!form.date) errors.date = "Date is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // SWR for transactions
  const {
    data: transactions = [],
    error: transactionsError,
    isLoading: transactionsLoading,
  } = useSWR<Transaction[]>(user ? ["transactions", user.uid] : null, () => fetchTransactions(user.uid));

  // Calculate summary from transactions
  const summary = transactions.reduce(
    (acc: any, tx: any) => {
      if (tx.amount < 0) acc.expenses += Math.abs(tx.amount);
      else acc.income += tx.amount;
      return { ...acc, balance: acc.income - acc.expenses };
    },
    { expenses: 0, income: 0, balance: 0 }
  );

  // Prepare data for the bar chart (monthly expenses by category)
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // 'YYYY-MM'
  const expensesThisMonth = transactions.filter(
    tx => tx.amount < 0 && tx.date && tx.date.startsWith(currentMonth)
  );
  const categoryTotals: Record<string, number> = {};
  expensesThisMonth.forEach(tx => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + Math.abs(tx.amount);
  });
  const chartData = {
    labels: Object.keys(categoryTotals),
    datasets: [
      {
        label: "Expenses (₹)",
        data: Object.values(categoryTotals),
        backgroundColor: "#ef4444",
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Spending by Category (This Month)" },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (tickValue: string | number) => `₹${tickValue}`,
        },
      },
    },
  };

  // Pie chart data (category-wise expenses for current month)
  const pieData = {
    labels: Object.keys(categoryTotals),
    datasets: [
      {
        label: "Expenses (₹)",
        data: Object.values(categoryTotals),
        backgroundColor: [
          "#ef4444", "#f59e42", "#fbbf24", "#10b981", "#3b82f6", "#a78bfa", "#f472b6", "#6366f1"
        ],
      },
    ],
  };
  // Weekly trends (last 8 weeks)
  function getWeekStart(date: Date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // Sunday as start
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const weeks: string[] = [];
  const weekTotals: Record<string, number> = {};
  for (let i = 7; i >= 0; i--) {
    const weekStart = getWeekStart(new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000));
    const label = weekStart.toISOString().slice(0, 10);
    weeks.push(label);
    weekTotals[label] = 0;
  }
  transactions.forEach(tx => {
    if (tx.amount < 0 && tx.date) {
      const txDate = new Date(tx.date);
      const weekStart = getWeekStart(txDate).toISOString().slice(0, 10);
      if (weekTotals[weekStart] !== undefined) {
        weekTotals[weekStart] += Math.abs(tx.amount);
      }
    }
  });
  const lineData = {
    labels: weeks,
    datasets: [
      {
        label: "Weekly Expenses (₹)",
        data: weeks.map(w => weekTotals[w]),
        borderColor: "#ef4444",
        backgroundColor: "#fee2e2",
        tension: 0.3,
        fill: true,
      },
    ],
  };
  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Weekly Expense Trends (Last 8 Weeks)" },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (tickValue: string | number) => `₹${tickValue}`,
        },
      },
    },
  };

  async function handleAddExpense() {
    if (!validateForm()) return;
    if (!user) return;
    const entry = {
      uid: user.uid,
      type: entryType, // 'expense' or 'income'
      category: form.category,
      amount: entryType === "expense" ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount)),
      date: form.date,
      note: form.note,
      recurring: isRecurring
        ? {
            frequency: recurring.frequency,
            endDate: recurring.endDate || null,
          }
        : null,
      createdAt: new Date().toISOString(),
    };
    // Optimistically update SWR cache
    mutate(["transactions", user.uid], (prev: Transaction[] = []) => [
      { ...entry, id: "temp-" + Date.now() },
      ...prev,
    ], false);
    setShowAddModal(false);
    setForm({ category: "", amount: "", date: "", note: "" });
    setEntryType("expense");
    setIsRecurring(false);
    setRecurring({ frequency: "Monthly", endDate: "" });
    try {
      const userTransactionsRef = collection(db, "users", user.uid, "transactions");
      await addDoc(userTransactionsRef, entry);
      // Revalidate SWR cache
      mutate(["transactions", user.uid]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Failed to add entry: " + message);
    }
  }

  // Delete all transactions for the current user
  async function deleteAllTransactions() {
    if (!user) return;
    const userTransactionsRef = collection(db, "users", user.uid, "transactions");
    const querySnapshot = await getDocs(userTransactionsRef);
    const batchDeletes = querySnapshot.docs.map((d) => deleteDoc(doc(db, "users", user.uid, "transactions", d.id)));
    await Promise.all(batchDeletes);
    mutate(["transactions", user.uid]); // Refresh SWR
    alert("All transactions deleted.");
  }

  // Archive all transactions for the current user
  async function archiveAllTransactions() {
    if (!user) return;
    const userTransactionsRef = collection(db, "users", user.uid, "transactions");
    const archiveRef = collection(db, "users", user.uid, "archived_transactions");
    const querySnapshot = await getDocs(userTransactionsRef);
    // Copy each transaction to archive, then delete
    const batchOps = querySnapshot.docs.map(async (d) => {
      await addDoc(archiveRef, d.data());
      await deleteDoc(doc(db, "users", user.uid, "transactions", d.id));
    });
    await Promise.all(batchOps);
    mutate(["transactions", user.uid]); // Refresh SWR
    alert("All transactions archived.");
  }

  // Replace loading state
  if (!user || transactionsLoading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Loading dashboard...</div>;
  }
  if (transactionsError) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-red-500">Failed to load transactions.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-6 md:p-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Mobile Hamburger Icon */}
        <div className="flex md:hidden justify-end mb-4">
          <button onClick={() => setShowSidebar(true)} className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
            <Menu className="w-7 h-7" />
          </button>
        </div>
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Add Expense Button at the top */}
          <div className="flex justify-start mb-2">
            <Button size="lg" onClick={() => setShowAddModal(true)}>+ Add Expense</Button>
          </div>
          {/* Add Expense Modal */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent className="max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleAddExpense(); }}>
                {/* Entry Type Toggle */}
                <div className="flex gap-2 mb-2">
                  <Button type="button" size="sm" variant={entryType === 'expense' ? 'default' : 'outline'} onClick={() => setEntryType('expense')}>Expense</Button>
                  <Button type="button" size="sm" variant={entryType === 'income' ? 'default' : 'outline'} onClick={() => setEntryType('income')}>Income</Button>
                </div>
                {/* Category */}
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="w-full mt-1 border rounded-md p-2 bg-background"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Select category</option>
                    {(entryType === 'income' ? incomeCategories : expenseCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {formErrors.category && <div className="text-red-500 text-xs mt-1">{formErrors.category}</div>}
                  <div className="mt-2 flex flex-col gap-2">
                    {showAddCategory ? (
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="New category"
                          value={newCategory}
                          onChange={e => setNewCategory(e.target.value)}
                          className="flex-1"
                        />
                        <Button type="button" size="sm" onClick={handleAddCategory} disabled={!newCategory.trim() || expenseCategories.includes(newCategory.trim()) || incomeCategories.includes(newCategory.trim()) || customCategories.includes(newCategory.trim())}>Add</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddCategory(false); setNewCategory(""); }}>Cancel</Button>
                      </div>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => setShowAddCategory(true)}>+ Add Category</Button>
                    )}
                  </div>
                </div>
                {/* Amount */}
                <div>
                  <Label htmlFor="amount">{entryType === 'income' ? 'Amount (Income)' : 'Amount (Expense)'}</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                  {formErrors.amount && <div className="text-red-500 text-xs mt-1">{formErrors.amount}</div>}
                </div>
                {/* Date and Quick Select */}
                <div>
                  <Label htmlFor="date">Date</Label>
                  <div className="flex gap-2 mb-2 mt-1">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-md border text-xs transition-colors ${form.date === today ? "bg-primary/10 text-primary border-primary" : "bg-background border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800"}`}
                      onClick={() => setForm(f => ({ ...f, date: today }))}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-md border text-xs transition-colors ${form.date === tomorrow ? "bg-primary/10 text-primary border-primary" : "bg-background border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800"}`}
                      onClick={() => setForm(f => ({ ...f, date: tomorrow }))}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-md border text-xs transition-colors ${form.date === yesterday ? "bg-primary/10 text-primary border-primary" : "bg-background border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800"}`}
                      onClick={() => setForm(f => ({ ...f, date: yesterday }))}
                    >
                      Yesterday
                    </button>
                  </div>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                  {formErrors.date && <div className="text-red-500 text-xs mt-1">{formErrors.date}</div>}
                </div>
                {/* Recurring Option */}
                <div className="flex items-center gap-2">
                  <input
                    id="recurring"
                    type="checkbox"
                    checked={isRecurring}
                    onChange={e => setIsRecurring(e.target.checked)}
                  />
                  <Label htmlFor="recurring">Recurring</Label>
                </div>
                {isRecurring && (
                  <div className="flex flex-col gap-2 ml-6">
                    <div>
                      <Label htmlFor="frequency">Frequency</Label>
                      <select
                        id="frequency"
                        className="w-full mt-1 border rounded-md p-2 bg-background"
                        value={recurring.frequency}
                        onChange={e => setRecurring(r => ({ ...r, frequency: e.target.value }))}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={recurring.endDate}
                        onChange={e => setRecurring(r => ({ ...r, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
                {/* Note */}
                <div>
                  <Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label>
                  <textarea
                    id="note"
                    className="w-full mt-1 border rounded-md p-2 bg-background"
                    rows={2}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
              </form>
              <DialogFooter className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)} type="button">Cancel</Button>
                <Button type="button" onClick={handleAddExpense} disabled={!form.category || !form.amount || !form.date || !!formErrors.amount || !!formErrors.category || !!formErrors.date}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Expenses</CardTitle>
                <CardDescription>This month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">₹{summary.expenses.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Income</CardTitle>
                <CardDescription>This month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">₹{summary.income.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
                <CardDescription>Current</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">₹{summary.balance.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 4 records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="py-2 px-4 text-left">Category</th>
                      <th className="py-2 px-4 text-left">Date</th>
                      <th className="py-2 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 4).map(tx => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-2 px-4">{tx.category}</td>
                        <td className="py-2 px-4">{tx.date}</td>
                        <td className={`py-2 px-4 text-right font-medium ${tx.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                          {tx.amount < 0 ? "-" : "+"}₹{Math.abs(tx.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Chart Section */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Overview</CardTitle>
              <CardDescription>Monthly summary by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                {Object.keys(categoryTotals).length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <span className="italic text-muted-foreground">No expenses for this month.</span>
                )}
              </div>
              <div className="h-64 flex items-center justify-center mt-8">
                {Object.keys(categoryTotals).length > 0 ? (
                  <Pie data={pieData} />
                ) : (
                  <span className="italic text-muted-foreground">No category data for this month.</span>
                )}
              </div>
              <div className="h-64 flex items-center justify-center mt-8">
                {weeks.some(w => weekTotals[w] > 0) ? (
                  <Line data={lineData} options={lineOptions} />
                ) : (
                  <span className="italic text-muted-foreground">No weekly trend data.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Sidebar for desktop */}
        <div className="hidden md:block w-full md:w-80 flex-shrink-0 mt-20">
          <Card className="flex flex-col items-center py-8 gap-8 sticky top-6 min-h-[600px]">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-zinc-300 dark:bg-zinc-700 w-20 h-20 flex items-center justify-center overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-20 h-20 object-cover rounded-full" />
                ) : (
                  <UserCircle className="w-16 h-16 text-zinc-500" />
                )}
              </div>
              <div className="font-semibold text-lg mt-2">{user?.displayName || "User Name"}</div>
              <div className="text-xs text-muted-foreground">{user?.email || "user@email.com"}</div>
            </div>
            {/* Menu */}
            <nav className="w-full flex flex-col gap-2 mt-4">
              <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => handleMenuClick("/dashboard")} />
              <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => handleMenuClick("/dashboard/portfolio")} />
              <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => handleMenuClick("/dashboard/transactions")} />
              <SidebarMenuItem icon={<Settings />} label="Settings" active={pathname === "/dashboard/settings"} onClick={() => handleMenuClick("/dashboard/settings")} />
              <SidebarMenuItem icon={<LogOut />} label="Logout" onClick={handleLogout} />
            </nav>
          </Card>
        </div>
        {/* Sidebar for mobile (slide-over) */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 bg-black/40 flex md:hidden" onClick={() => setShowSidebar(false)}>
            <div className="bg-white dark:bg-zinc-900 w-72 max-w-full h-full shadow-lg p-6 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setShowSidebar(false)} className="p-1 rounded focus:outline-none">
                  <span className="text-2xl">×</span>
                </button>
              </div>
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-2 mb-6">
                <div className="rounded-full bg-zinc-300 dark:bg-zinc-700 w-16 h-16 flex items-center justify-center overflow-hidden">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-16 h-16 object-cover rounded-full" />
                  ) : (
                    <UserCircle className="w-12 h-12 text-zinc-500" />
                  )}
                </div>
                <div className="font-semibold text-base mt-1">{user?.displayName || "User Name"}</div>
                <div className="text-xs text-muted-foreground">{user?.email || "user@email.com"}</div>
              </div>
              {/* Menu */}
              <nav className="w-full flex flex-col gap-2">
                <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => { handleMenuClick("/dashboard"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => { handleMenuClick("/dashboard/portfolio"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => { handleMenuClick("/dashboard/transactions"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<Settings />} label="Settings" active={pathname === "/dashboard/settings"} onClick={() => { handleMenuClick("/dashboard/settings"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<LogOut />} label="Logout" onClick={() => { handleLogout(); setShowSidebar(false); }} />
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarMenuItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
      }`}
      onClick={onClick}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
} 