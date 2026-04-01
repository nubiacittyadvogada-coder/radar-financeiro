/**
 * Classificador de Plano de Contas
 *
 * Classifica lançamentos financeiros com base no código P.CONTAS.
 * O prefixo (antes do ".") determina o tipo e o sufixo (depois do ".") o subtipo.
 *
 * Prefixos:
 *   01_RPS → receita (honorários, consultas, êxito, repasse)
 *   02_IMP → imposto
 *   03_CSP → custo_direto
 *   04_PES → pessoal
 *   04_MKT → marketing
 *   04_GER → geral
 *   05_RET → retirada
 *   06_DRF → financeiro
 *   07_DLC → distribuicao
 *   08_INV → investimento
 *   09_EMP → emprestimo
 *   10_APL → aplicacao
 *   11_APT → aporte
 *   12_PCI → parcelamento
 */

export interface Classificacao {
  tipo: string
  subtipo: string
  grupoConta: string
}

// Mapa de prefixo → tipo
const PREFIXO_TIPO: Record<string, string> = {
  '01_RPS': 'receita',
  '01_ROB': 'receita',  // variação encontrada no DRE template
  '01_ROP': 'receita',  // variação encontrada no DRE template
  '02_IMP': 'imposto',
  '03_CSP': 'custo_direto',
  '04_PES': 'pessoal',
  '04_MKT': 'marketing',
  '04_GER': 'geral',
  '05_RET': 'retirada',
  '06_DRF': 'financeiro',
  '07_DLC': 'distribuicao',
  '08_INV': 'investimento',
  '09_EMP': 'emprestimo',
  '10_APL': 'aplicacao',
  '11_APT': 'aporte',
  '12_PCI': 'parcelamento',
}

/**
 * Normaliza o sufixo do P.CONTAS para um subtipo legível.
 * Ex: "HONORÁRIOS INICIAIS" → "honorarios_iniciais"
 *     "DESPESAS COM JUROS" → "despesas_com_juros"
 */
function normalizarSubtipo(sufixo: string): string {
  return sufixo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')    // remove caracteres especiais
    .replace(/\s+/g, '_')           // espaços → underscores
    .replace(/_+/g, '_')            // underscores duplicados
    .replace(/^_|_$/g, '')          // trim underscores
}

/**
 * Extrai o prefixo (grupoConta) do código P.CONTAS.
 * Ex: "01_RPS.HONORÁRIOS MENSAIS" → "01_RPS"
 *     "04_GER.DESPESAS BANCÁRIAS" → "04_GER"
 *     "05_RET.RETIRADA  NÚBIA"    → "05_RET"
 */
function extrairPrefixo(planoConta: string): string {
  const ponto = planoConta.indexOf('.')
  if (ponto === -1) {
    // Sem ponto — tenta usar o código inteiro como prefixo
    return planoConta.trim().toUpperCase()
  }
  return planoConta.substring(0, ponto).trim().toUpperCase()
}

/**
 * Extrai o sufixo do código P.CONTAS.
 * Ex: "01_RPS.HONORÁRIOS MENSAIS" → "HONORÁRIOS MENSAIS"
 *     "05_RET.RETIRADA  NÚBIA"    → "RETIRADA  NÚBIA"
 */
function extrairSufixo(planoConta: string): string {
  const ponto = planoConta.indexOf('.')
  if (ponto === -1) return planoConta.trim()
  return planoConta.substring(ponto + 1).trim()
}

/**
 * Classifica um lançamento pelo código P.CONTAS.
 *
 * @param planoConta - Código do plano de contas (ex: "01_RPS.HONORÁRIOS MENSAIS")
 * @returns Classificação com tipo, subtipo e grupoConta
 * @throws Error se o prefixo não for reconhecido
 */
export function classificar(planoConta: string): Classificacao {
  if (!planoConta || typeof planoConta !== 'string') {
    throw new Error('Plano de contas vazio ou inválido')
  }

  const trimmed = planoConta.trim()
  if (trimmed.length === 0) {
    throw new Error('Plano de contas vazio ou inválido')
  }

  const grupoConta = extrairPrefixo(trimmed)
  const sufixo = extrairSufixo(trimmed)
  const subtipo = normalizarSubtipo(sufixo)

  // Busca direta do prefixo
  const tipo = PREFIXO_TIPO[grupoConta]

  if (tipo) {
    return { tipo, subtipo, grupoConta }
  }

  // Fallback: tenta match pelo início numérico (ex: "05_RET" para "05_RET.RETIRADA  NÚBIA")
  // Útil para variações como "05_RET" com espaços duplos no sufixo
  const prefixoNumerico = grupoConta.substring(0, 2)
  for (const [key, value] of Object.entries(PREFIXO_TIPO)) {
    if (key.startsWith(prefixoNumerico + '_') && grupoConta.startsWith(prefixoNumerico + '_')) {
      // Match parcial pelo grupo numérico — verifica se o prefixo base é o mesmo
      const baseKey = key.substring(0, key.length)
      if (grupoConta === baseKey) {
        return { tipo: value, subtipo, grupoConta }
      }
    }
  }

  throw new Error(`Prefixo de plano de contas não reconhecido: "${grupoConta}" (código: "${trimmed}")`)
}

