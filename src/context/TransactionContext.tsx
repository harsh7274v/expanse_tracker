"use client";
import { createContext, useContext } from "react";
import useSWR, { KeyedMutator } from "swr";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";

export interface Transaction {
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

type TransactionContextType = {
  transactions: Transaction[];
  isLoading: boolean;
  error: any;
  mutate: KeyedMutator<Transaction[]>;
};

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthUser();
  const {
    data: transactions = [],
    error,
    isLoading,
    mutate,
  } = useSWR<Transaction[]>(
    user ? ["transactions", user.uid] : null,
    async () => {
      if (!user) return [];
      const userTransactionsRef = collection(db, "users", user.uid, "transactions");
      const querySnapshot = await getDocs(userTransactionsRef);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    }
  );

  return (
    <TransactionContext.Provider value={{ transactions, isLoading, error, mutate }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used within a TransactionProvider");
  return ctx;
} 