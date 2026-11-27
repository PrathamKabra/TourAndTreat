import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const inquirySchema = z.object({
  hospitalId: z.string().uuid(),
  benchmarkId: z.string().uuid(),
  phone: z.string().trim().max(40).optional().nullable(),
  extraction: z.object({
    diagnosis: z.string().nullable().optional(),
    procedure_name: z.string().nullable().optional(),
    cpt_code: z.string().nullable().optional(),
    us_quoted_price: z.number().finite().nonnegative().nullable().optional(),
  }),
  financials: z.object({
    us_quoted_cost: z.number().finite().nonnegative(),
    india_hospital_package: z.number().finite().nonnegative(),
    net_savings: z.number().finite().nonnegative(),
    breakdown: z.object({
      total_travel_cost: z.number().finite().nonnegative(),
    }),
  }),
  consentAgreed: z.literal(true),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid inquiry details or consent.' }, { status: 400 });
  }

  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Sign in is required to submit an inquiry.' }, { status: 401 });
    }

    const { hospitalId, benchmarkId, phone, extraction, financials } = parsed.data;
    const [hospitalResult, benchmarkResult] = await Promise.all([
      supabaseAdmin.from('hospitals').select('id').eq('id', hospitalId).maybeSingle(),
      supabaseAdmin.from('procedure_benchmarks').select('id').eq('id', benchmarkId).maybeSingle(),
    ]);

    if (hospitalResult.error || benchmarkResult.error) {
      throw new Error('Unable to verify the selected hospital or procedure benchmark.');
    }

    if (!hospitalResult.data || !benchmarkResult.data) {
      return NextResponse.json(
        { error: 'The selected hospital or procedure benchmark is invalid.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileLookupError) {
      throw new Error(`Profile lookup failed: ${profileLookupError.message}`);
    }

    if (!profile) {
      const fullName =
        typeof user.user_metadata.full_name === 'string'
          ? user.user_metadata.full_name
          : user.email.split('@')[0];
      const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        phone: phone || null,
        role: 'patient',
      });

      if (profileInsertError) {
        throw new Error(`Profile creation failed: ${profileInsertError.message}`);
      }
    }

    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .insert({
        patient_id: user.id,
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

    if (inquiryError) {
      throw new Error(`Inquiry creation failed: ${inquiryError.message}`);
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const { error: consentError } = await supabaseAdmin.from('consent_logs').insert({
      inquiry_id: inquiry.id,
      patient_id: user.id,
      consent_version: 'v1.0-cross-border',
      ip_address: ipAddress,
      user_agent: userAgent,
      consent_text_snapshot:
        'I authorize TourAndTreat to transmit my clinical summary and procedure details to accredited Indian hospital international desks for medical travel evaluation under the DPDP Act and FTC guidelines.',
    });

    if (consentError) {
      throw new Error(`Consent logging failed: ${consentError.message}`);
    }

    return NextResponse.json({ success: true, inquiryId: inquiry.id });
  } catch (err: unknown) {
    console.error('Inquiry error:', err);
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
