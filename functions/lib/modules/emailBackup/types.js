"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBackupRecipients = resolveBackupRecipients;
/**
 * Resolve a lista efetiva de destinatários do backup diário.
 * Prioridade: emails[] → [email] (legacy) → [].
 */
function resolveBackupRecipients(cfg) {
    if (Array.isArray(cfg.emails) && cfg.emails.length > 0) {
        return cfg.emails.filter(e => typeof e === 'string' && e.trim().length > 0);
    }
    if (cfg.email && typeof cfg.email === 'string' && cfg.email.trim().length > 0) {
        return [cfg.email.trim()];
    }
    return [];
}
//# sourceMappingURL=types.js.map