import { describe, it, expect } from 'vitest'
import { evaluateWestgard } from '@/lib/westgard'

describe('evaluateWestgard', () => {
  it('returns in-control for values within 1SD', () => {
    const result = evaluateWestgard(12.5, 12.2, 0.38, [])
    expect(result.rule).toBeNull()
    expect(result.isWarning).toBe(false)
    expect(result.isReject).toBe(false)
    expect(result.sdDistance).toBeCloseTo(0.789, 2)
  })

  it('returns 1-2S warning when absZ > 2', () => {
    const result = evaluateWestgard(13.0, 12.2, 0.38, [])
    expect(result.rule).toBe('1-2S')
    expect(result.isWarning).toBe(true)
    expect(result.isReject).toBe(false)
  })

  it('returns 1-3S reject when absZ > 3', () => {
    const result = evaluateWestgard(13.4, 12.2, 0.38, [])
    expect(result.rule).toBe('1-3S')
    expect(result.isWarning).toBe(false)
    expect(result.isReject).toBe(true)
  })

  it('returns 2-2S reject when 2 consecutive > 2SD on same side', () => {
    const history = [
      { value: 13.0, sdDistance: 2.1, runAt: new Date('2025-05-24T10:00:00') },
    ]
    const result = evaluateWestgard(13.1, 12.2, 0.38, history)
    expect(result.rule).toBe('2-2S')
    expect(result.isReject).toBe(true)
  })

  it('returns 2-2S when the current and second-to-last exceed 2SD on same side', () => {
    const history = [
      { value: 12.0, sdDistance: -0.5, runAt: new Date('2025-05-23T10:00:00') },
      { value: 13.0, sdDistance: 2.1, runAt: new Date('2025-05-24T10:00:00') },
    ]
    const result = evaluateWestgard(13.1, 12.2, 0.38, history)
    expect(result.rule).toBe('2-2S')
    expect(result.isReject).toBe(true)
  })

  it('returns R-4S reject when range > 4SD between consecutive', () => {
    const history = [
      { value: 11.4, sdDistance: -2.1, runAt: new Date('2025-05-24T10:00:00') },
    ]
    const result = evaluateWestgard(13.0, 12.2, 0.38, history)
    expect(result.rule).toBe('R-4S')
    expect(result.isReject).toBe(true)
  })

  it('returns 4-1S reject when 4 consecutive > 1SD on same side', () => {
    const history = [
      { value: 12.6, sdDistance: 1.05, runAt: new Date('2025-05-21T10:00:00') },
      { value: 12.7, sdDistance: 1.31, runAt: new Date('2025-05-22T10:00:00') },
      { value: 12.8, sdDistance: 1.57, runAt: new Date('2025-05-23T10:00:00') },
    ]
    const result = evaluateWestgard(12.9, 12.2, 0.38, history)
    expect(result.rule).toBe('4-1S')
    expect(result.isReject).toBe(true)
  })

  it('returns 10X reject when 10 consecutive on same side of mean', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      value: 12.3 + i * 0.01,
      sdDistance: 0.1 + i * 0.02,
      runAt: new Date(`2025-05-${String(15 + i).padStart(2, '0')}T10:00:00`),
    }))
    const result = evaluateWestgard(12.4, 12.2, 0.38, history)
    expect(result.rule).toBe('10X')
    expect(result.isReject).toBe(true)
  })

  it('does not return 10X when values are on both sides of mean', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      value: i % 2 === 0 ? 12.3 : 12.1,
      sdDistance: i % 2 === 0 ? 0.26 : -0.26,
      runAt: new Date(`2025-05-${String(15 + i).padStart(2, '0')}T10:00:00`),
    }))
    const result = evaluateWestgard(12.2, 12.2, 0.38, history)
    expect(result.rule).toBeNull()
    expect(result.isReject).toBe(false)
  })
})
