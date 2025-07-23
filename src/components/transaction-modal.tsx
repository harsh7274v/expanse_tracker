"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, addDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";
import type { KeyedMutator } from "swr";

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

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  mutate: KeyedMutator<Transaction[]>;
  categories: string[];
}

export default function TransactionModal({ open, onOpenChange, user, mutate, categories }: TransactionModalProps) {
  const [form, setForm] = useState({ category: "", amount: "", date: "", note: "" });
  const [formErrors, setFormErrors] = useState<{ category?: string; amount?: string; date?: string }>({});
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurring, setRecurring] = useState({ frequency: 'Monthly', endDate: '' });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const expenseCategories = useMemo(() => [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Other",
  ], []);
  const incomeCategories = useMemo(() => [
    "Salary",
    "Business",
    "Investments",
    "Gifts",
    "Other Income",
  ], []);

  // Load custom categories from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("customCategories");
    if (stored) setCustomCategories(JSON.parse(stored));
  }, []);
  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem("customCategories", JSON.stringify(customCategories));
  }, [customCategories]);

  // When switching entryType, reset category to first default
  useEffect(() => {
    const defaultCat = entryType === 'expense' ? expenseCategories[0] : incomeCategories[0];
    setForm(f => ({ ...f, category: defaultCat }));
  }, [entryType, expenseCategories, incomeCategories]);

  function handleAddCategory() {
    const cat = newCategory.trim();
    if (!cat || categories.includes(cat) || customCategories.includes(cat)) return;
    setCustomCategories([...customCategories, cat]);
    setNewCategory("");
    setShowAddCategory(false);
  }

  function validateForm() {
    const errors: { category?: string; amount?: string; date?: string } = {};
    if (!form.category) errors.category = "Category is required.";
    if (!form.amount) errors.amount = "Amount is required.";
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) errors.amount = "Amount must be a positive number.";
    if (!form.date) errors.date = "Date is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function getNextDate(dateStr: string, frequency: string): string {
    const date = new Date(dateStr);
    if (frequency === "Daily") date.setDate(date.getDate() + 1);
    else if (frequency === "Weekly") date.setDate(date.getDate() + 7);
    else if (frequency === "Monthly") date.setMonth(date.getMonth() + 1);
    else if (frequency === "Yearly") date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  async function handleAddExpense() {
    if (!validateForm()) return;
    if (!user) return;
    const baseEntry = {
      uid: user.uid,
      type: entryType, // 'expense' or 'income'
      category: form.category,
      amount: entryType === "expense" ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount)),
      note: form.note,
      createdAt: new Date().toISOString(),
    };
    let entries = [];
    if (isRecurring && recurring.endDate && form.date) {
      // Generate all dates from form.date to recurring.endDate at the selected frequency
      let currentDate = form.date;
      const endDate = recurring.endDate;
      while (currentDate <= endDate) {
        entries.push({
          ...baseEntry,
          date: currentDate,
          recurring: {
            frequency: recurring.frequency,
            endDate: recurring.endDate || null,
          },
        });
        currentDate = getNextDate(currentDate, recurring.frequency);
      }
    } else {
      entries = [{
        ...baseEntry,
        date: form.date,
        recurring: isRecurring ? {
          frequency: recurring.frequency,
          endDate: recurring.endDate || null,
        } : null,
      }];
    }
    // Optimistically update SWR cache
    mutate((prev: Transaction[] = []) => [
      ...entries.map((entry, i) => ({ ...entry, id: "temp-" + Date.now() + "-" + i })),
      ...prev,
    ], false);
    onOpenChange(false);
    setForm({ category: "", amount: "", date: "", note: "" });
    setEntryType("expense");
    setIsRecurring(false);
    setRecurring({ frequency: "Monthly", endDate: "" });
    try {
      const userTransactionsRef = collection(db, "users", user.uid, "transactions");
      for (const entry of entries) {
        await addDoc(userTransactionsRef, entry);
      }
      // Revalidate SWR cache
      mutate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Failed to add entry: " + message);
    }
  }

  // Helper for quick date selection
  function getDateString(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    // Format as YYYY-MM-DD in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const today = getDateString(0);
  const tomorrow = getDateString(1);
  const yesterday = getDateString(-1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
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
              {(entryType === 'income' ? incomeCategories : expenseCategories).map((cat, idx) => (
                <option key={cat || idx} value={cat}>{cat}</option>
              ))}
              {customCategories.filter(Boolean).map((cat, idx) => (
                <option key={cat || idx} value={cat}>{cat}</option>
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
                  <Button type="button" size="sm" onClick={handleAddCategory} disabled={!newCategory.trim() || categories.includes(newCategory.trim()) || customCategories.includes(newCategory.trim())}>Add</Button>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
          <Button type="button" onClick={handleAddExpense} disabled={!form.category || !form.amount || !form.date || !!formErrors.amount || !!formErrors.category || !!formErrors.date}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 