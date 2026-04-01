import {
  classificar,
  isReceita,
  isRepasseExito,
  normalizarStatusPg,
  parseValor,
  excelDateToJs,
} from '../src/server/lib/classificador'

// ============================================================
// CLASSIFICADOR — TODOS OS P.CONTAS REAIS DOS ARQUIVOS DO BPO
// ============================================================

describe('classificar()', () => {
  // --- RECEITAS (01_RPS) ---
  describe('Receitas — 01_RPS', () => {
    it('classifica honorários iniciais', () => {
      const r = classificar('01_RPS.HONORÁRIOS INICIAIS')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('honorarios_iniciais')
      expect(r.grupoConta).toBe('01_RPS')
    })

    it('classifica honorários mensais', () => {
      const r = classificar('01_RPS.HONORÁRIOS MENSAIS')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('honorarios_mensais')
    })

    it('classifica consulta', () => {
      const r = classificar('01_RPS.CONSULTA')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('consulta')
    })

    it('classifica êxito', () => {
      const r = classificar('01_RPS.ÊXITO')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('exito')
    })

    it('classifica repasse êxito', () => {
      const r = classificar('01_RPS.REPASSE ÊXITO')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('repasse_exito')
    })

    it('classifica multa cancelamento', () => {
      const r = classificar('01_RPS.MULTA CANCELAMENTO')
      expect(r.tipo).toBe('receita')
      expect(r.subtipo).toBe('multa_cancelamento')
    })
  })

  // --- IMPOSTOS (02_IMP) ---
  describe('Impostos — 02_IMP', () => {
    it('classifica simples nacional', () => {
      const r = classificar('02_IMP.SIMPLES NACIONAL')
      expect(r.tipo).toBe('imposto')
      expect(r.subtipo).toBe('simples_nacional')
      expect(r.grupoConta).toBe('02_IMP')
    })
  })

  // --- CUSTOS DIRETOS (03_CSP) ---
  describe('Custos Diretos — 03_CSP', () => {
    it('classifica advogados', () => {
      const r = classificar('03_CSP.ADVOGADOS')
      expect(r.tipo).toBe('custo_direto')
      expect(r.subtipo).toBe('advogados')
    })

    it('classifica diligência advogado parceiro', () => {
      const r = classificar('03_CSP.DILIGÊNCIA ADVOGADO PARCEIRO')
      expect(r.tipo).toBe('custo_direto')
      expect(r.subtipo).toBe('diligencia_advogado_parceiro')
    })

    it('classifica taxas processuais', () => {
      const r = classificar('03_CSP.TAXAS PROCESSUAIS')
      expect(r.tipo).toBe('custo_direto')
      expect(r.subtipo).toBe('taxas_processuais')
    })

    it('classifica multas processuais', () => {
      const r = classificar('03_CSP.MULTAS PROCESSUAIS')
      expect(r.tipo).toBe('custo_direto')
      expect(r.subtipo).toBe('multas_processuais')
    })

    it('classifica reembolso taxas processuais', () => {
      const r = classificar('03_CSP.REEMBOLSO TAXAS PROCESSUAIS')
      expect(r.tipo).toBe('custo_direto')
      expect(r.subtipo).toBe('reembolso_taxas_processuais')
    })
  })

  // --- PESSOAL (04_PES) ---
  describe('Pessoal — 04_PES', () => {
    const casos: [string, string][] = [
      ['04_PES.SALÁRIOS', 'salarios'],
      ['04_PES.COMISSÕES', 'comissoes'],
      ['04_PES.DIARISTA', 'diarista'],
      ['04_PES.FÉRIAS', 'ferias'],
      ['04_PES.13º SALÁRIO', '13_salario'],
      ['04_PES.BENEFÍCIOS', 'beneficios'],
      ['04_PES.RESCISÕES', 'rescisoes'],
      ['04_PES.INSS', 'inss'],
      ['04_PES.FGTS', 'fgts'],
      ['04_PES.UNIFORMES', 'uniformes'],
      ['04_PES.MEDICINA DO TRABALHO', 'medicina_do_trabalho'],
      ['04_PES.ENTIDADE DE CLASSE', 'entidade_de_classe'],
    ]

    it.each(casos)('classifica %s → pessoal/%s', (pc, subtipo) => {
      const r = classificar(pc)
      expect(r.tipo).toBe('pessoal')
      expect(r.subtipo).toBe(subtipo)
      expect(r.grupoConta).toBe('04_PES')
    })
  })

  // --- MARKETING (04_MKT) ---
  describe('Marketing — 04_MKT', () => {
    const casos: [string, string][] = [
      ['04_MKT.TRÁFEGO PAGO', 'trafego_pago'],
      ['04_MKT.GESTOR DE TRÁFEGO', 'gestor_de_trafego'],
      ['04_MKT.VIDEOMAKER', 'videomaker'],
      ['04_MKT.MARKETING EXTRAS', 'marketing_extras'],
    ]

    it.each(casos)('classifica %s → marketing/%s', (pc, subtipo) => {
      const r = classificar(pc)
      expect(r.tipo).toBe('marketing')
      expect(r.subtipo).toBe(subtipo)
      expect(r.grupoConta).toBe('04_MKT')
    })
  })

  // --- DESPESAS GERAIS (04_GER) ---
  describe('Gerais — 04_GER', () => {
    const casos: [string, string][] = [
      ['04_GER.ALUGUEL', 'aluguel'],
      ['04_GER.SOFTWARE', 'software'],
      ['04_GER.CONSULTORIA', 'consultoria'],
      ['04_GER.LUZ', 'luz'],
      ['04_GER.TELEFONE', 'telefone'],
      ['04_GER.INTERNET', 'internet'],
      ['04_GER.CONTABILIDADE', 'contabilidade'],
      ['04_GER.MATERIAL DE ESCRITÓRIO', 'material_de_escritorio'],
      ['04_GER.DESPESAS BANCÁRIAS', 'despesas_bancarias'],
      ['04_GER.TAXA CARTÃO CRÉDITO', 'taxa_cartao_credito'],
      ['04_GER.TAXAS BOLETO/PIX', 'taxas_boletopix'],
      ['04_GER.TAXAS MUNICIPAIS', 'taxas_municipais'],
      ['04_GER.SUPERMERCADO/LANCHE', 'supermercadolanche'],
      ['04_GER.REEMBOLSO SUPERM/LANCHE', 'reembolso_supermlanche'],
      ['04_GER.BRINDES/PRESENTES', 'brindespresentes'],
      ['04_GER.DESPESAS DE VIAGEM', 'despesas_de_viagem'],
      ['04_GER.EVENTOS', 'eventos'],
      ['04_GER.SEGUROS', 'seguros'],
      ['04_GER.MANUTENÇÃO INSTALAÇÕES', 'manutencao_instalacoes'],
      ['04_GER.MANUTENÇÃO INFORMÁTICA', 'manutencao_informatica'],
    ]

    it.each(casos)('classifica %s → geral/%s', (pc, subtipo) => {
      const r = classificar(pc)
      expect(r.tipo).toBe('geral')
      expect(r.subtipo).toBe(subtipo)
      expect(r.grupoConta).toBe('04_GER')
    })
  })

  // --- RETIRADA (05_RET) ---
  describe('Retirada — 05_RET', () => {
    it('classifica retirada com nome do sócio', () => {
      const r = classificar('05_RET.RETIRADA  NÚBIA')
      expect(r.tipo).toBe('retirada')
      expect(r.subtipo).toBe('retirada_nubia')
      expect(r.grupoConta).toBe('05_RET')
    })

    it('classifica retirada genérica', () => {
      const r = classificar('05_RET.RETIRADA')
      expect(r.tipo).toBe('retirada')
      expect(r.subtipo).toBe('retirada')
    })
  })

  // --- FINANCEIRO (06_DRF) ---
  describe('Financeiro — 06_DRF', () => {
    it('classifica despesas com juros', () => {
      const r = classificar('06_DRF.DESPESAS COM JUROS')
      expect(r.tipo).toBe('financeiro')
      expect(r.subtipo).toBe('despesas_com_juros')
      expect(r.grupoConta).toBe('06_DRF')
    })

    it('classifica receita com juros', () => {
      const r = classificar('06_DRF.RECEITA COM JUROS')
      expect(r.tipo).toBe('financeiro')
      expect(r.subtipo).toBe('receita_com_juros')
    })
  })

  // --- DISTRIBUIÇÃO (07_DLC) ---
  describe('Distribuição — 07_DLC', () => {
    it('classifica distribuição lucros', () => {
      const r = classificar('07_DLC.DISTRIBUIÇÃO LUCROS')
      expect(r.tipo).toBe('distribuicao')
      expect(r.subtipo).toBe('distribuicao_lucros')
      expect(r.grupoConta).toBe('07_DLC')
    })
  })

  // --- INVESTIMENTOS (08_INV) ---
  describe('Investimentos — 08_INV', () => {
    it('classifica investimentos', () => {
      const r = classificar('08_INV.INVESTIMENTOS')
      expect(r.tipo).toBe('investimento')
      expect(r.subtipo).toBe('investimentos')
      expect(r.grupoConta).toBe('08_INV')
    })
  })

  // --- EMPRÉSTIMOS (09_EMP) ---
  describe('Empréstimos — 09_EMP', () => {
    it('classifica empréstimos pagamento', () => {
      const r = classificar('09_EMP.EMPRÉSTIMOS (PAGAMENTO)')
      expect(r.tipo).toBe('emprestimo')
      expect(r.subtipo).toBe('emprestimos_pagamento')
      expect(r.grupoConta).toBe('09_EMP')
    })

    it('classifica empréstimos entrada', () => {
      const r = classificar('09_EMP.EMPRÉSTIMOS (ENTRADA)')
      expect(r.tipo).toBe('emprestimo')
      expect(r.subtipo).toBe('emprestimos_entrada')
    })
  })

  // --- APLICAÇÃO (10_APL) ---
  describe('Aplicação — 10_APL', () => {
    it('classifica aplicação financeira', () => {
      const r = classificar('10_APL.APLICAÇÃO FINANCEIRA')
      expect(r.tipo).toBe('aplicacao')
      expect(r.subtipo).toBe('aplicacao_financeira')
      expect(r.grupoConta).toBe('10_APL')
    })

    it('classifica resgate aplicação', () => {
      const r = classificar('10_APL.RESGATE APLICAÇÃO')
      expect(r.tipo).toBe('aplicacao')
      expect(r.subtipo).toBe('resgate_aplicacao')
    })
  })

  // --- APORTE (11_APT) ---
  describe('Aporte — 11_APT', () => {
    it('classifica aporte sócios', () => {
      const r = classificar('11_APT.APORTE SÓCIOS')
      expect(r.tipo).toBe('aporte')
      expect(r.subtipo).toBe('aporte_socios')
      expect(r.grupoConta).toBe('11_APT')
    })
  })

  // --- PARCELAMENTO (12_PCI) ---
  describe('Parcelamento — 12_PCI', () => {
    it('classifica parcelamento impostos pagamento', () => {
      const r = classificar('12_PCI.PARCELAMENTO IMPOSTOS (PAGAMENTO)')
      expect(r.tipo).toBe('parcelamento')
      expect(r.subtipo).toBe('parcelamento_impostos_pagamento')
      expect(r.grupoConta).toBe('12_PCI')
    })

    it('classifica impostos não pagos captação', () => {
      const r = classificar('12_PCI.IMPOSTOS NÃO PAGOS (CAPTAÇÃO)')
      expect(r.tipo).toBe('parcelamento')
      expect(r.subtipo).toBe('impostos_nao_pagos_captacao')
    })
  })

  // --- EDGE CASES ---
  describe('Edge cases', () => {
    it('lança erro para string vazia', () => {
      expect(() => classificar('')).toThrow('vazio ou inválido')
    })

    it('lança erro para null/undefined', () => {
      expect(() => classificar(null as any)).toThrow('vazio ou inválido')
      expect(() => classificar(undefined as any)).toThrow('vazio ou inválido')
    })

    it('lança erro para prefixo desconhecido', () => {
      expect(() => classificar('99_XXX.ALGO')).toThrow('não reconhecido')
    })

    it('aceita espaços extras antes e depois', () => {
      const r = classificar('  01_RPS.HONORÁRIOS MENSAIS  ')
      expect(r.tipo).toBe('receita')
    })

    it('aceita P.CONTAS sem ponto (só prefixo)', () => {
      // Caso extremo: se vier só "01_RPS" sem sufixo
      expect(() => classificar('01_RPS')).not.toThrow()
      const r = classificar('01_RPS')
      expect(r.tipo).toBe('receita')
    })
  })
})

