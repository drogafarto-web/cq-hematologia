import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import LotsClient from './lots-client';

export default async function LotsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: 'desc' },
    include: { analyzer: { select: { analyzerId: true, model: true } } },
  });

  const analyzers = await prisma.analyzer.findMany({
    where: { archived: false },
  });

  return <LotsClient lots={lots} analyzers={analyzers} />;
}
