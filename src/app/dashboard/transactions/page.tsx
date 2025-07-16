"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import useSWR from "swr";
import { onAuthStateChanged } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Edit, Trash2, ArrowDownUp, Plus, FileDown, TrendingDown, TrendingUp, Wallet, Calendar, X } from "lucide-react";
import TransactionModal from "@/components/transaction-modal";
import type { User } from "firebase/auth";

interface Transaction {
  id: string;
  category: string;
  date: string;
  amount: number;
  note?: string;
  type?: string;
  recurring?: {
    frequency: string;
    endDate: string | null;
  } | null;
  createdAt?: string;
}

// Helper to check if a date string is in the current month
function isCurrentMonth(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Fetcher for transactions or archived_transactions
type FetchSource = "transactions" | "archived_transactions";
const fetchTransactions = async (uid: string, source: FetchSource): Promise<Transaction[]> => {
  if (!uid) return [];
  const userTransactionsRef = collection(db, "users", uid, source);
  const querySnapshot = await getDocs(userTransactionsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
};

const sortOptions = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "category", label: "Category" },
];

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
  const [sortByPopoverOpen, setSortByPopoverOpen] = useState(false);
  const [sortDirPopoverOpen, setSortDirPopoverOpen] = useState(false);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Determine which collection to use based on date range
  let fetchSource: FetchSource = "transactions";
  let viewingArchived = false;
  if (startDate && endDate) {
    // If both start and end date are in a previous month (not current month), use archived_transactions
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');
    const startMonth = start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0');
    const endMonth = end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, '0');
    if (startMonth !== currentMonth && endMonth !== currentMonth && startMonth === endMonth) {
      fetchSource = "archived_transactions";
      viewingArchived = true;
    }
  }

  const { data: transactions = [], isLoading, error, mutate } = useSWR<Transaction[]>(
    user ? [fetchSource, user.uid] : null,
    () => user ? fetchTransactions(user.uid, fetchSource) : Promise.resolve([])
  );

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => set.add(tx.category));
    return Array.from(set);
  }, [transactions]);

  // Filter, search, and sort transactions
  const filtered = useMemo(() => {
    let data = [...transactions];
    // Filter by category
    if (categoryFilter) {
      data = data.filter(tx => tx.category === categoryFilter);
    }
    // Filter by date range
    if (startDate) {
      data = data.filter(tx => tx.date >= startDate);
    }
    if (endDate) {
      data = data.filter(tx => tx.date <= endDate);
    }
    // Search by note or category
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        tx =>
          (tx.note && tx.note.toLowerCase().includes(q)) ||
          (tx.category && tx.category.toLowerCase().includes(q))
      );
    }
    // Sort
    data.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") {
        cmp = (a.date || "").localeCompare(b.date || "");
      } else if (sortBy === "amount") {
        cmp = a.amount - b.amount;
      } else if (sortBy === "category") {
        cmp = (a.category || "").localeCompare(b.category || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [transactions, categoryFilter, startDate, endDate, search, sortBy, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [filtered.length]); // Reset to page 1 on filter change

  // Summary/stats for filtered transactions
  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, tx) => {
        if (tx.amount < 0) acc.expenses += Math.abs(tx.amount);
        else acc.income += tx.amount;
        return { ...acc, balance: acc.income - acc.expenses };
      },
      { expenses: 0, income: 0, balance: 0 }
    );
  }, [filtered]);

  // Export filtered transactions as CSV
  function exportCSV() {
    if (!filtered.length) return;
    const header = ["Category", "Date", "Amount", "Note"];
    const rows = filtered.map(tx => [
      tx.category,
      tx.date,
      tx.amount,
      tx.note ? `"${tx.note.replace(/"/g, '""')}"` : ""
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Handle Delete
  async function handleDelete(tx: Transaction) {
    setPendingDeleteTx(tx);
  }
  async function confirmDelete() {
    if (!user || !pendingDeleteTx) return;
    try {
      const txRef = doc(db, "users", user.uid, "transactions", pendingDeleteTx.id);
      await deleteDoc(txRef);
      mutate();
      setPendingDeleteTx(null);
    } catch (err) {
      alert("Failed to delete transaction.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-2 sm:px-4">
      <h1 className="text-2xl font-bold mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span>Transactions</span>
        <Button size="sm" className="shadow-md" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Transaction
        </Button>
      </h1>
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 sm:p-6">
        {/* Export and Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <Button size="sm" variant="outline" className="shadow" onClick={exportCSV} disabled={!filtered.length}>
            <FileDown className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto justify-between">
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2 shadow-sm min-w-[140px]">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-xs text-muted-foreground">Expenses</div>
                <div className="font-semibold text-red-500">₹{summary.expenses.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 rounded-lg px-4 py-2 shadow-sm min-w-[140px]">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">Income</div>
                <div className="font-semibold text-green-600">₹{summary.income.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg px-4 py-2 shadow-sm min-w-[140px]">
              <Wallet className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="font-semibold text-blue-600">₹{summary.balance.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
        {/* Filter/Search/Sort Controls as horizontal bar */}
        <div className="flex flex-wrap gap-2 items-end mb-6 w-full">
          {/* Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              id="search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search note or category"
              className="border rounded-lg pl-8 pr-2 py-2 w-full bg-background focus:ring-2 focus:ring-primary text-sm"
            />
            <span className="absolute left-2 top-2.5 text-zinc-400 pointer-events-none"><Search className="w-4 h-4" /></span>
          </div>
          {/* Category popover */}
          <div className="relative flex-1 min-w-[120px] max-w-xs">
            <button
              ref={categoryButtonRef}
              type="button"
              className={`w-full border rounded-lg px-3 py-2 bg-background text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary transition shadow-sm ${categoryFilter ? 'font-semibold' : 'text-zinc-400'}`}
              onClick={() => setCategoryPopoverOpen(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={categoryPopoverOpen}
              id="category"
            >
              <span className="truncate">{categoryFilter || "Category"}</span>
              <ArrowDownUp className="w-4 h-4 ml-2 text-zinc-400" />
            </button>
            {categoryPopoverOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in">
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-primary/10 rounded ${!categoryFilter ? 'font-semibold text-primary' : ''}`}
                  onClick={() => { setCategoryFilter(""); setCategoryPopoverOpen(false); }}
                >
                  All
                </button>
                {categories.filter(Boolean).map((cat, idx) => (
                  <button
                    key={cat || idx}
                    className={`w-full text-left px-4 py-2 hover:bg-primary/10 rounded ${categoryFilter === cat ? 'font-semibold text-primary' : ''}`}
                    onClick={() => { setCategoryFilter(cat); setCategoryPopoverOpen(false); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Start Date popover */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <button
              type="button"
              className={`w-full border rounded-lg px-3 py-2 bg-background text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary transition shadow-sm ${startDate ? 'font-semibold' : 'text-zinc-400'}`}
              onClick={() => setStartDatePopoverOpen(v => !v)}
              aria-haspopup="dialog"
              aria-expanded={startDatePopoverOpen}
            >
              <span>{startDate ? startDate.split("-").reverse().join("-") : "Start Date"}</span>
              <Calendar className="w-4 h-4 ml-2 text-zinc-400" />
            </button>
            {startDatePopoverOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 animate-fade-in">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setStartDatePopoverOpen(false); }}
                  className="border rounded-lg px-2 py-2 w-full bg-background focus:ring-2 focus:ring-primary text-sm"
                  placeholder="dd-mm-yyyy"
                />
              </div>
            )}
          </div>
          {/* End Date popover */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <button
              type="button"
              className={`w-full border rounded-lg px-3 py-2 bg-background text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary transition shadow-sm ${endDate ? 'font-semibold' : 'text-zinc-400'}`}
              onClick={() => setEndDatePopoverOpen(v => !v)}
              aria-haspopup="dialog"
              aria-expanded={endDatePopoverOpen}
            >
              <span>{endDate ? endDate.split("-").reverse().join("-") : "End Date"}</span>
              <Calendar className="w-4 h-4 ml-2 text-zinc-400" />
            </button>
            {endDatePopoverOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 animate-fade-in">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setEndDatePopoverOpen(false); }}
                  className="border rounded-lg px-2 py-2 w-full bg-background focus:ring-2 focus:ring-primary text-sm"
                  placeholder="dd-mm-yyyy"
                />
              </div>
            )}
          </div>
          {/* Sort By popover */}
          <div className="relative flex-1 min-w-[120px] max-w-xs">
            <button
              type="button"
              className={`w-full border rounded-lg px-3 py-2 bg-background text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary transition shadow-sm ${sortBy ? 'font-semibold' : 'text-zinc-400'}`}
              onClick={() => setSortByPopoverOpen(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortByPopoverOpen}
            >
              <span>{sortOptions.find(opt => opt.value === sortBy)?.label || "Sort By"}</span>
              <ArrowDownUp className="w-4 h-4 ml-2 text-zinc-400" />
            </button>
            {sortByPopoverOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`w-full text-left px-4 py-2 hover:bg-primary/10 rounded ${sortBy === opt.value ? 'font-semibold text-primary' : ''}`}
                    onClick={() => { setSortBy(opt.value); setSortByPopoverOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Order popover */}
          <div className="relative flex-1 min-w-[120px] max-w-xs">
            <button
              type="button"
              className={`w-full border rounded-lg px-3 py-2 bg-background text-sm text-left flex items-center justify-between focus:ring-2 focus:ring-primary transition shadow-sm ${sortDir ? 'font-semibold' : 'text-zinc-400'}`}
              onClick={() => setSortDirPopoverOpen(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortDirPopoverOpen}
            >
              <span>{sortDir === "desc" ? "Descending" : "Ascending"}</span>
              <ArrowDownUp className="w-4 h-4 ml-2 text-zinc-400" />
            </button>
            {sortDirPopoverOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in">
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-primary/10 rounded ${sortDir === "desc" ? 'font-semibold text-primary' : ''}`}
                  onClick={() => { setSortDir("desc"); setSortDirPopoverOpen(false); }}
                >
                  Descending
                </button>
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-primary/10 rounded ${sortDir === "asc" ? 'font-semibold text-primary' : ''}`}
                  onClick={() => { setSortDir("asc"); setSortDirPopoverOpen(false); }}
                >
                  Ascending
                </button>
              </div>
            )}
          </div>
          {/* Clear filters button */}
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-500 hover:text-primary px-2 py-2 rounded-full"
              onClick={() => {
                setSearch("");
                setCategoryFilter("");
                setStartDate("");
                setEndDate("");
                setSortBy("date");
                setSortDir("desc");
              }}
              title="Clear all filters"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {/* Table or Cards */}
        {viewingArchived && (
          <div className="mb-4 text-xs text-blue-600 font-medium">Showing archived transactions for {startDate?.slice(0,7)}</div>
        )}
        {isLoading || !user ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">Failed to load transactions.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No transactions found.</div>
        ) : (
          <>
            {/* Table for desktop, cards for mobile */}
            <div className="hidden sm:block overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-2 px-2 sm:px-4 text-left">Category</th>
                    <th className="py-2 px-2 sm:px-4 text-left">Date</th>
                    <th className="py-2 px-2 sm:px-4 text-right">Amount</th>
                    <th className="py-2 px-2 sm:px-4 text-left">Note</th>
                    <th className="py-2 px-2 sm:px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((tx, i) => (
                    <tr key={tx.id || i} className={`border-b last:border-0 transition-colors ${i % 2 === 0 ? 'bg-zinc-50 dark:bg-zinc-900/40' : ''} hover:bg-primary/10`}>
                      <td className="py-2 px-2 sm:px-4">{tx.category}</td>
                      <td className="py-2 px-2 sm:px-4">{tx.date}</td>
                      <td className={`py-2 px-2 sm:px-4 text-right font-medium ${tx.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                        {tx.amount < 0 ? "-" : "+"}₹{Math.abs(tx.amount).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 sm:px-4">{tx.note || "-"}</td>
                      <td className="py-2 px-2 sm:px-4 text-center flex gap-2 justify-center">
                        <Button size="icon" variant="outline" className="rounded-full" title="Edit" onClick={() => {}}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="destructive" className="rounded-full" title="Delete" onClick={() => handleDelete(tx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cards for mobile */}
            <div className="sm:hidden flex flex-col gap-1">
              {paginated.map((tx, i) => (
                <div key={tx.id || i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-2 py-1 shadow-sm flex flex-row items-center gap-2 text-[15px] min-h-[40px]">
                  <div className="font-semibold text-xs truncate max-w-[32vw] flex-1">{tx.category}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[22vw] flex-1 text-center">{tx.date}</div>
                  <div className={`font-semibold text-xs flex-shrink-0 ${tx.amount < 0 ? "text-red-500" : "text-green-600"}`}>{tx.amount < 0 ? "-" : "+"}₹{Math.abs(tx.amount).toFixed(2)}</div>
                  <div className="flex gap-1 flex-shrink-0 ml-1">
                    <Button size="icon" variant="outline" className="rounded-full" title="Edit" onClick={() => {}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" className="rounded-full" title="Delete" onClick={() => handleDelete(tx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                className="px-3 py-1 rounded border bg-background disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`px-3 py-1 rounded border ${page === i + 1 ? 'bg-primary text-white' : 'bg-background'}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="px-3 py-1 rounded border bg-background disabled:opacity-50"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
      {/* Add Transaction Modal */}
      <TransactionModal
        open={showModal}
        onOpenChange={setShowModal}
        user={user as User}
        mutate={mutate}
        categories={categories}
      />
      {/* Delete Confirmation Modal */}
      <Dialog open={!!pendingDeleteTx} onOpenChange={open => { if (!open) setPendingDeleteTx(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
          </DialogHeader>
          <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-200 text-center">
            Are you sure you want to delete?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteTx(null)} type="button">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} type="button">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 