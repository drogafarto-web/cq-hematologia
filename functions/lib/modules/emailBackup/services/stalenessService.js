"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectStaleness = detectStaleness;
exports.formatStalenessAlert = formatStalenessAlert;
const registry_1 = require("../registry");
// ─── Staleness Service ────────────────────────────────────────────────────────
//
// Runs staleness checks across all registered modules for a given lab.
// A module is considered "stale" when it has configured data (lots) in the lab
// but no new runs within the configured threshold window.
//
// Alert levels:
//   warning  → no activity for [threshold] to 6 days
//   critical → no activity for 7+ days, or lots exist but zero runs ever
/**
 * Returns all staleness alerts for the given lab.
 * Empty array means all active modules are healthy.
 */
async function detectStaleness(db, labId, thresholdDays) {
    const collectors = registry_1.moduleRegistry.getAll();
    if (collectors.length === 0)
        return [];
    const results = await Promise.allSettled(collectors.map(c => c.checkStaleness(db, labId, thresholdDays)));
    const alerts = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value !== null) {
            alerts.push(result.value);
        }
        else if (result.status === 'rejected') {
            // Staleness check failure should not block the backup — log and continue
            console.error(`[emailBackup] Staleness check failed for module ` +
                `"${collectors[i].moduleId}" lab="${labId}":`, result.reason);
        }
    }
    // Sort: critical first, then by days descending
    return alerts.sort((a, b) => {
        if (a.level !== b.level)
            return a.level === 'critical' ? -1 : 1;
        return b.daysSinceLastRun - a.daysSinceLastRun;
    });
}
/**
 * Formats a staleness alert as a human-readable string for email body / logs.
 */
function formatStalenessAlert(alert) {
    const daysStr = isFinite(alert.daysSinceLastRun)
        ? `${alert.daysSinceLastRun} dias sem registros`
        : 'nenhum registro encontrado';
    const lastStr = alert.lastRunAt
        ? ` (último: ${new Date(alert.lastRunAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`
        : '';
    const prefix = alert.level === 'critical' ? '🔴 CRÍTICO' : '🟡 ATENÇÃO';
    return `${prefix} — ${alert.moduleName}: ${daysStr}${lastStr}`;
}
//# sourceMappingURL=stalenessService.js.map