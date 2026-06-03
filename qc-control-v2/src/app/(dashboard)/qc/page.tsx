import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { TelaPrincipaV2 } from './tela-principal';

export const dynamic = 'force-dynamic';

export default async function QcPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const rawControles = await prisma.controle.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    include: {
      registros: {
        orderBy: { registradoEm: 'desc' },
        take: 10,
        include: {
          operador: { select: { nome: true } },
        },
      },
    },
  });

  const controles = rawControles.map((c) => ({
    ...c,
    protrombinaMin: Number(c.protrombinaMin),
    protrombinaMax: Number(c.protrombinaMax),
    rniMin: Number(c.rniMin),
    rniMax: Number(c.rniMax),
    ttppaMin: Number(c.ttppaMin),
    ttppaMax: Number(c.ttppaMax),
    registros: c.registros.map((r) => ({
      ...r,
      valorProtrombina: Number(r.valorProtrombina),
      valorRni: Number(r.valorRni),
      valorTtppa: Number(r.valorTtppa),
      registradoEm: r.registradoEm.toISOString(),
    })),
  }));

  const operador = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, nome: true },
  });

  if (!operador) redirect('/login');

  return <TelaPrincipaV2 controles={controles} operador={operador} />;
}
