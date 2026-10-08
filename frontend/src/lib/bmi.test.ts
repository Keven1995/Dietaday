import { describe, expect, it } from 'vitest'
import { ageOnDate, calculateBmi, classifyAdultBmi } from './bmi'

describe('BMI calculation', () => {
  it('calculates BMI from kilograms and centimeters', () => {
    expect(calculateBmi(70, 170)).toBeCloseTo(24.22, 2)
  })

  it('returns no result for missing or invalid measurements', () => {
    expect(calculateBmi(null, 170)).toBeNull()
    expect(calculateBmi(70, null)).toBeNull()
    expect(calculateBmi(Number.NaN, 170)).toBeNull()
    expect(calculateBmi(70, 0)).toBeNull()
  })
})

describe('age calculation for adult BMI classification', () => {
  it('uses the exact birthday to determine whether the user is an adult', () => {
    expect(ageOnDate('2008-10-08', '2026-10-07')).toBe(17)
    expect(ageOnDate('2008-10-08', '2026-10-08')).toBe(18)
  })

  it('returns no age for missing, invalid, or future birth dates', () => {
    expect(ageOnDate(null, '2026-10-08')).toBeNull()
    expect(ageOnDate('2001-02-29', '2026-10-08')).toBeNull()
    expect(ageOnDate('2026-10-09', '2026-10-08')).toBeNull()
  })
})

describe('adult BMI reference classification', () => {
  it.each([
    [18.49, 'Baixo peso'],
    [18.5, 'Faixa adequada'],
    [24.99, 'Faixa adequada'],
    [25, 'Sobrepeso'],
    [29.99, 'Sobrepeso'],
    [30, 'Obesidade'],
  ] as const)('classifies BMI %s as %s', (bmi, classification) => {
    expect(classifyAdultBmi(bmi)).toBe(classification)
  })

  it('does not classify missing or invalid BMI values', () => {
    expect(classifyAdultBmi(null)).toBeNull()
    expect(classifyAdultBmi(Number.NaN)).toBeNull()
  })
})
