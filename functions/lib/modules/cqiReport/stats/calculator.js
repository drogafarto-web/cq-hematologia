"use strict";
// ─── CQI Stats Calculator ─────────────────────────────────────────────────────
// Pure functions — no external dependencies.
// SD uses Bessel-corrected sample formula (n-1), matching ISO 5725 / CLSI EP05
// and the same convention used in the frontend's useRuns.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMean = calculateMean;
exports.calculateSD = calculateSD;
exports.calculateCV = calculateCV;
function calculateMean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function calculateSD(values, mean) {
    if (values.length < 2)
        return 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}
/** Returns CV as a percentage rounded to 2 decimal places. Returns 0 when mean is 0. */
function calculateCV(sd, mean) {
    if (mean === 0)
        return 0;
    return parseFloat(((sd / Math.abs(mean)) * 100).toFixed(2));
}
//# sourceMappingURL=calculator.js.map