import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      email,
      fullName,
      phone,
      hospitalId,
      benchmarkId,
      extraction,
      financials,
      consentAgreed,
    } = body;

    if (!patientId || !hospitalId || !consentAgreed) {
      return NextResponse.json(
        { error: 'Missing authenticated user ID, hospital selection, or consent.' },
        { status: 400 }
      );
    }

    // Ensure profile row exists for this authenticated user ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', patientId)
      .maybeSingle();

    if (!profile) {
      await supabaseAdmin.from('profiles').insert({
        id: patientId,
        email: email || 'patient@tourandtreat.com',
        full_name: fullName || 'Patient',
        phone: phone || null,
        role: 'patient',
      });
    }

    // Insert inquiry record
    const { data: inquiry, error: inquiryErr } = await supabaseAdmin
      .from('inquiries')
      .insert({
        patient_id: patientId,
        procedure_benchmark_id: benchmarkId,
        hospital_id: hospitalId,
        status: 'pending_hospital_review',
        extracted_diagnosis: extraction?.diagnosis || 'Clinical evaluation',
        extracted_procedure_name: extraction?.procedure_name || null,
        extracted_cpt_code: extraction?.cpt_code || null,
        us_quoted_price: financials?.us_quoted_cost || null,
        estimated_india_package_cost: financials?.india_hospital_package || null,
        estimated_travel_cost: financials?.breakdown?.total_travel_cost || null,
        estimated_net_savings: financials?.net_savings || null,
      })
      .select('id')
      .single();

    if (inquiryErr) {
      throw new Error(`Inquiry creation failed: ${inquiryErr.message}`);
    }

    // Record immutable regulatory consent audit log
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await supabaseAdmin.from('consent_logs').insert({
      inquiry_id: inquiry.id,
      patient_id: patientId,
      consent_version: 'v1.0-cross-border',
      ip_address: ipAddress,
      user_agent: userAgent,
      consent_text_snapshot:
        'I authorize TourAndTreat to transmit my clinical summary and procedure details to accredited Indian hospital international desks for medical travel evaluation under the DPDP Act and FTC guidelines.',
    });

    return NextResponse.json({
      success: true,
      inquiryId: inquiry.id,
    });
  } catch (err: any) {
    console.error('Inquiry error:', err);
    return NextResponse.json({ error: err.message || 'Submission failed' }, { status: 500 });
  }
}