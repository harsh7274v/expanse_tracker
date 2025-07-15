"use client"

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle, LayoutDashboard, Briefcase, List, Settings, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useSWR, { mutate } from "swr";

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

          {/* Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Overview</CardTitle>
              <CardDescription>Chart coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                <span className="italic">[Chart Placeholder]</span>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Sidebar */}
        <div className="w-full md:w-80 flex-shrink-0">
          <Card className="h-full flex flex-col items-center py-8 gap-8 sticky top-6">
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