/**
 * Verifica se um P.CONTAS é de receita.
 */
export function isReceita(planoConta: string): boolean {
  try {
    return classificar(planoConta).tipo === 'receita'
  } catch {
    return false
  }
}

/**
 * Verifica se um P.CONTAS é repasse de êxito (deve ser deduzido da receita).
 */
export function isRepasseExito(planoConta: string): boolean {
  const sufixo = extrairSufixo(planoConta).toUpperCase()
  return sufixo.includes('REPASSE') && sufixo.includes('ÊXITO') ||
         sufixo.includes('REPASSE') && sufixo.includes('EXITO')
}

/**
 * Determina o status de pagamento normalizado.
 *
 * Despesas: SIT. (col 8) e PG (col 9) são colunas separadas
 *   "OK" + "PG" → "OK PG" (pago)
 *   "PREV" + ""  → "PREV" (previsto)
 *   "OK" + ""    → "OK PG" (tratado como pago)
 *
 * Receitas: PG (col 8) é uma única coluna
 *   "PG" → "OK PG" (pago)
 *   ""   → "PREV" (previsto/pendente)
 */
export function normalizarStatusPg(
  sit: string | undefined | null,
  pg: string | undefined | null,
  tipoArquivo: 'receitas' | 'despesas'
): { statusPg: string; previsto: boolean } {
  if (tipoArquivo === 'receitas') {
    const status = String(sit || '').trim().toUpperCase()
    if (status === 'PG') {
      return { statusPg: 'OK PG', previsto: false }
    }
    return { statusPg: 'PREV', previsto: true }
  }

  // Despesas: duas colunas
  const sitStr = String(sit || '').trim().toUpperCase()
  const pgStr = String(pg || '').trim().toUpperCase()

  if (sitStr === 'PREV') {
    return { statusPg: 'PREV', previsto: true }
  }

  if (sitStr === 'OK') {
    return { statusPg: 'OK PG', previsto: false }
  }

  // Fallback
  if (pgStr === 'PG') {
    return { statusPg: 'OK PG', previsto: false }
  }

  return { statusPg: 'PREV', previsto: true }
}

/**
 * Converte um valor do Excel para número.
 * O SheetJS já converte valores numéricos, mas pode haver strings.
 *
 * Regras:
 * - Se número: usa direto
 * - Se string com parênteses: (1.234,56) → -1234.56
 * - Se string: remove pontos de milhar, troca vírgula por ponto
 */
export function parseValor(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') {
    return 0
  }

  if (typeof valor === 'number') {
    return valor
  }

  let str = String(valor).trim()

  // Verifica formato com parênteses: (1.234,56) → negativo
  const isNegativo = str.startsWith('(') && str.endsWith(')')
  if (isNegativo) {
    str = str.substring(1, str.length - 1)
  }

  // Remove espaços e R$
  str = str.replace(/\s/g, '').replace(/R\$/g, '')

  // Detecta formato brasileiro (1.234,56) vs americano (1,234.56)
  // Se tem vírgula seguida de exatamente 2 dígitos no final, é BR
  if (/,\d{2}$/.test(str) && str.includes('.')) {
    // Formato BR: remove pontos de milhar, troca vírgula por ponto
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (/,\d{2}$/.test(str)) {
    // Só vírgula decimal, sem pontos de milhar
    str = str.replace(',', '.')
  }

  const num = parseFloat(str)
  if (isNaN(num)) return 0

  return isNegativo ? -num : num
}

/**
 * Converte serial date do Excel para Date.
 * Excel usa dias desde 1/1/1900 (com bug do 29/02/1900).
 */
export function excelDateToJs(serial: unknown): Date | null {
  if (serial === null || serial === undefined || serial === '') {
    return null
  }

  if (serial instanceof Date) return serial

  const num = typeof serial === 'number' ? serial : parseFloat(String(serial))
  if (isNaN(num) || num < 1) return null

  // Excel epoch: 1/1/1900, mas conta errado o 29/02/1900
  const msPerDay = 24 * 60 * 60 * 1000
  const excelEpoch = new Date(1899, 11, 30) // 30/12/1899
  return new Date(excelEpoch.getTime() + num * msPerDay)
}
