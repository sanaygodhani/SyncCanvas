import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import OAuthButtons from './OAuthButtons';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);

  useEffect(() => {
    clearError();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      navigate('/channels/me');
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    // Magic link flow would be handled here
  };

  return (
    <div className="h-screen flex items-center justify-center bg-discord-dark">
      <div className="w-full max-w-md px-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blurple rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Welcome back</h1>
          <p className="text-discord-muted mt-1">Sign in to continue to SyncCanvas</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        {useMagicLink ? (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending link...' : 'Send Magic Link'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => setUseMagicLink(false)}
                className="text-blurple text-sm hover:underline"
              >
                Sign in with password instead
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2.5 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => setUseMagicLink(true)}
                className="text-blurple text-sm hover:underline"
              >
                Sign in with magic link
              </button>
            </p>
          </form>
        )}

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-discord-divider" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-discord-dark px-2 text-discord-muted">Or continue with</span>
          </div>
        </div>

        {/* OAuth */}
        <OAuthButtons />

        {/* Register link */}
        <p className="text-center mt-6 text-sm text-discord-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-blurple hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}