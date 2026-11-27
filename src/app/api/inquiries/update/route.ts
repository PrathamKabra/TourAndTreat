import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCoordinatorAccess } from '@/lib/coordinator-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const updateSchema = z.object({
  inquiryId: z.string().uuid(),
  status: z.enum([
    'pending_hospital_review',
    'opinion_received',
    'treatment_scheduled',
    'cancelled',
  ]),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid inquiry update.' }, { status: 400 });
  }

  try {
    const { user, hasAccess } = await getCoordinatorAccess();

    if (!user) {
      return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Coordinator access is required.' }, { status: 403 });
    }

    const { data: inquiry, error } = await supabaseAdmin
      .from('inquiries')
      .update({
        status: parsed.data.status,
        hospital_preliminary_notes: parsed.data.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.inquiryId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!inquiry) {
      return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Coordinator inquiry update failed:', error);
    return NextResponse.json({ error: 'Unable to update inquiry.' }, { status: 500 });
  }
}
