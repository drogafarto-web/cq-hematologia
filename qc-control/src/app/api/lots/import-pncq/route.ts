import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const mockPncqData: Record<
  string,
  { targetMean: number; sd: number; minAcceptance: number; maxAcceptance: number }
> = {
  TP: { targetMean: 12.5, sd: 0.8, minAcceptance: 9.5, maxAcceptance: 15.5 },
  INR: { targetMean: 1.0, sd: 0.1, minAcceptance: 0.8, maxAcceptance: 1.2 },
  TTPA: { targetMean: 30.0, sd: 2.5, minAcceptance: 22.0, maxAcceptance: 38.0 },
  Fibrinogen: { targetMean: 250, sd: 25, minAcceptance: 180, maxAcceptance: 320 },
  'D-Dimer': { targetMean: 0.5, sd: 0.1, minAcceptance: 0.2, maxAcceptance: 0.8 },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json();
  const analyte = body.analyte as string;

  if (!analyte)
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'analyte is required' } },
      { status: 400 },
    );

  const data = mockPncqData[analyte];
  if (!data)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: `No PNCQ data for analyte: ${analyte}` },
      },
      { status: 404 },
    );

  return NextResponse.json({
    success: true,
    data: {
      source: 'PNCQ',
      analyte,
      ...data,
      importedAt: new Date().toISOString(),
    },
  });
}
