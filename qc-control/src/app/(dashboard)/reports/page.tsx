import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const reports = await prisma.report.findMany({
    orderBy: { generatedAt: 'desc' },
    take: 50,
    include: { generatedBy: { select: { name: true } } },
  });

  const serialized = reports.map((r) => ({
    ...r,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    generatedAt: r.generatedAt.toISOString(),
    scope: (r.scope ?? {}) as Record<string, unknown>,
  }));

  return <ReportsClient reports={serialized} />;
}
