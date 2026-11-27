import { NextResponse } from 'next/server';
import { connection } from 'next/server';
import { getCoordinatorAccess } from '@/lib/coordinator-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  await connection();

  try {
    const { user, isCoordinator } = await getCoordinatorAccess();

    if (!user) {
      return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
    }

    if (!isCoordinator) {
      return NextResponse.json({ error: 'Coordinator access is required.' }, { status: 403 });
    }

    const { data: inquiries, error } = await supabaseAdmin
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

    if (error) throw error;

    return NextResponse.json({ inquiries: inquiries ?? [] });
  } catch (error: unknown) {
    console.error('Coordinator inquiry read failed:', error);
    return NextResponse.json({ error: 'Unable to load coordinator inquiries.' }, { status: 500 });
  }
}
