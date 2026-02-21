// تنسيق أرقام عام: يظهر الأعداد الصحيحة بدون كسور،
// وغير الصحيحة حتى منزلتين كحد أقصى مع إزالة الأصفار الزائدة
export const formatNumber = (value, decimals = 2) => {
  const num = Number(value)
  if (!isFinite(num)) return '0'

  const factor = Math.pow(10, decimals)
  const rounded = Math.round(num * factor) / factor
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

// تحويل تاريخ ISO (YYYY-MM-DD) إلى عرض من اليمين لليسار: السنة/الشهر/اليوم (مثال: 2026/1/29)
export const formatDateToDisplay = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string') return ''
  const [y, m, d] = isoDate.trim().split(/[-/]/)
  if (!y || !m || !d) return isoDate
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)
  if (!month || !day) return isoDate
  return `${y}/${month}/${day}`
}

// تحويل نص التاريخ (YYYY/M/D أو YYYY-M-D) إلى ISO (YYYY-MM-DD)
export const parseDisplayDateToISO = (displayStr) => {
  if (!displayStr || typeof displayStr !== 'string') return ''
  const s = displayStr.trim().replace(/\s/g, '')
  const parts = s.split(/[/-]/)
  if (parts.length !== 3) return ''
  let [a, b, c] = parts
  const y = a.replace(/\D/g, '').slice(0, 4)
  const m = b.replace(/\D/g, '').slice(0, 2)
  const d = c.replace(/\D/g, '').slice(0, 2)
  if (y.length < 4 || !m || !d) return ''
  const year = parseInt(y, 10)
  const month = Math.max(1, Math.min(12, parseInt(m, 10) || 1))
  const day = Math.max(1, Math.min(31, parseInt(d, 10) || 1))
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y.padStart(4, '0')}-${mm}-${dd}`
}
























