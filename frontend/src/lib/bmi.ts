export type AdultBmiClassification = 'Baixo peso' | 'Faixa adequada' | 'Sobrepeso' | 'Obesidade'

export function calculateBmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || !weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null
  }

  return weightKg / ((heightCm / 100) ** 2)
}

function dateParts(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null

  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

export function ageOnDate(birthDate: string | null | undefined, today: string) {
  const birth = dateParts(birthDate)
  const current = dateParts(today)
  if (!birth || !current || birthDate! > today) return null

  let age = current.year - birth.year
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) age -= 1
  return age
}

export function classifyAdultBmi(bmi: number | null): AdultBmiClassification | null {
  if (bmi === null || !Number.isFinite(bmi) || bmi <= 0) return null
  if (bmi < 18.5) return 'Baixo peso'
  if (bmi < 25) return 'Faixa adequada'
  if (bmi < 30) return 'Sobrepeso'
  return 'Obesidade'
}
