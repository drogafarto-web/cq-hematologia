"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imunoCollector = void 0;
const admin = require("firebase-admin");
// ─── CIQ-Imuno Collector ──────────────────────────────────────────────────────
//
// Collects data from /labs/{labId}/ciq-imuno/{lotId}/runs/{runId}.
// Runs are CIQImunoRun — categorical R/NR, RDC 978/2025 compliant.
const MODULE_ID = 'imunologia';
const MODULE_NAME = 'Imunologia — CIQ-Imuno (RDC 978/2025)';
exports.imunoCollector = {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    async collect(db, labId, from, to) {
        const lotsSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
        if (lotsSnap.empty)
            return null;
        const rows = [];
        let totalRuns = 0;
        let nonConforming = 0;
        let lastRunDate = null;
        const conformingCount = { value: 0 };
        const nonConformingCount = { value: 0 };
        const testTypeSet = new Set();
        const operatorSet = new Set();
        for (const lotDoc of lotsSnap.docs) {
            const runsSnap = await db
                .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(from))
                .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(to))
                .orderBy('createdAt', 'asc')
                .get();
            for (const runDoc of runsSnap.docs) {
                const r = runDoc.data();
                totalRuns++;
                const createdAt = r['createdAt'];
                const dateStr = createdAt.toDate().toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                });
                const timeStr = createdAt.toDate().toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                });
                const expected = r['resultadoEsperado'] ?? '—';
                const obtained = r['resultadoObtido'] ?? '—';
                const isConform = expected === obtained;
                const testType = r['testType'] ?? '—';
                const alerts = r['westgardCategorico'] ?? [];
                if (isConform) {
                    conformingCount.value++;
                }
                else {
                    nonConformingCount.value++;
                    nonConforming++;
                }
                testTypeSet.add(testType);
                const operatorName = r['operatorName'] ?? '—';
                operatorSet.add(operatorName);
                const isoDate = createdAt.toDate().toISOString().slice(0, 10);
                if (!lastRunDate || isoDate > lastRunDate)
                    lastRunDate = isoDate;
                rows.push({
                    'Código': r['runCode'] ?? '—',
                    'Data': `${dateStr} ${timeStr}`,
                    'Tipo de Teste': testType,
                    'Lote Controle': r['loteControle'] ?? '—',
                    'Lote Reagente': r['loteReagente'] ?? '—',
                    'Reg. ANVISA': r['registroANVISA'] ?? '—',
                    'Esperado': expected === 'R' ? 'Reagente' : 'Não Reagente',
                    'Obtido': obtained === 'R' ? 'Reagente' : 'Não Reagente',
                    'Conformidade': isConform ? 'Conforme' : 'NÃO CONFORME',
                    'Ação Corretiva': r['acaoCorretiva'] ?? '—',
                    'Alertas': alerts.length > 0 ? alerts.join(', ') : '—',
                    'Equipamento': r['equipamento'] ?? '—',
                    'Operador': operatorName,
                    'Cargo': r['operatorRole'] ?? '—',
                    'Assinatura': (r['logicalSignature']?.slice(0, 12) ?? '—') + '…',
                });
            }
        }
        if (totalRuns === 0)
            return null;
        const conformityRate = totalRuns > 0
            ? ((conformingCount.value / totalRuns) * 100).toFixed(1)
            : '0.0';
        return {
            moduleId: MODULE_ID,
            moduleName: MODULE_NAME,
            lastRunDate,
            totalRuns,
            nonConformingRuns: nonConforming,
            columns: [
                'Código', 'Data', 'Tipo de Teste', 'Lote Controle', 'Lote Reagente',
                'Reg. ANVISA', 'Esperado', 'Obtido', 'Conformidade', 'Ação Corretiva',
                'Alertas', 'Equipamento', 'Operador', 'Cargo', 'Assinatura',
            ],
            rows,
            summary: {
                'Total de corridas': String(totalRuns),
                'Conformes': String(conformingCount.value),
                'Não conformes': String(nonConformingCount.value),
                'Taxa de conformidade': `${conformityRate}%`,
                'Tipos de teste': Array.from(testTypeSet).join(', ') || '—',
                'Operadores distintos': String(operatorSet.size),
                'Lotes cobertos': String(lotsSnap.size),
            },
        };
    },
    async checkStaleness(db, labId, thresholdDays) {
        const lotsSnap = await db.collection(`labs/${labId}/ciq-imuno`).limit(1).get();
        if (lotsSnap.empty)
            return null; // Module not in use for this lab
        const allLotsSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
        let mostRecentTimestamp = null;
        for (const lotDoc of allLotsSnap.docs) {
            const lastRunSnap = await db
                .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            if (!lastRunSnap.empty) {
                const ts = lastRunSnap.docs[0].data()['createdAt'];
                if (!mostRecentTimestamp || ts.seconds > mostRecentTimestamp.seconds) {
                    mostRecentTimestamp = ts;
                }
            }
        }
        if (!mostRecentTimestamp) {
            return {
                moduleId: MODULE_ID,
                moduleName: MODULE_NAME,
                daysSinceLastRun: Infinity,
                level: 'critical',
                lastRunAt: null,
            };
        }
        const now = Date.now();
        const lastRunMs = mostRecentTimestamp.toDate().getTime();
        const daysSinceLastRun = (now - lastRunMs) / (1000 * 60 * 60 * 24);
        if (daysSinceLastRun < thresholdDays)
            return null;
        return {
            moduleId: MODULE_ID,
            moduleName: MODULE_NAME,
            daysSinceLastRun: Math.floor(daysSinceLastRun),
            level: daysSinceLastRun >= 7 ? 'critical' : 'warning',
            lastRunAt: mostRecentTimestamp.toDate().toISOString(),
        };
    },
};
//# sourceMappingURL=imunoCollector.js.map