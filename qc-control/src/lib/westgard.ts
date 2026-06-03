export function evaluateWestgard(
  value: number,
  mean: number,
  sd: number,
  history: { value: number; sdDistance: number; runAt: Date }[]
): { rule: string | null; isWarning: boolean; isReject: boolean; sdDistance: number } {
  const z = (value - mean) / sd
  const absZ = Math.abs(z)
  const sdDistance = z

  const sorted = [...history].sort((a, b) => new Date(a.runAt).getTime() - new Date(b.runAt).getTime())
  const recent = sorted.slice(-9)

  if (absZ > 3) {
    return { rule: '1-3S', isWarning: false, isReject: true, sdDistance }
  }

  if (recent.length >= 1) {
    const last = recent[recent.length - 1]
    const secondLast = recent.length >= 2 ? recent[recent.length - 2] : null

    if (last && Math.abs(last.sdDistance) > 2 && absZ > 2 && Math.sign(last.sdDistance) === Math.sign(z)) {
      return { rule: '2-2S', isWarning: false, isReject: true, sdDistance }
    }

    if (secondLast && Math.abs(secondLast.sdDistance) > 2 && absZ > 2 && Math.sign(secondLast.sdDistance) === Math.sign(z)) {
      return { rule: '2-2S', isWarning: false, isReject: true, sdDistance }
    }
  }

  if (recent.length >= 1) {
    const last = recent[recent.length - 1]
    if (last) {
      const range = absZ + Math.abs(last.sdDistance)
      if (range > 4) {
        return { rule: 'R-4S', isWarning: false, isReject: true, sdDistance }
      }
    }
  }

  if (recent.length >= 3) {
    const lastFour = [...recent.slice(-3), { sdDistance }]
    const positiveSide = lastFour.every(r => r.sdDistance > 1)
    const negativeSide = lastFour.every(r => r.sdDistance < -1)
    if (positiveSide || negativeSide) {
      return { rule: '4-1S', isWarning: false, isReject: true, sdDistance }
    }
  }

  if (recent.length >= 9) {
    const lastTen = [...recent.slice(-9), { sdDistance }]
    const positiveSide = lastTen.every(r => r.sdDistance > 0)
    const negativeSide = lastTen.every(r => r.sdDistance < 0)
    if (positiveSide || negativeSide) {
      return { rule: '10X', isWarning: false, isReject: true, sdDistance }
    }
  }

  if (absZ > 2) {
    return { rule: '1-2S', isWarning: true, isReject: false, sdDistance }
  }

  return { rule: null, isWarning: false, isReject: false, sdDistance }
}
