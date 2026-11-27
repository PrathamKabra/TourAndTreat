'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-browser';
import { Building2, FileText, ArrowLeft, Loader2 } from 'lucide-react';

interface PatientInquiry {
  id: string;
  status: string;
  extracted_procedure_name: string | null;
  extracted_diagnosis: string | null;
  estimated_net_savings: number | null;
  estimated_india_package_cost: number | null;
  hospital_preliminary_notes: string | null;
  created_at: string;
  hospitals: { name: string; city: string } | { name: string; city: string }[] | null;
}

export default function PatientDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [inquiries, setInquiries] = useState<PatientInquiry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();

        if (!active) return;
        if (authError || !authenticatedUser) {
          router.replace('/auth');
          return;
        }

        setUser(authenticatedUser);

        const { data, error: inquiryError } = await supabase
          .from('inquiries')
          .select(`
            id,
            status,
            extracted_procedure_name,
            extracted_diagnosis,
            estimated_net_savings,
            estimated_india_package_cost,
            hospital_preliminary_notes,
            created_at,
            hospitals (name, city)
          `)
          .eq('patient_id', authenticatedUser.id)
          .order('created_at', { ascending: false });

        if (inquiryError) throw inquiryError;
        if (active) setInquiries(data ?? []);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load your inquiries.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" aria-label="Loading dashboard" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Triage Calculator
          </button>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>

        <header className="bg-white p-6 rounded-xl border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Patient Treatment Portal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as {user?.email ?? 'your account'} · Track your hospital feasibility reviews and treatment plans.
          </p>
        </header>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            <p>Unable to load or update your account: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {!error && inquiries.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="font-semibold text-slate-800">No active inquiries</h2>
            <p className="text-xs text-slate-500">
              Run an audit on the home page and submit a hospital review request to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries.map((inquiry) => {
              const hospital = Array.isArray(inquiry.hospitals)
                ? inquiry.hospitals[0]
                : inquiry.hospitals;

              return (
                <article key={inquiry.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                        {inquiry.status.replace(/_/g, ' ')}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 mt-1">
                        {inquiry.extracted_procedure_name || 'Elective Procedure'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Diagnosis: {inquiry.extracted_diagnosis || 'Clinical evaluation'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-emerald-600 font-semibold uppercase">Net Savings</span>
                      <p className="text-xl font-bold text-emerald-600">
                        ${Number(inquiry.estimated_net_savings ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Target JCI Hospital
                      </div>
                      <p className="font-medium text-slate-900">{hospital?.name || 'Assigned Center'}</p>
                      <p className="text-slate-500">{hospital?.city}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="font-semibold text-slate-700">All-Inclusive Package Estimate</div>
                      <p className="font-bold text-emerald-600 text-base">
                        ${Number(inquiry.estimated_india_package_cost ?? 0).toLocaleString()}
                      </p>
                      <p className="text-slate-400 text-[11px]">Includes surgery, stay, and companion flights</p>
                    </div>
                  </div>

                  {inquiry.hospital_preliminary_notes && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                      <span className="font-semibold text-amber-900">Hospital Preliminary Feedback:</span>
                      <p className="text-amber-800">{inquiry.hospital_preliminary_notes}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
