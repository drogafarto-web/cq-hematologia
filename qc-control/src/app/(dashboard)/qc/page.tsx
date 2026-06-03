import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { QcControlClient } from './qc-control-client';

export default async function QcPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const rawLots = await prisma.lot.findMany({
    where: { status: 'ACTIVE' },
    include: { analyzer: { select: { id: true, analyzerId: true, model: true } } },
    orderBy: { lotNumber: 'asc' },
  });

  const lots = rawLots.map((l) => ({
    id: l.id,
    lotNumber: l.lotNumber,
    analyte: l.analyte,
    level: l.level,
    reagentName: l.reagentName,
    analyzerId: l.analyzerId,
    targetMean: Number(l.targetMean),
    sd: Number(l.sd),
    minAcceptance: Number(l.minAcceptance),
    maxAcceptance: Number(l.maxAcceptance),
    status: l.status,
    analyzer: l.analyzer,
  }));

  return <QcControlClient lots={lots} />;
}
