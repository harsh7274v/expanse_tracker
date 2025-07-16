import Image from "next/image";
import { LayoutDashboard, Briefcase, List, Settings, LogOut } from "lucide-react";
import type { User } from "firebase/auth";

interface SidebarProps {
  user: User | null;
  pathname: string;
  handleMenuClick: (path: string) => void;
  handleLogout: () => void;
  showSidebar: boolean;
  setShowSidebar: (open: boolean) => void;
}

function isValidPhotoURL(url?: string | null) {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  if (["profile", "Profile", ""].includes(url.trim())) return false;
  return /^https?:\/\//.test(url);
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

export default function Sidebar({ user, pathname, handleMenuClick, handleLogout, showSidebar, setShowSidebar }: SidebarProps) {
  return (
    <>
      {/* Sidebar for desktop */}
      <div className="hidden md:block w-full md:w-80 flex-shrink-0 mt-20">
        <div className="sticky top-6">
          <div className="rounded-2xl shadow-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-6 px-4 gap-4 min-h-[520px] backdrop-blur-md">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-1 w-full">
              <div className="rounded-full border-4 border-primary/30 bg-zinc-300 dark:bg-zinc-700 w-16 h-16 flex items-center justify-center overflow-hidden shadow">
                {isValidPhotoURL(user?.photoURL) ? (
                  <Image src={user!.photoURL!} alt="Profile" width={64} height={64} className="w-16 h-16 object-cover rounded-full" style={{ height: 'auto' }} />
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
              <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => handleMenuClick("/dashboard")} />
              <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => handleMenuClick("/dashboard/portfolio")} />
              <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => handleMenuClick("/dashboard/transactions")} />
              <SidebarMenuItem icon={<Settings />} label="Settings" active={pathname === "/dashboard/settings"} onClick={() => handleMenuClick("/dashboard/settings")} />
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
                  <Image src={user!.photoURL!} alt="Profile" width={56} height={56} className="w-14 h-14 object-cover rounded-full" style={{ height: 'auto' }} />
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
              <SidebarMenuItem icon={<LayoutDashboard />} label="Dashboard" active={pathname === "/dashboard"} onClick={() => { handleMenuClick("/dashboard"); setShowSidebar(false); }} />
              <SidebarMenuItem icon={<Briefcase />} label="Portfolio" active={pathname === "/dashboard/portfolio"} onClick={() => { handleMenuClick("/dashboard/portfolio"); setShowSidebar(false); }} />
              <SidebarMenuItem icon={<List />} label="Transactions" active={pathname === "/dashboard/transactions"} onClick={() => { handleMenuClick("/dashboard/transactions"); setShowSidebar(false); }} />
              <SidebarMenuItem icon={<Settings />} label="Settings" active={pathname === "/dashboard/settings"} onClick={() => { handleMenuClick("/dashboard/settings"); setShowSidebar(false); }} />
              <SidebarMenuItem icon={<LogOut />} label="Logout" onClick={() => { handleLogout(); setShowSidebar(false); }} />
            </nav>
          </div>
        </div>
      )}
    </>
  );
} 