// ============================================================
// isReceita() e isRepasseExito()
// ============================================================

describe('isReceita()', () => {
  it('retorna true para 01_RPS.*', () => {
    expect(isReceita('01_RPS.HONORÁRIOS MENSAIS')).toBe(true)
    expect(isReceita('01_RPS.ÊXITO')).toBe(true)
  })

  it('retorna false para despesas', () => {
    expect(isReceita('04_GER.ALUGUEL')).toBe(false)
    expect(isReceita('02_IMP.SIMPLES NACIONAL')).toBe(false)
  })

  it('retorna false para código inválido', () => {
    expect(isReceita('')).toBe(false)
    expect(isReceita('INVALIDO')).toBe(false)
  })
})

describe('isRepasseExito()', () => {
  it('identifica repasse êxito', () => {
    expect(isRepasseExito('01_RPS.REPASSE ÊXITO')).toBe(true)
  })

  it('identifica sem acento', () => {
    expect(isRepasseExito('01_RPS.REPASSE EXITO')).toBe(true)
  })

  it('não confunde com êxito normal', () => {
    expect(isRepasseExito('01_RPS.ÊXITO')).toBe(false)
  })
})

// ============================================================
// normalizarStatusPg()
// ============================================================

describe('normalizarStatusPg()', () => {
  describe('Despesas (SIT. + PG em colunas separadas)', () => {
    it('OK + PG → pago', () => {
      const r = normalizarStatusPg('OK', 'PG', 'despesas')
      expect(r.statusPg).toBe('OK PG')
      expect(r.previsto).toBe(false)
    })

    it('PREV + vazio → previsto', () => {
      const r = normalizarStatusPg('PREV', '', 'despesas')
      expect(r.statusPg).toBe('PREV')
      expect(r.previsto).toBe(true)
    })

    it('OK + vazio → pago (caso real: 6 linhas)', () => {
      const r = normalizarStatusPg('OK', '', 'despesas')
      expect(r.statusPg).toBe('OK PG')
      expect(r.previsto).toBe(false)
    })

    it('vazio + vazio → previsto', () => {
      const r = normalizarStatusPg('', '', 'despesas')
      expect(r.statusPg).toBe('PREV')
      expect(r.previsto).toBe(true)
    })

    it('null + null → previsto', () => {
      const r = normalizarStatusPg(null, null, 'despesas')
      expect(r.statusPg).toBe('PREV')
      expect(r.previsto).toBe(true)
    })
  })

  describe('Receitas (PG em coluna única)', () => {
    it('PG → pago', () => {
      const r = normalizarStatusPg('PG', undefined, 'receitas')
      expect(r.statusPg).toBe('OK PG')
      expect(r.previsto).toBe(false)
    })

    it('vazio → previsto', () => {
      const r = normalizarStatusPg('', undefined, 'receitas')
      expect(r.statusPg).toBe('PREV')
      expect(r.previsto).toBe(true)
    })

    it('null → previsto', () => {
      const r = normalizarStatusPg(null, undefined, 'receitas')
      expect(r.statusPg).toBe('PREV')
      expect(r.previsto).toBe(true)
    })
  })
})

