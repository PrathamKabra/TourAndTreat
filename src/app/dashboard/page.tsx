import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import StatusUpdater from '@/components/StatusUpdater';
import { Building2, User, DollarSign, FileText } from 'lucide-react';

interface InquiryRecord {
  id: string;
  status: string;
  extracted_diagnosis: string;
  extracted_procedure_name: string;
  extracted_cpt_code: string;
  us_quoted_price: number;
  estimated_india_package_cost: number;
  estimated_net_savings: number;
  hospital_preliminary_notes: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string;
  }[] | {
    full_name: string;
    email: string;
    phone: string;
  } | null;
  hospitals: {
    name: string;
    city: string;
  }[] | {
    name: string;
    city: string;
  } | null;
}

async function DashboardContent() {
  const { data: inquiries, error } = await supabase
    .from('inquiries')
    .select(`
      id,
      status,
      extracted_diagnosis,
      extracted_procedure_name,
      extracted_cpt_code,
      us_quoted_price,
      estimated_india_package_cost,
      estimated_net_savings,
      hospital_preliminary_notes,
      created_at,
      profiles (full_name, email, phone),
      hospitals (name, city)
    `)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coordinator Triage Dashboard</h1>
            <p className="text-sm text-slate-500">
              Manage international medical travel leads, hospital reviews, and preliminary clinical notes.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Inquiries</span>
            <p className="text-2xl font-bold text-slate-800">{inquiries?.length || 0}</p>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Error fetching inquiries: {error.message}
          </div>
        )}

        {inquiries && inquiries.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-800">No inquiries yet</h3>
            <p className="text-sm text-slate-500">
              Submit a test inquiry through the home page uploader to see it populate here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries?.map((item: InquiryRecord) => {
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
                        Diagnosis: {item.extracted_diagnosis} {item.extracted_cpt_code && `(CPT ${item.extracted_cpt_code})`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-emerald-600 font-semibold uppercase">Net Savings</span>
                      <p className="text-xl font-bold text-emerald-600">
                        ${Number(item.estimated_net_savings).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Patient Details
                      </div>
                      <p className="text-slate-800 font-medium">{patient?.full_name || 'Guest User'}</p>
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
                        US Quoted: <span className="font-semibold text-slate-800">${Number(item.us_quoted_price).toLocaleString()}</span>
                      </p>
                      <p className="text-slate-600">
                        India Cost: <span className="font-semibold text-emerald-600">${Number(item.estimated_india_package_cost).toLocaleString()}</span>
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

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coordinator Triage Dashboard</h1>
            <p className="text-sm text-slate-500">
              Manage international medical travel leads, hospital reviews, and preliminary clinical notes.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold uppercase text-slate-400">Total Inquiries</span>
            <p className="text-2xl font-bold text-slate-800">…</p>
          </div>
        </header>
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-sm text-slate-500" role="status">
          Loading inquiries...
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}