import { PrismaClient, Papel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('lab123', 10);

  // 1. Usuário operador
  await prisma.usuario.upsert({
    where: { email: 'maria@hospital.test' },
    update: {},
    create: {
      email: 'maria@hospital.test',
      nome: 'Maria Silva',
      senhaHash,
      papel: Papel.ANALISTA,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'joao@hospital.test' },
    update: {},
    create: {
      email: 'joao@hospital.test',
      nome: 'João Miller',
      senhaHash,
      papel: Papel.SUPERVISOR,
    },
  });

  // 2. Dois controles ativos com ranges
  const controleNormal = await prisma.controle.upsert({
    where: { nome: 'Controle Normal' },
    update: {},
    create: {
      nome: 'Controle Normal',
      lote: '7425',
      ativo: true,
      protrombinaMin: 80,
      protrombinaMax: 120,
      rniMin: 0.83,
      rniMax: 1.11,
      ttppaMin: 27,
      ttppaMax: 39,
    },
  });

  const controlePatologico = await prisma.controle.upsert({
    where: { nome: 'Controle Patológico' },
    update: {},
    create: {
      nome: 'Controle Patológico',
      lote: '8192',
      ativo: true,
      protrombinaMin: 50,
      protrombinaMax: 90,
      rniMin: 1.8,
      rniMax: 3.2,
      ttppaMin: 45,
      ttppaMax: 65,
    },
  });

  // 3. 5 registros recentes em cada controle
  const maria = await prisma.usuario.findUnique({ where: { email: 'maria@hospital.test' } });
  if (!maria) throw new Error('Usuário não encontrado');

  const amostrasNormal = [
    { prot: 102, rni: 0.95, ttppa: 31.2 },
    { prot: 98, rni: 1.01, ttppa: 33.5 },
    { prot: 115, rni: 0.88, ttppa: 28.7 },
    { prot: 75, rni: 1.18, ttppa: 42.1 }, // fora
    { prot: 108, rni: 0.92, ttppa: 30.8 },
  ];

  const amostrasPatologico = [
    { prot: 68, rni: 2.45, ttppa: 52.3 },
    { prot: 72, rni: 2.18, ttppa: 55.1 },
    { prot: 61, rni: 2.78, ttppa: 49.8 },
    { prot: 45, rni: 3.85, ttppa: 72.4 }, // fora
    { prot: 66, rni: 2.31, ttppa: 51.2 },
  ];

  for (let i = amostrasNormal.length - 1; i >= 0; i--) {
    const a = amostrasNormal[i]!;
    await prisma.registro.create({
      data: {
        controleId: controleNormal.id,
        valorProtrombina: a.prot,
        valorRni: a.rni,
        valorTtppa: a.ttppa,
        operadorId: maria.id,
        registradoEm: new Date(
          Date.now() - i * 24 * 60 * 60 * 1000 - Math.random() * 2 * 60 * 60 * 1000,
        ),
      },
    });
  }

  for (let i = amostrasPatologico.length - 1; i >= 0; i--) {
    const a = amostrasPatologico[i]!;
    await prisma.registro.create({
      data: {
        controleId: controlePatologico.id,
        valorProtrombina: a.prot,
        valorRni: a.rni,
        valorTtppa: a.ttppa,
        operadorId: maria.id,
        registradoEm: new Date(
          Date.now() - i * 24 * 60 * 60 * 1000 - Math.random() * 2 * 60 * 60 * 1000,
        ),
      },
    });
  }

  console.log('✓ Seed criado:', { usuarios: 2, controles: 2, registros: 10 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
