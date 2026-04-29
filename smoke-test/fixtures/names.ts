export function generateSmokeNames() {
  const ts = Date.now();
  return {
    reagente: `SMOKE_KitPCR_${ts}`,
    ctrlPos: `SMOKE_CtrlPos_${ts}`,
    ctrlNeg: `SMOKE_CtrlNeg_${ts}`,
    loteRG: `SMOKE-RG-${ts}`,
    loteCP: `SMOKE-CP-${ts}`,
    loteCN: `SMOKE-CN-${ts}`,
    ts
  };
}
