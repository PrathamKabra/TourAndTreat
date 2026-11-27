'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-browser';
import { Upload, AlertCircle, Loader2, CheckCircle2, Building2, ShieldCheck, Lock } from 'lucide-react';
import { z } from 'zod';

interface HospitalOption {
  id: string;
  name: string;
  city: string;
  rating: number;
}

const triageResultSchema = z.object({
  benchmark: z.object({
    id: z.string(),
    name: z.string(),
  }),
  extraction: z.object({
    diagnosis: z.string().nullable().optional(),
    procedure_name: z.string().nullable().optional(),
    cpt_code: z.string().nullable().optional(),
    us_quoted_price: z.number().nullable().optional(),
  }),
  financials: z.object({
    net_savings: z.number().finite(),
    savings_percentage: z.number().finite(),
    us_quoted_cost: z.number().finite(),
    total_india_trip_cost: z.number().finite(),
    india_hospital_package: z.number().finite(),
    breakdown: z.object({
      flights_cost: z.number().finite(),
      hotel_recuperation_days: z.number().finite(),
      hotel_cost: z.number().finite(),
      visas_and_logistics: z.number().finite(),
      total_travel_cost: z.number().finite(),
    }),
  }),
});

type TriageResult = z.infer<typeof triageResultSchema>;

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Unexpected server response (${response.status}): ${text.slice(0, 150)}`);
  }
  return response.json();
}

function getApiError(value: unknown, fallback: string) {
  if (typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string') {
    return value.error;
  }
  return fallback;
}

export default function TriageUploader() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSession(session);
    });

    async function loadFormData() {
      try {
        const [
          { data: { session: currentSession }, error: sessionError },
          { data, error: hospitalsError },
        ] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('hospitals').select('id, name, city, rating').order('rating', { ascending: false }),
        ]);

        if (sessionError) throw sessionError;
        if (hospitalsError) throw hospitalsError;
        if (!active) return;

        setSession(currentSession);
        setHospitals(data ?? []);
        setSelectedHospital(data?.[0]?.id ?? '');
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the inquiry form.');
      }
    }

    void loadFormData();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSubmitSuccess(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/triage/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(getApiError(data, 'Extraction failed'));

      const parsed = triageResultSchema.safeParse(data);
      if (!parsed.success) throw new Error('The analysis service returned an invalid response.');
      setResult(parsed.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      router.push('/auth');
      return;
    }
    if (!selectedHospital || !consentAgreed || !result) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/inquiries/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          hospitalId: selectedHospital,
          benchmarkId: result.benchmark.id,
          extraction: result.extraction,
          financials: result.financials,
          consentAgreed,
        }),
      });

      const data = await readJsonResponse(res);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/auth?next=${encodeURIComponent('/')}`);
          return;
        }
        throw new Error(getApiError(data, 'Failed to submit inquiry'));
      }
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Upload Your US Medical Estimate or Bill</h2>
        <p className="text-sm text-slate-500">
          Upload an image of your surgical estimate or billing order. Our AI extracts procedure details and matches them against JCI-accredited Indian hospital packages.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
          />
          <p className="text-xs text-slate-400 mt-2">Supports JPG or PNG format</p>
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Parsing Bill and Computing Travel Savings...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Run Cross-Border Savings Audit
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          {/* Sign-in Gate if user is not authenticated */}
          {!session ? (
            <div className="p-6 bg-slate-900 text-white rounded-xl space-y-4 text-center">
              <Lock className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Your Savings Analysis is Ready</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  We identified your procedure and computed comparative travel benchmarks across 15 JCI hospital centers. Create a free account or sign in to unlock your audit and request hospital opinions.
                </p>
              </div>
              <button
                onClick={() => router.push(`/auth?next=${encodeURIComponent('/')}`)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-semibold text-xs text-white rounded-lg transition"
              >
                Sign In / Sign Up to Unlock Audit
              </button>
            </div>
          ) : (
            <>
              {/* Authenticated Audit View */}
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Matched Procedure</span>
                    <h3 className="text-lg font-bold text-slate-900">{result.benchmark.name}</h3>
                    <p className="text-xs text-slate-600">Diagnosis: {result.extraction.diagnosis || 'Clinical evaluation'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold uppercase text-emerald-600 tracking-wider">Estimated Net Savings</span>
                    <p className="text-2xl font-black text-emerald-600">${result.financials.net_savings.toLocaleString()}</p>
                    <p className="text-xs font-medium text-emerald-700">{result.financials.savings_percentage}% lower than US estimate</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-white rounded border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-slate-400">US Out-of-Pocket Cost</h4>
                    <p className="text-xl font-bold text-slate-800">${result.financials.us_quoted_cost.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Extracted from bill or standard US cash benchmark.</p>
                  </div>

                  <div className="p-4 bg-white rounded border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-emerald-700">Total India All-Inclusive Cost</h4>
                    <p className="text-xl font-bold text-emerald-600">${result.financials.total_india_trip_cost.toLocaleString()}</p>
                    <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span>Hospital package:</span>
                        <span className="font-medium">${result.financials.india_hospital_package.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Flights (2 persons):</span>
                        <span className="font-medium">${result.financials.breakdown.flights_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hotel ({result.financials.breakdown.hotel_recuperation_days} nights):</span>
                        <span className="font-medium">${result.financials.breakdown.hotel_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Visas and transit:</span>
                        <span className="font-medium">${result.financials.breakdown.visas_and_logistics.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {submitSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <h3 className="font-bold text-lg">Inquiry Dispatched Successfully</h3>
                  </div>
                  <p className="text-sm text-emerald-800">
                    Your inquiry has been delivered to the International Patient Department. You can track its status in your patient dashboard.
                  </p>
                  <button
                    onClick={() => router.push('/patient/dashboard')}
                    className="mt-2 px-4 py-2 bg-emerald-700 text-white rounded text-xs font-semibold"
                  >
                    View in Patient Dashboard
                  </button>
                </div>
              ) : (
                <div className="p-6 bg-white border border-slate-200 rounded-lg space-y-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-slate-700" />
                    <h3 className="text-lg font-bold text-slate-900">Request Official Hospital Second Opinion</h3>
                  </div>

                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Select Target JCI Hospital Campus
                      </label>
                      <select
                        value={selectedHospital}
                        onChange={(e) => setSelectedHospital(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                        required
                      >
                        {hospitals.map((hosp) => (
                          <option key={hosp.id} value={hosp.id}>
                            {hosp.name} ({hosp.city}) | Rating: {hosp.rating}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Phone Number for Hospital Case Coordinator
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          required
                        />
                        <span className="text-xs text-slate-600 leading-relaxed">
                          <ShieldCheck className="w-4 h-4 inline mr-1 text-emerald-600" />
                          I authorize TourAndTreat to transmit my clinical summary and procedure details to accredited Indian hospital international desks for medical travel evaluation under the DPDP Act and FTC guidelines.
                        </span>
                      </label>
                    </div>

                    {submitError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {submitError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !consentAgreed}
                      className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting to Hospital Desk...
                        </>
                      ) : (
                        'Dispatch Dossier for Preliminary Review'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}