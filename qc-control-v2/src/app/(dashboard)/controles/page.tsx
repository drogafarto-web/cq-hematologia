import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { HubControles } from './hub-controles'

export const dynamic = 'force-dynamic'

export default async function ControlesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const rawControles = await prisma.controle.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { registros: true } },
    },
  })

  const controles = rawControles.map((c) => ({
    ...c,
    protrombinaMin: Number(c.protrombinaMin),
    protrombinaMax: Number(c.protrombinaMax),
    rniMin: Number(c.rniMin),
    rniMax: Number(c.rniMax),
    ttppaMin: Number(c.ttppaMin),
    ttppaMax: Number(c.ttppaMax),
  }))

  return <HubControles controles={controles} />
}
