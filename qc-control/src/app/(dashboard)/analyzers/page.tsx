import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AnalyzersClient } from './analyzers-client';

async function serializeAnalyzers() {
  const analyzers = await prisma.analyzer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      calibrations: { orderBy: { calibratedAt: 'desc' } },
      maintenances: { orderBy: { performedAt: 'desc' } },
      _count: { select: { lots: true } },
    },
  });

  const allLots = await prisma.lot.findMany({ select: { id: true, analyzerId: true } });
  const lotIdsByAnalyzer = new Map<string, string[]>();
  for (const lot of allLots) {
    const ids = lotIdsByAnalyzer.get(lot.analyzerId) ?? [];
    ids.push(lot.id);
    lotIdsByAnalyzer.set(lot.analyzerId, ids);
  }

  const qcRunCounts = await prisma.qcRun.groupBy({
    by: ['lotId'],
    _count: true,
  });
  const qcRunCountByLot = new Map(qcRunCounts.map((r) => [r.lotId, r._count]));

  const openCAs = await prisma.correctiveAction.findMany({
    where: { status: 'OPEN' },
    select: { equipmentId: true },
  });
  const openCaByEquipment = new Map<string, number>();
  for (const ca of openCAs) {
    if (ca.equipmentId) {
      openCaByEquipment.set(ca.equipmentId, (openCaByEquipment.get(ca.equipmentId) ?? 0) + 1);
    }
  }

  return analyzers.map((a) => {
    const lotIds = lotIdsByAnalyzer.get(a.id) ?? [];
    const qcCount = lotIds.reduce((sum, lid) => sum + (qcRunCountByLot.get(lid) ?? 0), 0);

    return {
      id: a.id,
      analyzerId: a.analyzerId,
      model: a.model,
      manufacturer: a.manufacturer,
      serialNumber: a.serialNumber,
      location: a.location,
      installDate: a.installDate.toISOString(),
      status: a.status,
      archived: a.archived,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      calibrations: a.calibrations.map((c) => ({
        id: c.id,
        analyzerId: c.analyzerId,
        calibratedAt: c.calibratedAt.toISOString(),
        nextDueAt: c.nextDueAt.toISOString(),
        certificateNumber: c.certificateNumber,
        interval: c.interval,
        performedBy: c.performedBy,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
      })),
      maintenances: a.maintenances.map((m) => ({
        id: m.id,
        analyzerId: m.analyzerId,
        type: m.type,
        performedAt: m.performedAt.toISOString(),
        description: m.description,
        technician: m.technician,
        outcome: m.outcome,
        nextScheduledAt: m.nextScheduledAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      _count: a._count,
      qcRunCount: qcCount,
      openCaCount: openCaByEquipment.get(a.analyzerId) ?? 0,
    };
  });
}

export default async function AnalyzersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const analyzers = await serializeAnalyzers();

  return <AnalyzersClient analyzers={analyzers} />;
}