// ============================================================
// parseValor()
// ============================================================

describe('parseValor()', () => {
  it('converte número direto', () => {
    expect(parseValor(514.98)).toBe(514.98)
    expect(parseValor(0)).toBe(0)
    expect(parseValor(-336)).toBe(-336)
  })

  it('converte null/undefined/vazio para 0', () => {
    expect(parseValor(null)).toBe(0)
    expect(parseValor(undefined)).toBe(0)
    expect(parseValor('')).toBe(0)
  })

  it('converte string com formato brasileiro', () => {
    expect(parseValor('1.234,56')).toBe(1234.56)
    expect(parseValor('10.500,00')).toBe(10500)
  })

  it('converte string com parênteses (negativo)', () => {
    expect(parseValor('(5.000,00)')).toBe(-5000)
    expect(parseValor('(100,50)')).toBe(-100.50)
  })

  it('converte string com vírgula decimal sem milhar', () => {
    expect(parseValor('514,98')).toBe(514.98)
  })

  it('converte string com R$', () => {
    expect(parseValor('R$ 1.234,56')).toBe(1234.56)
  })

  it('converte string numérica simples', () => {
    expect(parseValor('514.98')).toBe(514.98)
    expect(parseValor('3.98')).toBe(3.98)
  })

  it('retorna 0 para string não numérica', () => {
    expect(parseValor('abc')).toBe(0)
  })
})

// ============================================================
// excelDateToJs()
// ============================================================

describe('excelDateToJs()', () => {
  it('converte serial 45597 para data válida', () => {
    // 45597 = ~outubro/novembro 2024
    const d = excelDateToJs(45597)
    expect(d).toBeInstanceOf(Date)
    expect(d!.getFullYear()).toBeGreaterThanOrEqual(2024)
  })

  it('converte serial 46023 para janeiro 2026', () => {
    const d = excelDateToJs(46023)
    expect(d).toBeInstanceOf(Date)
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(0) // janeiro
  })

  it('retorna null para vazio/null/undefined', () => {
    expect(excelDateToJs(null)).toBeNull()
    expect(excelDateToJs(undefined)).toBeNull()
    expect(excelDateToJs('')).toBeNull()
  })

  it('retorna null para 0', () => {
    expect(excelDateToJs(0)).toBeNull()
  })

  it('aceita Date direto', () => {
    const d = new Date(2026, 0, 1)
    expect(excelDateToJs(d)).toBe(d)
  })

  it('aceita string numérica', () => {
    const d = excelDateToJs('45597')
    expect(d).toBeInstanceOf(Date)
  })
})
