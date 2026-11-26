import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      email,
      phone,
      hospitalId,
      benchmarkId,
      extraction,
      financials,
      consentAgreed,
    } = body;

    if (!email || !fullName || !hospitalId || !consentAgreed) {
      return NextResponse.json(
        { error: 'Missing required patient details, hospital selection, or legal consent.' },
        { status: 400 }
      );
    }

    // Capture audit metadata for regulatory compliance (DPDP Act / FTC rules)
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const consentSnapshot = 'I authorize TourAndTreat to transmit my clinical summary, diagnosis, and procedure details to JCI-accredited hospitals in India for medical travel feasibility and cost estimation under the DPDP Act and FTC Health guidelines.';

    // Check if a profile exists for this email or create an inquiry guest profile
    let patientId: string;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      patientId = existingProfile.id;
    } else {
      const newId = crypto.randomUUID();
      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: newId,
          email,
          full_name: fullName,
          phone: phone || null,
          role: 'patient',
        })
        .select('id')
        .single();

      if (profileErr) {
        throw new Error(`Profile creation failed: ${profileErr.message}`);
      }
      patientId = newProfile.id;
    }

    // Insert the inquiry record
    const { data: inquiry, error: inquiryErr } = await supabase
      .from('inquiries')
      .insert({
        patient_id: patientId,
        procedure_benchmark_id: benchmarkId,
        hospital_id: hospitalId,
        status: 'pending_hospital_review',
        extracted_diagnosis: extraction.diagnosis || 'Clinical evaluation',
        extracted_procedure_name: extraction.procedure_name || null,
        extracted_cpt_code: extraction.cpt_code || null,
        us_quoted_price: financials.us_quoted_cost,
        estimated_india_package_cost: financials.india_hospital_package,
        estimated_travel_cost: financials.breakdown.total_travel_cost,
        estimated_net_savings: financials.net_savings,
      })
      .select('id')
      .single();

    if (inquiryErr) {
      throw new Error(`Inquiry creation failed: ${inquiryErr.message}`);
    }

    // Record immutable regulatory consent audit log
    const { error: consentErr } = await supabase
      .from('consent_logs')
      .insert({
        inquiry_id: inquiry.id,
        patient_id: patientId,
        consent_version: 'v1.0-cross-border',
        ip_address: ipAddress,
        user_agent: userAgent,
        consent_text_snapshot: consentSnapshot,
      });

    if (consentErr) {
      console.error('Consent logging warning:', consentErr.message);
    }

    return NextResponse.json({
      success: true,
      inquiryId: inquiry.id,
      message: 'Your inquiry and clinical summary have been dispatched for preliminary hospital review.',
    });

  } catch (err: any) {
    console.error('Inquiry submission error:', err);
    return NextResponse.json({ error: err.message || 'Submission failed' }, { status: 500 });
  }
}