import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#ECEAE3]">
      <div className="w-full max-w-md space-y-6">
        {/* White Card Container */}
        <div className="bg-white rounded-[36px] p-8 sm:p-10 border border-[#E5E3DC] card-shadow space-y-6">
          {/* Header with Sunburst Logo */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#FAF9F5] border border-[#E5E3DC] mx-auto flex items-center justify-center shadow-sm">
              <svg
                className="w-9 h-9 text-[#2D4739]"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                  <line x1="24" y1="6" x2="24" y2="13" />
                  <line x1="24" y1="35" x2="24" y2="42" />
                  <line x1="6" y1="24" x2="13" y2="24" />
                  <line x1="35" y1="24" x2="42" y2="24" />
                  <line x1="11.27" y1="11.27" x2="16.22" y2="16.22" />
                  <line x1="31.78" y1="31.78" x2="36.73" y2="36.73" />
                  <line x1="11.27" y1="36.73" x2="16.22" y2="31.78" />
                  <line x1="31.78" y1="16.22" x2="36.73" y2="11.27" />
                </g>
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#191A19] tracking-tight">
                Trezo Core Banking
              </h1>
              <p className="text-xs text-[#7E807A] mt-1">
                Sign in to your private digital banking portal
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-[#FCE8E6] p-3.5 flex items-start gap-2.5 text-xs text-[#D14334]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alice@example.com"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] placeholder-[#7E807A] text-xs focus:outline-none focus:border-[#5C7C68]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#191A19] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] border border-[#E5E3DC] text-[#191A19] placeholder-[#7E807A] text-xs focus:outline-none focus:border-[#5C7C68]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#5C7C68] hover:bg-[#4D6A58] text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
