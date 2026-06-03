import { PrismaClient, Role, AnalyzerStatus, LotStatus, QcRunStatus, CAStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('lab123', 10)

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@lab.test' },
    update: {},
    create: {
      email: 'analyst@lab.test',
      name: 'Maria Silva',
      passwordHash,
      role: Role.ANALYST,
    },
  })

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@lab.test' },
    update: {},
    create: {
      email: 'supervisor@lab.test',
      name: 'João Miller',
      passwordHash,
      role: Role.SUPERVISOR,
    },
  })

  const coag01 = await prisma.analyzer.upsert({
    where: { analyzerId: 'COAG-01' },
    update: {},
    create: {
      analyzerId: 'COAG-01',
      model: 'ACL TOP 550 CTS',
      manufacturer: 'Werfen',
      serialNumber: 'SN-550-001',
      location: 'Main Lab Room A',
      installDate: new Date('2022-11-20'),
      status: AnalyzerStatus.OPERATIONAL,
    },
  })

  const coag02 = await prisma.analyzer.upsert({
    where: { analyzerId: 'COAG-02' },
    update: {},
    create: {
      analyzerId: 'COAG-02',
      model: 'ACL TOP 350',
      manufacturer: 'Werfen',
      serialNumber: 'SN-350-002',
      location: 'Main Lab Room A',
      installDate: new Date('2023-03-15'),
      status: AnalyzerStatus.CAL_OVERDUE,
    },
  })

  const lot1 = await prisma.lot.upsert({
    where: { lotNumber_level: { lotNumber: '7425', level: 1 } },
    update: {},
    create: {
      lotNumber: '7425',
      analyte: 'PT-INR',
      level: 1,
      reagentName: 'Thioplastin Plus',
      analyzerId: coag02.id,
      targetMean: 12.2,
      sd: 0.38,
      minAcceptance: 11.06,
      maxAcceptance: 13.34,
      status: LotStatus.ACTIVE,
      createdById: analyst.id,
    },
  })

  const lot2 = await prisma.lot.upsert({
    where: { lotNumber_level: { lotNumber: '7425', level: 2 } },
    update: {},
    create: {
      lotNumber: '7425',
      analyte: 'PT-INR',
      level: 2,
      reagentName: 'Thioplastin Plus',
      analyzerId: coag02.id,
      targetMean: 24.12,
      sd: 0.71,
      minAcceptance: 21.99,
      maxAcceptance: 26.25,
      status: LotStatus.ACTIVE,
      createdById: analyst.id,
    },
  })

  const lot3 = await prisma.lot.upsert({
    where: { lotNumber_level: { lotNumber: '8192', level: 1 } },
    update: {},
    create: {
      lotNumber: '8192',
      analyte: 'APTT',
      level: 1,
      reagentName: 'Actin FS',
      analyzerId: coag02.id,
      targetMean: 32.45,
      sd: 1.15,
      minAcceptance: 29.00,
      maxAcceptance: 35.90,
      status: LotStatus.ACTIVE,
      createdById: analyst.id,
    },
  })

  const lot4 = await prisma.lot.upsert({
    where: { lotNumber_level: { lotNumber: '8192', level: 2 } },
    update: {},
    create: {
      lotNumber: '8192',
      analyte: 'APTT',
      level: 2,
      reagentName: 'Actin FS',
      analyzerId: coag02.id,
      targetMean: 56.80,
      sd: 2.41,
      minAcceptance: 49.57,
      maxAcceptance: 64.03,
      status: LotStatus.ACTIVE,
      createdById: analyst.id,
    },
  })

  const lot5 = await prisma.lot.upsert({
    where: { lotNumber_level: { lotNumber: '1029', level: 1 } },
    update: {},
    create: {
      lotNumber: '1029',
      analyte: 'Fibrinogen',
      level: 1,
      reagentName: 'Multifibren U',
      analyzerId: coag01.id,
      targetMean: 245.00,
      sd: 12.50,
      minAcceptance: 207.50,
      maxAcceptance: 282.50,
      status: LotStatus.ACTIVE,
      createdById: analyst.id,
    },
  })

  const lots = [lot1, lot2, lot3, lot4, lot5]
  const now = new Date()
  let qcRunCount = 0

  function generateValue(mean: number, sd: number, variation = 1): number {
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2)
    return Math.round((mean + z * sd * variation) * 100) / 100
  }

  function randomDate(daysBack: number): Date {
    const d = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000)
    return d
  }

  for (const lot of lots) {
    const mean = Number(lot.targetMean)
    const sd = Number(lot.sd)
    const count = lot.lotNumber === '7425' && lot.level === 1 ? 8 : lot.lotNumber === '1029' ? 4 : 6

    for (let i = 0; i < count; i++) {
      if (qcRunCount >= 30) break
      const value = generateValue(mean, sd)
      const sdDistance = (value - mean) / sd
      const runAt = randomDate(30)

      await prisma.qcRun.create({
        data: {
          lotId: lot.id,
          value,
          sdDistance,
          isReject: false,
          isWarning: false,
          status: QcRunStatus.RELEASED,
          runAt,
          operatorId: analyst.id,
        },
      })
      qcRunCount++
    }
    if (qcRunCount >= 30) break
  }

  const twoSdValue1 = Number(lot1.targetMean) + Number(lot1.sd) * 2.3
  const twoSdValue2 = Number(lot1.targetMean) + Number(lot1.sd) * 2.4
  const sdDist1 = (twoSdValue1 - Number(lot1.targetMean)) / Number(lot1.sd)
  const sdDist2 = (twoSdValue2 - Number(lot1.targetMean)) / Number(lot1.sd)

  const violLot1 = await prisma.qcRun.create({
    data: {
      lotId: lot1.id,
      value: twoSdValue1,
      sdDistance: sdDist1,
      isReject: true,
      isWarning: false,
      ruleViolated: '2-2S',
      status: QcRunStatus.PENDING_JUSTIFICATION,
      runAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      operatorId: analyst.id,
    },
  })

  await prisma.qcRun.create({
    data: {
      lotId: lot1.id,
      value: twoSdValue2,
      sdDistance: sdDist2,
      isReject: true,
      isWarning: false,
      ruleViolated: '2-2S',
      status: QcRunStatus.PENDING_JUSTIFICATION,
      runAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      operatorId: analyst.id,
    },
  })

  await prisma.correctiveAction.upsert({
    where: { caNumber: 'CA-2026-0005' },
    update: {},
    create: {
      caNumber: 'CA-2026-0005',
      openedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      analyte: 'PT-INR',
      lotId: lot1.id,
      equipmentId: coag02.id,
      ruleViolated: '2-2S',
      status: CAStatus.OPEN,
      operatorId: analyst.id,
      investigatorId: supervisor.id,
      targetCompletionAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('Seed completed successfully')
  console.log(`Created ${qcRunCount + 2} QC runs`)
  console.log('Created corrective action CA-2026-0005')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
