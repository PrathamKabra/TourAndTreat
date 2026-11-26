import { supabase } from '@/lib/supabase';
import { cacheLife } from 'next/cache';
import TriageUploader from '@/components/TriageUploader';

interface ProcedureBenchmark {
  id: string;
  name: string;
  category: string;
  us_average_cost: number;
  india_package_cost: number;
  hospital_stay_days: number;
  hotel_recuperation_days: number;
}

interface Hospital {
  id: string;
  name: string;
  city: string;
  rating: number;
  accreditations: string[];
}

async function getHomeData() {
  'use cache';
  cacheLife('hours');

  const [proceduresRes, hospitalsRes] = await Promise.all([
    supabase.from('procedure_benchmarks').select('*').order('name'),
    supabase.from('hospitals').select('*').order('rating', { ascending: false }).limit(6),
  ]);

  const procedures: ProcedureBenchmark[] = proceduresRes.data || [];
  const hospitals: Hospital[] = hospitalsRes.data || [];
  return { procedures, hospitals };
}

export default async function Home() {
  const { procedures, hospitals } = await getHomeData();

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            TourAndTreat Triage Engine
          </h1>
          <p className="text-slate-600">
            US elective surgery cost vs. Indian JCI hospital package benchmarks.
          </p>
        </header>

        <section>
          <TriageUploader />
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Procedure Benchmarks ({procedures.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {procedures.map((proc) => {
              const savings = proc.us_average_cost - proc.india_package_cost;
              const savingsPct = Math.round((savings / proc.us_average_cost) * 100);
              return (
                <div key={proc.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-900">{proc.name}</h3>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-medium">
                      Save {savingsPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{proc.category}</p>
                  <div className="pt-2 flex justify-between text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">US Average</p>
                      <p className="font-medium text-slate-700">${Number(proc.us_average_cost).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">India Package</p>
                      <p className="font-semibold text-emerald-600">${Number(proc.india_package_cost).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Recuperation</p>
                      <p className="font-medium text-slate-700">{proc.hospital_stay_days + proc.hotel_recuperation_days} days</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Featured Partner Hospitals ({hospitals.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hospitals.map((hosp) => (
              <div key={hosp.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-1">
                <h3 className="font-medium text-slate-900 text-sm">{hosp.name}</h3>
                <p className="text-xs text-slate-500">{hosp.city}</p>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-amber-600 font-semibold">{hosp.rating} / 5.0</span>
                  <div className="flex gap-1">
                    {hosp.accreditations.map((acc) => (
                      <span key={acc} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}