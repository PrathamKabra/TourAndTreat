import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: OPENAI_API_KEY is not set in .env.local.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // Ingest file bytes and convert to base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Prompt OpenAI for structured extraction
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-5.6-luna',
      response_format: { type: 'json_object' },
      temperature: 1,
      messages: [
        {
          role: 'system',
          content: `You are a medical billing auditor. Analyze the provided medical bill, surgical quote, or clinical estimate.
Extract the following fields strictly into valid JSON:
- procedure_name: Name of the surgery or medical procedure (string)
- cpt_code: 5-digit CPT code if visible (string or null)
- diagnosis: Stated diagnosis, condition, or symptoms (string)
- us_quoted_price: Total estimated or billed patient dollar cost (number or null)

Output strictly valid JSON with these keys:
{"procedure_name": string, "cpt_code": string | null, "diagnosis": string, "us_quoted_price": number | null}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the procedure, CPT code, diagnosis, and out-of-pocket price from this document.' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    });

    const parsedAi = JSON.parse(aiResponse.choices[0].message.content || '{}');

    // Match against Supabase procedure benchmarks
    let benchmark = null;

    if (parsedAi.cpt_code) {
      const { data } = await supabase
        .from('procedure_benchmarks')
        .select('*')
        .contains('cpt_codes', [parsedAi.cpt_code])
        .maybeSingle();
      benchmark = data;
    }

    if (!benchmark && parsedAi.procedure_name) {
      const firstWord = parsedAi.procedure_name.trim().split(' ')[0];
      const { data } = await supabase
        .from('procedure_benchmarks')
        .select('*')
        .ilike('name', `%${firstWord}%`)
        .limit(1)
        .maybeSingle();
      benchmark = data;
    }

    // Default fallback to first benchmark if no specific match
    if (!benchmark) {
      const { data } = await supabase
        .from('procedure_benchmarks')
        .select('*')
        .limit(1)
        .single();
      benchmark = data;
    }

    if (!benchmark) {
      return NextResponse.json(
        { error: 'No procedure benchmarks found in database. Please run the seed SQL.' },
        { status: 500 }
      );
    }

    const usCost = parsedAi.us_quoted_price || Number(benchmark.us_average_cost);
    const indiaHospitalCost = Number(benchmark.india_package_cost);

    // Logistics calculation
    const hotelCost = benchmark.hotel_recuperation_days * 65;
    const flightsCost = 2200;
    const visaCost = 160;
    const localTransit = 300;
    const estimatedTravelCost = hotelCost + flightsCost + visaCost + localTransit;

    const totalIndiaTripCost = indiaHospitalCost + estimatedTravelCost;
    const netSavings = Math.max(0, usCost - totalIndiaTripCost);
    const savingsPercentage = Math.round((netSavings / usCost) * 100);

    return NextResponse.json({
      extraction: parsedAi,
      benchmark,
      financials: {
        us_quoted_cost: usCost,
        india_hospital_package: indiaHospitalCost,
        breakdown: {
          hospital_stay_days: benchmark.hospital_stay_days,
          hotel_recuperation_days: benchmark.hotel_recuperation_days,
          flights_cost: flightsCost,
          hotel_cost: hotelCost,
          visas_and_logistics: visaCost + localTransit,
          total_travel_cost: estimatedTravelCost,
        },
        total_india_trip_cost: totalIndiaTripCost,
        net_savings: netSavings,
        savings_percentage: savingsPercentage,
      }
    });

  } catch (err: unknown) {
    console.error('API Error in /api/triage/analyze:', err);
    return NextResponse.json(
      {
        error: err instanceof Error
          ? err.message
          : 'An unexpected error occurred during processing.',
      },
      { status: 500 }
    );
  }
}