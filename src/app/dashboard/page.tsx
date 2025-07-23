"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, List, Settings, LogOut, Menu } from "lucide-react";
import Image from "next/image";
import type { User } from "firebase/auth";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTransactions } from "@/context/TransactionContext";
import { Bar, Pie } from "react-chartjs-2";
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
  Filler, // <-- Add this line for the Filler plugin
} from "chart.js";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";
import AnimatedLoadingDots from "@/components/AnimatedLoadingDots";
import TransactionModal from "@/components/transaction-modal";
import { onAuthStateChanged, getAuth, signOut } from "firebase/auth";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler); // <-- Add Filler here

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);
  const { transactions, isLoading: transactionsLoading, error: transactionsError, mutate } = useTransactions();
  const categories = Array.from(new Set(transactions.map(tx => tx.category)));
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [reauthNeeded, setReauthNeeded] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showSettings && user) {
      setUsername(user.displayName || "");
      setPassword("");
      setCurrentPassword("");
      setSettingsError("");
      setSettingsSuccess("");
      setReauthNeeded(false);
    }
  }, [showSettings, user]);

  function getProviderId() {
    if (!user || !user.providerData || user.providerData.length === 0) return "";
    return user.providerData[0]?.providerId || "";
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSettingsLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      // Update displayName if changed
      if (username && username !== user.displayName) {
        await updateProfile(user, {
          displayName: username,
        });
      }
      // Update password if provided
      if (password) {
        try {
          await updatePassword(user, password);
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code?: string }).code === "auth/requires-recent-login"
          ) {
            setReauthNeeded(true);
            setSettingsError("Re-authentication required to change password.");
            return;
          } else {
            throw err;
          }
        }
      }
      setSettingsSuccess("Profile updated successfully!");
      setTimeout(() => {
        setShowSettings(false);
        setSettingsSuccess("");
      }, 1200);
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleReauth(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setSettingsError("User not found. Please log in again.");
      return;
    }
    setReauthLoading(true);
    setSettingsError("");
    try {
      const providerId = getProviderId();
      if (providerId === "password") {
        // Email/password reauth
        if (!currentPassword) {
          setSettingsError("Current password is required for re-authentication.");
          setReauthLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
        await reauthenticateWithCredential(user, credential);
      } else if (providerId === "google.com") {
        // Google reauth
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else {
        setSettingsError("Re-authentication for this provider is not supported in this demo.");
        setReauthLoading(false);
        return;
      }
      setReauthNeeded(false);
      setSettingsError("");
      // Retry password update
      if (password) {
        await updatePassword(user, password);
      }
      setSettingsSuccess("Password updated successfully!");
      setTimeout(() => {
        setShowSettings(false);
        setSettingsSuccess("");
      }, 1200);
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : "Re-authentication failed.");
    } finally {
      setReauthLoading(false);
    }
  }

  // Load custom categories from localStorage
  useEffect(() => {
    // const stored = localStorage.getItem("customCategories");
    // if (stored) setCustomCategories(JSON.parse(stored));
  }, []);
  // Save custom categories to localStorage
  useEffect(() => {
    // localStorage.setItem("customCategories", JSON.stringify(customCategories));
  }, []);

  // When switching entryType, reset category
  useEffect(() => {
    // setForm(f => ({ ...f, category: "" })); // This line is no longer needed
  }, []); // Removed dependency on entryType

  // Helper to check if photoURL is a valid URL and not a placeholder
  function isValidPhotoURL(url?: string | null) {
    if (!url) return false;
    if (typeof url !== 'string') return false;
    if (['profile', 'Profile', ''].includes(url.trim())) return false;
    return /^https?:\/\//.test(url);
  }

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/login");
  };

  // Replace loading state
  if (!user || transactionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <Image src="/favicon.ico" alt="Loading" width={48} height={48} className="w-12 h-12 animate-pulse" />
          <AnimatedLoadingDots text="" />
        </div>
      </div>
    );
  }
  if (transactionsError) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-red-500">Failed to load transactions.</div>;
  }

  const now = new Date();
  const last30Days = new Date(now);
  last30Days.setDate(now.getDate() - 29);
  const last30DaysStr = last30Days.toISOString().slice(0, 10);
  const txLast30 = transactions.filter(tx => tx.date && tx.date >= last30DaysStr);
  const totalSpent30 = txLast30.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalIncome30 = txLast30.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const categoryTotals30: Record<string, number> = {};
  txLast30.filter(tx => tx.amount < 0).forEach(tx => {
    categoryTotals30[tx.category] = (categoryTotals30[tx.category] || 0) + Math.abs(tx.amount);
  });
  const barData = {
    labels: Object.keys(categoryTotals30),
    datasets: [
      {
        label: "Expenses (₹)",
        data: Object.values(categoryTotals30),
        backgroundColor: [
          "#ef4444", "#f59e42", "#fbbf24", "#10b981", "#3b82f6", "#a78bfa", "#f472b6", "#6366f1"
        ],
        borderRadius: 8,
        barPercentage: 0.7,
        categoryPercentage: 0.6,
      },
    ],
  };
  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Spending by Category (Last 30 Days)", font: { size: 18 } },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (tickValue: string | number) => `₹${tickValue}`,
        },
        grid: { color: "#e5e7eb" },
      },
      x: {
        grid: { display: false },
      },
    },
  };
  const pieData = {
    labels: ["Expense", "Income"],
    datasets: [
      {
        data: [totalSpent30, totalIncome30],
        backgroundColor: ["#ef4444", "#10b981"],
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 8,
      },
    ],
  };
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: "bottom" as const },
      title: { display: true, text: "Income vs Expense (Last 30 Days)", font: { size: 18 } },
      tooltip: { enabled: true },
    },
  };

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
          <TransactionModal
            open={showAddModal}
            onOpenChange={setShowAddModal}
            user={user as User}
            mutate={mutate}
            categories={categories}
          />
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Expenses</CardTitle>
                <CardDescription>This month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">₹{transactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Income</CardTitle>
                <CardDescription>This month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">₹{transactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
                <CardDescription>Current</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">₹{transactions.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)}</div>
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
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-lg font-semibold text-zinc-500">Total Spent</div>
                  <div className="text-3xl font-bold text-red-500">₹{totalSpent30.toFixed(2)}</div>
                  <div className="text-lg font-semibold text-zinc-500 mt-2">Total Income</div>
                  <div className="text-3xl font-bold text-green-600">₹{totalIncome30.toFixed(2)}</div>
                </div>
                <div className="flex-1 min-w-[250px] max-w-[400px]">
                  <Bar data={barData} options={barOptions} />
                </div>
                <div className="flex-1 min-w-[220px] max-w-[320px]">
                  <Pie data={pieData} options={pieOptions} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Sidebar for desktop */}
        <div className="hidden md:block w-full md:w-80 flex-shrink-0 mt-20">
          <div className="sticky top-6">
            <div className="rounded-2xl shadow-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-6 px-4 gap-4 min-h-[520px] backdrop-blur-md">
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-1 w-full">
                <div className="rounded-full border-4 border-primary/30 bg-zinc-300 dark:bg-zinc-700 w-16 h-16 flex items-center justify-center overflow-hidden shadow">
                  {isValidPhotoURL(user?.photoURL) ? (
                    <Image src={user.photoURL!} alt="Profile" width={64} height={64} className="w-16 h-16 object-cover rounded-full" style={{ height: 'auto' }} />
                  ) : (
                    <span className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-white bg-primary rounded-full">
                      {(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="font-semibold text-base mt-1 truncate max-w-[90%] text-center">{user?.displayName || "User Name"}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[90%] text-center">{user?.email || "user@email.com"}</div>
              </div>
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800 my-2" />
              {/* Menu */}
              <nav className="w-full flex flex-col gap-1 mt-0">
                <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => router.push("/dashboard")} />
                <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => router.push("/dashboard/portfolio")} />
                <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => router.push("/dashboard/transactions")} />
                <SidebarMenuItem icon={<Settings />} label="Settings" active={showSettings} onClick={() => setShowSettings(true)} />
                <SidebarMenuItem icon={<LogOut />} label="Logout" onClick={handleLogout} />
              </nav>
            </div>
          </div>
        </div>
        {/* Sidebar for mobile (slide-over) */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 bg-black/40 flex md:hidden" onClick={() => setShowSidebar(false)}>
            <div className="bg-white/90 dark:bg-zinc-900/90 w-72 max-w-full h-full shadow-2xl rounded-r-2xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setShowSidebar(false)} className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 focus:outline-none transition">
                  <span className="text-2xl">×</span>
                </button>
              </div>
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-1 mb-4">
                <div className="rounded-full border-4 border-primary/30 bg-zinc-300 dark:bg-zinc-700 w-14 h-14 flex items-center justify-center overflow-hidden shadow">
                  {isValidPhotoURL(user?.photoURL) ? (
                    <Image src={user.photoURL!} alt="Profile" width={56} height={56} className="w-14 h-14 object-cover rounded-full" style={{ height: 'auto' }} />
                  ) : (
                    <span className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-white bg-primary rounded-full">
                      {(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm mt-1 truncate max-w-[90%] text-center">{user?.displayName || "User Name"}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[90%] text-center">{user?.email || "user@email.com"}</div>
              </div>
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800 my-2" />
              {/* Menu */}
              <nav className="w-full flex flex-col gap-1">
                <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => { router.push("/dashboard"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => { router.push("/dashboard/portfolio"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => { router.push("/dashboard/transactions"); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<Settings />} label="Settings" active={showSettings} onClick={() => { setShowSettings(true); setShowSidebar(false); }} />
                <SidebarMenuItem icon={<LogOut />} label="Logout" onClick={() => { handleLogout(); setShowSidebar(false); }} />
              </nav>
            </div>
          </div>
        )}
        {/* Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={reauthNeeded ? handleReauth : handleSettingsSave}>
              <div>
                <Label htmlFor="username">Change Username</Label>
                <Input id="username" type="text" placeholder="New username" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">Change Password</Label>
                <Input id="password" type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {reauthNeeded && getProviderId() === "password" && (
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                </div>
              )}
              {reauthNeeded && getProviderId() === "google.com" && (
                <Button type="button" onClick={handleReauth} disabled={reauthLoading}>
                  {reauthLoading ? "Re-authenticating..." : "Re-authenticate with Google"}
                </Button>
              )}
              {settingsError && <div className="text-red-500 text-sm text-center">{settingsError}</div>}
              {settingsSuccess && <div className="text-green-600 text-sm text-center">{settingsSuccess}</div>}
              <DialogFooter className="flex gap-2 justify-end mt-4">
                <Button variant="outline" type="button" onClick={() => setShowSettings(false)} disabled={settingsLoading || reauthLoading}>Cancel</Button>
                <Button type="submit" disabled={settingsLoading || reauthLoading}>
                  {reauthNeeded ? (reauthLoading ? "Re-authenticating..." : "Re-authenticate & Save") : (settingsLoading ? "Saving..." : "Save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SidebarMenuItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-all duration-150 select-none
        ${active
          ? "bg-primary/10 text-primary font-semibold scale-[1.03] shadow-sm"
          : "hover:bg-primary/5 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"}
      `}
      onClick={onClick}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
} 