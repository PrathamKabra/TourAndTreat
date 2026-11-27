'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Building2, Calendar, FileText, ArrowLeft, Loader2 } from 'lucide-react';

export default function PatientDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);

      const { data, error } = await supabase
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
        .eq('patient_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) setInquiries(data);
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
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
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Sign Out
          </button>
        </div>

        <header className="bg-white p-6 rounded-xl border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Patient Treatment Portal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as {user?.email} • Track your hospital feasibility reviews and treatment plans.
          </p>
        </header>

        {inquiries.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-800">No active inquiries</h3>
            <p className="text-xs text-slate-500">
              Run an audit on the home page and submit a hospital review request to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries.map((inq) => {
              const hospital = Array.isArray(inq.hospitals) ? inq.hospitals[0] : inq.hospitals;

              return (
                <div key={inq.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                        {inq.status.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {inq.extracted_procedure_name || 'Elective Procedure'}
                      </h3>
                      <p className="text-xs text-slate-500">Diagnosis: {inq.extracted_diagnosis}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-emerald-600 font-semibold uppercase">Net Savings</span>
                      <p className="text-xl font-bold text-emerald-600">
                        ${Number(inq.estimated_net_savings).toLocaleString()}
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
                        ${Number(inq.estimated_india_package_cost).toLocaleString()}
                      </p>
                      <p className="text-slate-400 text-[11px]">Includes surgery, stay, and companion flights</p>
                    </div>
                  </div>

                  {inq.hospital_preliminary_notes && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                      <span className="font-semibold text-amber-900">Hospital Preliminary Feedback:</span>
                      <p className="text-amber-800">{inq.hospital_preliminary_notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}