'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const callbackError = !hasSubmitted && searchParams.get('authError') === 'confirmation';

  const getNextPath = () => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
      return '/patient/dashboard';
    }
    return next;
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your email address to resend the confirmation link.');
      return;
    }

    setResending(true);
    setError(null);
    setNotice(null);

    try {
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', getNextPath());
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: { emailRedirectTo: callbackUrl.toString() },
      });

      if (resendError) throw resendError;
      setNotice('If an unconfirmed account exists for this address, a new confirmation email has been sent.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resend the confirmation email.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSubmitted(true);
    setError(null);
    setNotice(null);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: (() => {
              const callbackUrl = new URL('/auth/callback', window.location.origin);
              callbackUrl.searchParams.set('next', getNextPath());
              return callbackUrl.toString();
            })(),
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpErr) throw signUpErr;

        if (data.session) {
          router.replace(getNextPath());
          router.refresh();
        } else {
          setPassword('');
          setNotice('Account created. Check your email to confirm your address before signing in.');
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInErr) throw signInErr;
        router.replace(getNextPath());
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900">TourAndTreat</h1>
        <p className="text-sm text-slate-600">
          {isSignUp ? 'Create your secure medical travel account' : 'Sign in to access your audit and hospital reviews'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            {(error || (callbackError
              ? 'Email confirmation failed. Please try signing in or request a new confirmation email.'
              : null)) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {error || 'Email confirmation failed. Please try signing in or request a new confirmation email.'}
                </span>
              </div>
            )}

            {callbackError && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={loading || resending}
                className="w-full text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
              >
                {resending ? 'Sending confirmation email...' : 'Resend confirmation email'}
              </button>
            )}

            {notice && (
              <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800" role="status">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSignUp ? (
                'Create Account & Continue'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setNotice(null);
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>End-to-end encrypted clinical data management</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AuthPageContent />
    </Suspense>
  );
}