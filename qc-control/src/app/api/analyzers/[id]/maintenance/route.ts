import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { maintenanceAnalyzerSchema } from '@/lib/validators';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;

  const analyzer = await prisma.analyzer.findUnique({ where: { id } });
  if (!analyzer)
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Analyzer not found' } },
      { status: 404 },
    );

  const body = await req.json();
  const parsed = maintenanceAnalyzerSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    );

  const maintenance = await prisma.maintenance.create({
    data: {
      analyzerId: id,
      type: parsed.data.type,
      performedAt: new Date(parsed.data.performedAt),
      description: parsed.data.description,
      technician: parsed.data.technician,
      outcome: parsed.data.outcome,
      nextScheduledAt: parsed.data.nextScheduledAt
        ? new Date(parsed.data.nextScheduledAt)
        : undefined,
    },
  });

  return NextResponse.json({ success: true, data: maintenance }, { status: 201 });
}
