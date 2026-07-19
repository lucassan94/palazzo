// ================================================================
// Validadores compartilhados (Telefone BR, CPF, CEP)
// ================================================================

/**
 * Valida telefone brasileiro (11) 99999-9999 ou (11) 3333-4444
 * Aceita formatos: 11999999999, (11)99999-9999, 11 99999 9999
 */
export function validarTelefone(value) {
  if (!value) return { valido: false, formatado: '' }

  const digits = value.replace(/\D/g, '')
  
  // Celular: 11 dígitos (com 9), Fixo: 10 dígitos
  if (digits.length < 10 || digits.length > 11) {
    return { valido: false, formatado: value, mensagem: 'Telefone deve ter 10 ou 11 dígitos.' }
  }

  // Formatar como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  const ddd = digits.substring(0, 2)
  if (digits.length === 11) {
    return {
      valido: true,
      formatado: `(${ddd}) ${digits.substring(2, 7)}-${digits.substring(7)}`,
      digits,
    }
  }
  return {
    valido: true,
    formatado: `(${ddd}) ${digits.substring(2, 6)}-${digits.substring(6)}`,
    digits,
  }
}

/**
 * Valida CPF brasileiro
 * Algorítmo: cálculo dos dígitos verificadores
 */
export function validarCPF(value) {
  if (!value) return { valido: false, formatado: '' }

  const digits = value.replace(/\D/g, '')

  if (digits.length !== 11) {
    return { valido: false, formatado: value, mensagem: 'CPF deve ter 11 dígitos.' }
  }

  // Rejeitar sequências iguais (111.111.111-11, etc)
  if (/^(\d)\1{10}$/.test(digits)) {
    return { valido: false, formatado: value, mensagem: 'CPF inválido (sequência repetida).' }
  }

  // Validar primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits[i]) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[9])) {
    return { valido: false, formatado: value, mensagem: 'CPF inválido.' }
  }

  // Validar segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits[i]) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(digits[10])) {
    return { valido: false, formatado: value, mensagem: 'CPF inválido.' }
  }

  // Formatar como XXX.XXX.XXX-XX
  return {
    valido: true,
    formatado: `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}`,
    digits,
  }
}

/**
 * Valida CEP brasileiro
 */
export function validarCEP(value) {
  if (!value) return { valido: false, formatado: '' }
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 8) {
    return { valido: false, formatado: value, mensagem: 'CEP deve ter 8 dígitos.' }
  }
  return {
    valido: true,
    formatado: `${digits.substring(0, 5)}-${digits.substring(5)}`,
    digits,
  }
}

/**
 * Máscara de telefone para inputs (formata enquanto digita)
 */
export function maskTelefone(value) {
  const digits = value.replace(/\D/g, '').substring(0, 11)
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.substring(0, 2)}) ${digits.substring(2)}`
  return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`
}

/**
 * Máscara de CPF para inputs
 */
export function maskCPF(value) {
  const digits = value.replace(/\D/g, '').substring(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.substring(0, 3)}.${digits.substring(3)}`
  if (digits.length <= 9) return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6)}`
  return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}`
}
