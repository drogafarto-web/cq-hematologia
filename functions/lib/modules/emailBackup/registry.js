"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleRegistry = void 0;
// ─── Module Registry ──────────────────────────────────────────────────────────
//
// Central registry for all backup-capable modules. The scheduled backup
// function queries this registry to discover what data to collect — it never
// needs to know about individual modules directly.
//
// How to add a new module:
//   1. Implement ModuleCollector in collectors/{moduleId}Collector.ts
//   2. Import and register it in collectors/index.ts
//   3. Nothing else changes — the backup system picks it up automatically.
class ModuleRegistry {
    constructor() {
        this.collectors = new Map();
    }
    register(collector) {
        if (this.collectors.has(collector.moduleId)) {
            throw new Error(`ModuleRegistry: duplicate moduleId "${collector.moduleId}". ` +
                `Each module must have a unique identifier.`);
        }
        this.collectors.set(collector.moduleId, collector);
    }
    getAll() {
        return Array.from(this.collectors.values());
    }
    get(moduleId) {
        return this.collectors.get(moduleId);
    }
    get size() {
        return this.collectors.size;
    }
}
// Singleton — imported by collectors/index.ts and consumed by the scheduled function
exports.moduleRegistry = new ModuleRegistry();
//# sourceMappingURL=registry.js.map