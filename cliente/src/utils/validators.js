// ================================================================
// Validadores compartilhados (Frontend)
// ================================================================

/**
 * Valida telefone brasileiro
 */
export function validarTelefone(value) {
  if (!value) return { valido: false, formatado: '' }
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 11) {
    return { valido: false, formatado: value, mensagem: 'Telefone deve ter 10 ou 11 dígitos.' }
  }
  const ddd = digits.substring(0, 2)
  if (digits.length === 11) {
    return { valido: true, formatado: `(${ddd}) ${digits.substring(2, 7)}-${digits.substring(7)}`, digits }
  }
  return { valido: true, formatado: `(${ddd}) ${digits.substring(2, 6)}-${digits.substring(6)}`, digits }
}

/**
 * Valida CPF brasileiro (algorítmo dos dígitos verificadores)
 */
export function validarCPF(value) {
  if (!value) return { valido: false, formatado: '' }
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) {
    return { valido: false, formatado: value, mensagem: 'CPF deve ter 11 dígitos.' }
  }
  if (/^(\d)\1{10}$/.test(digits)) {
    return { valido: false, formatado: value, mensagem: 'CPF inválido (sequência repetida).' }
  }
  // Primeiro dígito
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(digits[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[9])) return { valido: false, formatado: value, mensagem: 'CPF inválido.' }
  // Segundo dígito
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(digits[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[10])) return { valido: false, formatado: value, mensagem: 'CPF inválido.' }
  return {
    valido: true,
    formatado: `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}`,
    digits,
  }
}

/**
 * Máscaras para inputs
 */
export function maskTelefone(value) {
  const d = value.replace(/\D/g, '').substring(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.substring(0, 2)}) ${d.substring(2)}`
  return `(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}`
}

export function maskCPF(value) {
  const d = value.replace(/\D/g, '').substring(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.substring(0, 3)}.${d.substring(3)}`
  if (d.length <= 9) return `${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6)}`
  return `${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6, 9)}-${d.substring(9)}`
}

export function maskCEP(value) {
  const d = value.replace(/\D/g, '').substring(0, 8)
  if (d.length <= 5) return d
  return `${d.substring(0, 5)}-${d.substring(5)}`
}
