import { NextRequest, NextResponse } from 'next/server';
import { generateAIDiagnosis } from '@/lib/engine/gemini-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateAIDiagnosis(body);
    return NextResponse.json({ success: true, diagnosis: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate AI diagnosis' },
      { status: 500 }
    );
  }
}
