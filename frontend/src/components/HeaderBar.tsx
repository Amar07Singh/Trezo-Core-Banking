import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, MessageSquare, Bell, Menu, X, LogOut, LayoutGrid, ArrowLeftRight, ReceiptText, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const HeaderBar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract first name or full name
  const displayName = user?.full_name || 'Member';

  return (
    <>
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-2">
        {/* Left: Sunburst Icon & Greeting */}
        <div className="flex items-center gap-4">
          {/* Radial Sunburst SVG Logo matching reference image */}
          <div className="w-11 h-11 shrink-0 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[#2D4739]"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 12 radial rounded pills forming sunburst */}
              <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <line x1="24" y1="6" x2="24" y2="13" />
                <line x1="24" y1="35" x2="24" y2="42" />
                <line x1="6" y1="24" x2="13" y2="24" />
                <line x1="35" y1="24" x2="42" y2="24" />
                <line x1="11.27" y1="11.27" x2="16.22" y2="16.22" />
                <line x1="31.78" y1="31.78" x2="36.73" y2="36.73" />
                <line x1="11.27" y1="36.73" x2="16.22" y2="31.78" />
                <line x1="31.78" y1="16.22" x2="36.73" y2="11.27" />
                <line x1="17.1" y1="7.4" x2="19.4" y2="14.1" />
                <line x1="28.6" y1="33.9" x2="30.9" y2="40.6" />
                <line x1="7.4" y1="30.9" x2="14.1" y2="28.6" />
                <line x1="33.9" y1="19.4" x2="40.6" y2="17.1" />
              </g>
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#191A19] tracking-tight">
              Hello, {displayName}!
            </h1>
            <p className="text-xs sm:text-sm text-[#7E807A] mt-0.5">
              Explore information and activity about your banking accounts
            </p>
          </div>
        </div>

        {/* Right: Search Pill, Chat, Bell */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Search Pill */}
          <div className="bg-white rounded-full py-1.5 pl-4 pr-1.5 flex items-center gap-2 border border-[#E5E3DC] card-shadow">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-xs text-[#191A19] placeholder-[#7E807A] outline-none w-36 sm:w-56 font-normal"
            />
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-[#191A19] text-white flex items-center justify-center hover:bg-[#2D4739] transition-colors"
              title="Search"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Chat Icon with unread badge */}
          <button
            type="button"
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-[#191A19] border border-[#E5E3DC] card-shadow relative hover:bg-[#F9F8F6] transition-colors"
            title="Support Chat"
          >
            <MessageSquare className="w-4 h-4 stroke-[1.8]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#C53929] ring-2 ring-white" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-[#191A19] border border-[#E5E3DC] card-shadow hover:bg-[#F9F8F6] transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 stroke-[1.8]" />
          </button>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-11 h-11 bg-white rounded-full flex items-center justify-center text-[#191A19] border border-[#E5E3DC] card-shadow"
            title="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white rounded-3xl p-5 border border-[#E5E3DC] card-shadow mt-2 space-y-3">
          <NavLink
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F2F0E8] text-sm font-medium text-[#191A19]"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/transfers"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F2F0E8] text-sm font-medium text-[#191A19]"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transfers & Payments</span>
          </NavLink>

          <NavLink
            to="/statements"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F2F0E8] text-sm font-medium text-[#191A19]"
          >
            <ReceiptText className="w-4 h-4" />
            <span>Statements</span>
          </NavLink>

          {role === 'ADMIN' && (
            <NavLink
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F2F0E8] text-sm font-medium text-[#191A19]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Compliance & Risk Portal</span>
            </NavLink>
          )}

          <div className="pt-2 border-t border-[#E5E3DC]">
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-medium text-[#C53929] hover:bg-[#FCE8E6]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
