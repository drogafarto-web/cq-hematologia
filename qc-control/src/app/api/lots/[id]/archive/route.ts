import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;

  const lot = await prisma.lot.findUnique({ where: { id } });
  if (!lot)
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Lot not found' } },
      { status: 404 },
    );
  if (lot.status === 'ARCHIVED')
    return NextResponse.json(
      { success: false, error: { code: 'ALREADY_ARCHIVED', message: 'Lot is already archived' } },
      { status: 409 },
    );

  const updated = await prisma.lot.update({
    where: { id },
    data: { status: 'ARCHIVED', archivedAt: new Date(), archivedById: session.user.id },
    include: { analyzer: { select: { id: true, analyzerId: true, model: true } } },
  });

  return NextResponse.json({ success: true, data: updated });
}
