import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const { inquiryId, status, notes } = await req.json();

    if (!inquiryId || !status) {
      return NextResponse.json({ error: 'Missing inquiryId or status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('inquiries')
      .update({
        status,
        hospital_preliminary_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiryId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}