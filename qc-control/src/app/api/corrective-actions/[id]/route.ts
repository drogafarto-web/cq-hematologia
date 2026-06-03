import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateCASchema } from '@/lib/validators';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Corrective action not found' } },
      { status: 404 },
    );

  const body = await req.json();
  const parsed = updateCASchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    );

  const data: Record<string, unknown> = {};
  if (parsed.data.rootCause !== undefined) data.rootCause = parsed.data.rootCause;
  if (parsed.data.supportingEvidence !== undefined)
    data.supportingEvidence = parsed.data.supportingEvidence;
  if (parsed.data.actionTaken !== undefined) data.actionTaken = parsed.data.actionTaken;
  if (parsed.data.preventiveMeasure !== undefined)
    data.preventiveMeasure = parsed.data.preventiveMeasure;
  if (parsed.data.effectivenessCheck !== undefined)
    data.effectivenessCheck = parsed.data.effectivenessCheck;
  if (parsed.data.verifiedById !== undefined) data.verifiedById = parsed.data.verifiedById;
  if (parsed.data.verificationAt !== undefined)
    data.verificationAt = new Date(parsed.data.verificationAt);

  const updated = await prisma.correctiveAction.update({
    where: { id },
    data,
    include: {
      operator: { select: { id: true, name: true } },
      investigator: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      lot: { select: { id: true, lotNumber: true, analyte: true } },
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
