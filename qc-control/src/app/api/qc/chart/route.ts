import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { qcChartQuerySchema } from '@/lib/validators';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lotId = searchParams.get('lotId');
  const days = parseInt(searchParams.get('days') || '30');

  const parsed = qcChartQuerySchema.safeParse({ lotId, days });
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    );

  const lot = await prisma.lot.findUnique({ where: { id: parsed.data.lotId } });
  if (!lot)
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Lot not found' } },
      { status: 404 },
    );

  const since = new Date();
  since.setDate(since.getDate() - parsed.data.days);

  const runs = await prisma.qcRun.findMany({
    where: { lotId: lot.id, runAt: { gte: since } },
    orderBy: { runAt: 'asc' },
    select: { value: true, runAt: true },
  });

  const mean = Number(lot.targetMean);
  const sd = Number(lot.sd);

  const referenceLines = {
    mean,
    plus1Sd: mean + sd,
    minus1Sd: mean - sd,
    plus2Sd: mean + 2 * sd,
    minus2Sd: mean - 2 * sd,
    plus3Sd: mean + 3 * sd,
    minus3Sd: mean - 3 * sd,
  };

  const dataPoints = runs.map((r) => ({
    value: Number(r.value),
    runAt: r.runAt.toISOString(),
  }));

  return NextResponse.json({ success: true, data: { referenceLines, dataPoints } });
}
