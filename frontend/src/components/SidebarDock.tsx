import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutGrid,
  CreditCard,
  ArrowLeftRight,
  ReceiptText,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react';

export const SidebarDock: React.FC = () => {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-12 h-12 rounded-[20px] flex items-center justify-center transition-all duration-200 ${
      isActive
        ? 'bg-[#191A19] text-white shadow-sm'
        : 'text-[#7E807A] hover:text-[#191A19] hover:bg-[#F2F0E8]'
    }`;

  // Fallback initial letter
  const userInitial = user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';

  return (
    <aside className="fixed left-6 top-6 bottom-6 z-40 hidden md:flex flex-col items-center justify-between w-[72px] bg-white rounded-[36px] py-6 px-3 border border-[#E5E3DC] dock-shadow">
      {/* Top Section / Primary Navigation */}
      <div className="flex flex-col items-center gap-4">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          className={navLinkClass}
          title="Dashboard"
        >
          <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
        </NavLink>

        {/* Transfers */}
        <NavLink
          to="/transfers"
          className={navLinkClass}
          title="Send Money & Transfers"
        >
          <ArrowLeftRight className="w-5 h-5 stroke-[2]" />
        </NavLink>

        {/* Cards / Wallet view shortcut */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-12 h-12 rounded-[20px] flex items-center justify-center text-[#7E807A] hover:text-[#191A19] hover:bg-[#F2F0E8] transition-all duration-200"
          title="Cards & Wallet"
        >
          <CreditCard className="w-5 h-5 stroke-[2]" />
        </button>

        {/* Statements */}
        <NavLink
          to="/statements"
          className={navLinkClass}
          title="Statements & Ledger"
        >
          <ReceiptText className="w-5 h-5 stroke-[2]" />
        </NavLink>

        {/* Admin Portal (only if ADMIN) */}
        {role === 'ADMIN' && (
          <NavLink
            to="/admin"
            className={navLinkClass}
            title="Compliance & Risk Portal"
          >
            <ShieldCheck className="w-5 h-5 stroke-[2]" />
          </NavLink>
        )}
      </div>

      {/* Bottom Section: Settings, Logout, Avatar */}
      <div className="flex flex-col items-center gap-3">
        {/* Settings button */}
        <button
          type="button"
          title="Settings"
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#7E807A] hover:text-[#191A19] hover:bg-[#F2F0E8] transition-colors"
        >
          <Settings className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Logout button */}
        <button
          type="button"
          onClick={handleLogout}
          title="Sign Out"
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#7E807A] hover:text-[#C53929] hover:bg-[#FCE8E6] transition-colors"
        >
          <LogOut className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* User Circular Avatar */}
        <div
          title={`${user?.full_name} (${user?.email})`}
          className="w-11 h-11 rounded-full bg-[#2D4739] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white cursor-pointer mt-1"
        >
          {userInitial}
        </div>
      </div>
    </aside>
  );
};
