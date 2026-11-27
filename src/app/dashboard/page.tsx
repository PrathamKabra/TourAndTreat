'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import StatusUpdater from '@/components/StatusUpdater';
import { ArrowLeft, Building2, User, DollarSign, FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';

const profileSchema = z.object({
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

const hospitalSchema = z.object({
  name: z.string().nullable(),
  city: z.string().nullable(),
});

const inquirySchema = z.object({
  id: z.string(),
  status: z.string(),
  extracted_diagnosis: z.string().nullable(),
  extracted_procedure_name: z.string().nullable(),
  extracted_cpt_code: z.string().nullable(),
  us_quoted_price: z.union([z.number(), z.string(), z.null()]),
  estimated_india_package_cost: z.union([z.number(), z.string(), z.null()]),
  estimated_net_savings: z.union([z.number(), z.string(), z.null()]),
  hospital_preliminary_notes: z.string().nullable(),
  created_at: z.string(),
  profiles: z.union([profileSchema, z.array(profileSchema), z.null()]),
  hospitals: z.union([hospitalSchema, z.array(hospitalSchema), z.null()]),
});

const inquiryResponseSchema = z.object({
  inquiries: z.array(inquirySchema),
});

type InquiryRecord = z.infer<typeof inquirySchema>;

function DashboardContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setActionError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/');
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadInquiries() {
      try {
        const response = await fetch('/api/coordinator/inquiries', {
          credentials: 'same-origin',
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          const errorPayload = z.object({ error: z.string() }).safeParse(payload);
          throw new Error(
            errorPayload.success
              ? errorPayload.data.error
              : 'Unable to load coordinator inquiries.'
          );
        }

        const parsed = inquiryResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error('The coordinator service returned invalid inquiry data.');

        if (active) setInquiries(parsed.data.inquiries);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load coordinator inquiries.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInquiries();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <nav className="flex justify-between items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Triage Calculator
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {signingOut ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Signing out...
              </span>
            ) : (
              'Sign Out'
            )}
          </button>
        </nav>

        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            {actionError}
          </div>
        )}

        <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coordinator Triage Dashboard</h1>
            <p className="text-sm text-slate-500">
              Manage international medical travel leads, hospital reviews, and preliminary clinical notes.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Inquiries</span>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? '…' : error ? '—' : inquiries.length}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-sm text-slate-500" role="status">
            Loading inquiries...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            <p>{error}</p>
            <Link
              href="/auth?next=%2Fdashboard"
              className="inline-block mt-2 font-semibold underline"
            >
              Sign in with a coordinator account
            </Link>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-800">No inquiries yet</h3>
            <p className="text-sm text-slate-500">There are no inquiries assigned to the coordinator portal.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries.map((item) => {
              const patient = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
              const hospital = Array.isArray(item.hospitals) ? item.hospitals[0] : item.hospitals;

              return (
                <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {item.extracted_procedure_name || 'Elective Procedure'}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Diagnosis: {item.extracted_diagnosis || 'Clinical evaluation'}{' '}
                        {item.extracted_cpt_code && `(CPT ${item.extracted_cpt_code})`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-emerald-600 font-semibold uppercase">Net Savings</span>
                      <p className="text-xl font-bold text-emerald-600">
                        ${Number(item.estimated_net_savings ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Patient Details
                      </div>
                      <p className="text-slate-800 font-medium">{patient?.full_name || 'Patient'}</p>
                      <p className="text-slate-500">{patient?.email || 'No email'}</p>
                      {patient?.phone && <p className="text-slate-500">{patient.phone}</p>}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Assigned Hospital
                      </div>
                      <p className="text-slate-800 font-medium">{hospital?.name || 'Unassigned'}</p>
                      <p className="text-slate-500">{hospital?.city}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        Financial Overview
                      </div>
                      <p className="text-slate-600">
                        US Quoted:{' '}
                        <span className="font-semibold text-slate-800">
                          ${Number(item.us_quoted_price ?? 0).toLocaleString()}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        India Cost:{' '}
                        <span className="font-semibold text-emerald-600">
                          ${Number(item.estimated_india_package_cost ?? 0).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  <StatusUpdater
                    inquiryId={item.id}
                    currentStatus={item.status}
                    currentNotes={item.hospital_preliminary_notes || ''}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
