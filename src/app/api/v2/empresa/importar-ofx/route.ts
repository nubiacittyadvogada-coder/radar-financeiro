/**
 * POST /api/v2/empresa/importar-ofx
 * Parseia arquivo OFX Sicredi (ou qualquer banco) e retorna preview das transações.
 *
 * Tratamentos especiais para Sicredi:
 * - SICREDI DEBITO MASTER / ANTEC MASTER → ignora (crédito de fatura cartão)
 * - DEB.CTA.FATURA → ignora (pagamento fatura cartão)
 * - DEVOLUCAO PIX → cancela com PAGAMENTO correspondente (mesmo CNPJ + valor + dia)
 * - APLIC.FINANC.AVISO PREVIO → 10_APL.APLICAÇÃO FINANCEIRA
 * - LIQUIDACAO DE PARCELA → 09_EMP.PAGAMENTO EMPRÉSTIMO
 * - Próprio CNPJ (40993929000183) em crédito → transferência do Asaas, separa para conciliação
 * - TED TRIBUNAL → 01_RPS.ÊXITO
 * - Débito para CPF de clienteDevedor → 03_CSP.REPASSE DE ÊXITO
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 30

// ─── Parser OFX ──────────────────────────────────────────────────────────────

interface OFXTransacao {
  fitid: string
  trntype: string        // CREDIT, DEBIT, FEE, XFER, etc.
  tipo: 'credito' | 'debito'
  data: string           // YYYY-MM-DD
  valor: number          // sempre positivo
  descricao: string
  cnpjCpf: string | null // extraído do MEMO
  bruto: string          // MEMO original
}

function extrairTag(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'))
  return m ? m[1].trim() : ''
}

function parsearDataOFX(dtRaw: string): string {
  const digits = dtRaw.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length < 8) return new Date().toISOString().slice(0, 10)
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function extrairCnpjCpf(texto: string): string | null {
  // CNPJ: 14 dígitos (com ou sem formatação)
  const cnpj = texto.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\b\d{14}\b)/)
  if (cnpj) {
    const d = cnpj[0].replace(/\D/g, '')
    if (d.length === 14) return d
  }
  // CPF: 11 dígitos
  const cpf = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\b\d{11}\b)/)
  if (cpf) {
    const d = cpf[0].replace(/\D/g, '')
    if (d.length === 11) return d
  }
  return null
}

function parsearOFX(conteudo: string): OFXTransacao[] {
  const transacoes: OFXTransacao[] = []

  // XML-style: <STMTTRN>...</STMTTRN>
  let blocos: string[] = []
  const matchesXml = conteudo.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)
  if (matchesXml && matchesXml.length > 0) {
    blocos = matchesXml
  } else {
    const partes = conteudo.split(/<STMTTRN>/i)
    if (partes.length > 1) {
      blocos = partes.slice(1).map(p => {
        const fim = p.search(/<\/(BANKTRANLIST|STMTTRNRS|OFX)>/i)
        return fim > 0 ? p.slice(0, fim) : p
      })
    }
  }

  for (const bloco of blocos) {
    const trnamt = parseFloat(extrairTag(bloco, 'TRNAMT').replace(',', '.'))
    if (isNaN(trnamt) || trnamt === 0) continue

    const fitid = extrairTag(bloco, 'FITID') || extrairTag(bloco, 'REFNUM') || String(Date.now() + Math.random())
    const trntype = extrairTag(bloco, 'TRNTYPE').toUpperCase() || (trnamt > 0 ? 'CREDIT' : 'DEBIT')
    const dtposted = extrairTag(bloco, 'DTPOSTED')
    const memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || ''
    const data = parsearDataOFX(dtposted)
    const tipo: 'credito' | 'debito' = trnamt > 0 ? 'credito' : 'debito'
    const cnpjCpf = extrairCnpjCpf(memo)

    transacoes.push({
      fitid,
      trntype,
      tipo,
      data,
      valor: Math.abs(trnamt),
      descricao: memo,
      cnpjCpf,
      bruto: memo,
    })
  }

  return transacoes
}

// ─── Filtros e regras Sicredi ─────────────────────────────────────────────────

// CNPJ da própria empresa — créditos deste CNPJ são transferências do Asaas para o Sicredi
const CNPJ_PROPRIO = '40993929000183'

// Retorna true para entradas que devem ser completamente ignoradas (fatura cartão, transferências internas, etc.)
function deveIgnorar(t: OFXTransacao): boolean {
  const d = t.descricao.toUpperCase()
  if (d.includes('SICREDI DEBITO MASTER')) return true
  if (d.includes('SICREDI ANTEC MASTER')) return true
  if (d.includes('DEB.CTA.FATURA')) return true
  if (d.includes('DEBITO MASTER')) return true
  if (d.includes('PAGTO FATURA')) return true
  if (d.includes('FAT CARTAO')) return true
  // Débito para o próprio CNPJ = transferência interna (ex: Sicredi → Asaas)
  if (t.tipo === 'debito' && t.cnpjCpf === CNPJ_PROPRIO) return true
  return false
}

// Identifica transferências do Asaas para o Sicredi (crédito do CNPJ próprio)
function isTransferenciaAsaas(t: OFXTransacao): boolean {
  return t.tipo === 'credito' && t.cnpjCpf === CNPJ_PROPRIO
}

function isDevoulucao(t: OFXTransacao): boolean {
  return t.descricao.toUpperCase().includes('DEVOLUCAO PIX')
}

// Remove devoluções que cancelam pagamentos (mesmo CNPJ + valor + data)
function netearDevolucoes(ts: OFXTransacao[]): OFXTransacao[] {
  const usados = new Set<string>()
  const resultado: OFXTransacao[] = []

  for (const t of ts) {
    if (usados.has(t.fitid)) continue

    if (isDevoulucao(t) && t.tipo === 'credito') {
      const par = ts.find(p =>
        !usados.has(p.fitid) &&
        p.tipo === 'debito' &&
        p.valor === t.valor &&
        p.data === t.data &&
        p.cnpjCpf === t.cnpjCpf &&
        p.cnpjCpf !== null
      )
      if (par) {
        usados.add(t.fitid)
        usados.add(par.fitid)
        continue
      }
    }

    resultado.push(t)
  }

  return resultado
}

// ─── Classificação de débitos ─────────────────────────────────────────────────

type Classificacao = {
  planoConta: string
  tipo: string
  subtipo: string
  grupoConta: string
}

/**
 * @param descricao MEMO da transação
 * @param cnpjCpf CPF ou CNPJ extraído do MEMO
 * @param isCliente true se cnpjCpf pertence a um clienteDevedor — classifica como repasse de êxito
 */
function classificarDebito(descricao: string, cnpjCpf: string | null, isCliente = false): Classificacao {
  const d = descricao.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Repasse de êxito para cliente (CPF/CNPJ identificado como clienteDevedor)
  if (isCliente) {
    return { planoConta: '03_CSP.REPASSE DE ÊXITO', tipo: 'custo_direto', subtipo: 'repasse_exito', grupoConta: 'Despesas' }
  }

  // Aplicação financeira
  if (d.includes('APLIC.FINANC') || d.includes('APLICACAO FINANC') || d.includes('APLIC FINANC'))
    return { planoConta: '10_APL.APLICAÇÃO FINANCEIRA', tipo: 'aplicacao', subtipo: 'aplicacao', grupoConta: 'Despesas' }

  // Parcela de empréstimo
  if (d.includes('LIQUIDACAO DE PARCELA') || (d.includes('PARCELA') && !d.includes('JUDICIAL')))
    return { planoConta: '09_EMP.PAGAMENTO EMPRÉSTIMO', tipo: 'emprestimo', subtipo: 'parcela', grupoConta: 'Despesas' }

  // Impostos e tributos
  if (d.match(/\bDAS\b/) || d.includes('SIMPLES NACIONAL'))
    return { planoConta: '02_IMP.SIMPLES NACIONAL', tipo: 'imposto', subtipo: 'simples_nacional', grupoConta: 'Despesas' }
  if (d.includes('DARFC') || d.includes('DARF'))
    return { planoConta: '02_IMP.DARF', tipo: 'imposto', subtipo: 'darf', grupoConta: 'Despesas' }
  if (d.includes('PMITABIRA') || d.includes('PREFEITURA') || d.includes('ISS'))
    return { planoConta: '02_IMP.ISS', tipo: 'imposto', subtipo: 'iss', grupoConta: 'Despesas' }
  if (d.includes('IRPJ') || d.includes('CSLL') || d.includes('COFINS') || d.includes('PIS') || d.includes('INSS'))
    return { planoConta: '02_IMP.TRIBUTOS FEDERAIS', tipo: 'imposto', subtipo: 'tributos_federais', grupoConta: 'Despesas' }

  // Custas processuais
  if (d.includes('TRIBUNAL') || d.includes('TJMG') || d.includes('CARTORIO') || d.includes('ANACRIM') || d.includes('CARTÓRIO'))
    return { planoConta: '03_CSP.CUSTAS PROCESSUAIS', tipo: 'custo_direto', subtipo: 'custas_processuais', grupoConta: 'Despesas' }

  // Pessoal / folha / retirada
  if (d.includes('NUBIA DOS SANTOS CITTY') || d.includes('PRO-LABORE') || d.includes('PROLABORE'))
    return { planoConta: '05_RET.RETIRADA NÚBIA', tipo: 'retirada', subtipo: 'retirada', grupoConta: 'Despesas' }
  if (d.includes('RESCISAO') || d.includes('FERIAS') || d.includes('13 SAL') || d.includes('DECIMO'))
    return { planoConta: '04_PES.ENCARGOS E BENEFÍCIOS', tipo: 'pessoal', subtipo: 'encargos', grupoConta: 'Despesas' }

  // Flash APP (vale alimentação / benefícios)
  if (d.includes('FLASH APP') || d.includes('FLASH TEC') || d.includes('32223020000118'))
    return { planoConta: '04_PES.BENEFÍCIOS', tipo: 'pessoal', subtipo: 'beneficios', grupoConta: 'Despesas' }

  // Software / sistemas
  if (d.includes('ADVBOX') || d.includes('30750260000145'))
    return { planoConta: '04_GER.SOFTWARES E SISTEMAS', tipo: 'geral', subtipo: 'softwares_sistemas', grupoConta: 'Despesas' }
  if (d.includes('POTELO') || d.includes('10880435000121'))
    return { planoConta: '04_GER.SOFTWARES E SISTEMAS', tipo: 'geral', subtipo: 'softwares_sistemas', grupoConta: 'Despesas' }

  // Seguros
  if (d.includes('MAPFRE') || d.includes('SEGURO') || d.includes('AIG'))
    return { planoConta: '04_GER.SEGUROS', tipo: 'geral', subtipo: 'seguros', grupoConta: 'Despesas' }

  // Energia / utilidades
  if (d.includes('CEMIG') || d.includes('ENERGIA') || d.includes('CELPE') || d.includes('COPEL'))
    return { planoConta: '04_GER.ENERGIA E UTILIDADES', tipo: 'geral', subtipo: 'energia', grupoConta: 'Despesas' }

  // Internet / telefonia
  if (d.includes('VALENET') || d.includes('INTERNET') || d.includes('TELEFONE') || d.includes('VIVO') || d.includes('OI ') || d.includes('CLARO'))
    return { planoConta: '04_GER.INTERNET E TELEFONE', tipo: 'geral', subtipo: 'internet_telefone', grupoConta: 'Despesas' }

  // Contabilidade
  if (d.includes('CONTADOR') || d.includes('CONTABIL') || d.includes('ESCRITORIO CONTABIL'))
    return { planoConta: '04_GER.HONORÁRIOS CONTABILIDADE', tipo: 'geral', subtipo: 'contabilidade', grupoConta: 'Despesas' }

  // Marketing
  if (d.includes('GOOGLE') || d.includes('META') || d.includes('FACEBOOK') || d.includes('INSTAGRAM') || d.includes('MARKETING') || d.includes('PUBLICIDADE'))
    return { planoConta: '04_MKT.MARKETING DIGITAL', tipo: 'marketing', subtipo: 'marketing_digital', grupoConta: 'Despesas' }

  // Aluguel
  if (d.includes('ALUGUEL') || d.includes('LOCACAO') || d.includes('IPTU') || d.includes('CONDOMINIO') || d.includes('LLA MPA'))
    return { planoConta: '04_GER.ALUGUEL', tipo: 'geral', subtipo: 'aluguel', grupoConta: 'Despesas' }

  // Consórcio
  if (d.includes('CONSORCIO'))
    return { planoConta: '10_APL.CONSÓRCIO', tipo: 'aplicacao', subtipo: 'consorcio', grupoConta: 'Despesas' }

  // Tarifas bancárias
  if (d.includes('CESTA DE RELACIONAMENTO') || d.includes('TARIFA') || d.includes('MANUTENCAO CONTA'))
    return { planoConta: '04_GER.DESPESAS BANCÁRIAS', tipo: 'geral', subtipo: 'despesas_bancarias', grupoConta: 'Despesas' }

  // Hotel / hospedagem / viagem
  if (d.includes('HOTEL') || d.includes('HOSPEDAGEM') || d.includes('ICH ADMINISTRACAO'))
    return { planoConta: '04_GER.VIAGENS E DESLOCAMENTO', tipo: 'geral', subtipo: 'viagens', grupoConta: 'Despesas' }

  // Pessoa física (CPF) não identificada como cliente → provavelmente funcionário/prestador
  if (cnpjCpf && cnpjCpf.length === 11) {
    return { planoConta: '04_PES.SALÁRIOS E HONORÁRIOS', tipo: 'pessoal', subtipo: 'salarios', grupoConta: 'Despesas' }
  }

  return { planoConta: '04_GER.DESPESAS GERAIS', tipo: 'geral', subtipo: 'despesas_gerais', grupoConta: 'Despesas' }
}

// ─── Classificação de créditos ────────────────────────────────────────────────

function mapearPlanoConta(t: OFXTransacao, clienteNome: string | null): Classificacao {
  const d = t.descricao.toUpperCase()

  // TED do Tribunal = honorário de êxito / RPV
  if (d.includes('TED') && (d.includes('TRIBUNAL') || d.includes('TJ')))
    return { planoConta: '01_RPS.ÊXITO', tipo: 'receita', subtipo: 'exito', grupoConta: 'Receitas' }

  // PIX identificado com cliente = honorário mensal
  if (clienteNome)
    return { planoConta: '01_RPS.HONORÁRIOS MENSAIS', tipo: 'receita', subtipo: 'honorario_mensal', grupoConta: 'Receitas' }

  // Padrão: honorários mensais
  return { planoConta: '01_RPS.HONORÁRIOS MENSAIS', tipo: 'receita', subtipo: 'honorario_mensal', grupoConta: 'Receitas' }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.ofx') && !ext.endsWith('.qfx') && !ext.endsWith('.txt')) {
      return Response.json({ erro: 'Envie um arquivo .ofx ou .qfx exportado pelo banco' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    let conteudo = ''
    try { conteudo = new TextDecoder('utf-8').decode(buffer) }
    catch { conteudo = new TextDecoder('latin1').decode(buffer) }

    // 1) Parseia
    const bruto = parsearOFX(conteudo)
    if (bruto.length === 0) {
      return Response.json({ erro: 'Nenhuma transação encontrada. Verifique se o arquivo é um extrato OFX válido.' }, { status: 400 })
    }

    // 2) Separa transferências Asaas antes de qualquer filtro
    const transferenciasAsaas = bruto.filter(isTransferenciaAsaas)

    // 3) Remove entradas que devem ser ignoradas (cartão, tarifas de fatura)
    const semIgnorados = bruto.filter(t => !deveIgnorar(t) && !isTransferenciaAsaas(t))

    // 4) Cancela devoluções PIX com seus pagamentos correspondentes
    const liquidas = netearDevolucoes(semIgnorados)

    // 5) FITIDs já importados (dedup por observacoes = "ofx:FITID")
    const fitidsExistentes = await prisma.lancamentoEmpresa.findMany({
      where: {
        contaEmpresaId: conta.id,
        observacoes: { startsWith: 'ofx:' },
      },
      select: { observacoes: true },
    })
    const fitidsJaImportados = new Set(
      fitidsExistentes.map(l => l.observacoes?.replace('ofx:', '') || '')
    )

    const novas = liquidas.filter(t => !fitidsJaImportados.has(t.fitid))

    // 6) Busca clientes para casar CPF/CNPJ (créditos E débitos)
    const clientes = await prisma.clienteDevedor.findMany({
      where: { contaEmpresaId: conta.id, cpfCnpj: { not: null } },
      select: { id: true, nome: true, cpfCnpj: true },
    })
    const indiceCpfCnpj: Record<string, { id: string; nome: string }> = {}
    for (const c of clientes) {
      if (c.cpfCnpj) indiceCpfCnpj[c.cpfCnpj.replace(/\D/g, '')] = { id: c.id, nome: c.nome }
    }

    // 7) Conta lancamentos asaas_webhook não conciliados (para mostrar no preview)
    let asaasParaConciliar = 0
    if (transferenciasAsaas.length > 0) {
      asaasParaConciliar = await prisma.lancamentoEmpresa.count({
        where: {
          contaEmpresaId: conta.id,
          origem: 'asaas_webhook',
          conciliado: false,
        },
      })
    }

    // Extrai período
    const datas = novas.map(t => t.data).sort()
    const periodo = datas.length > 0 ? `${datas[0]} a ${datas[datas.length - 1]}` : 'sem datas'

    // 8) Enriquece e classifica
    const transacoes = novas.map(t => {
      const clienteEncontrado = t.cnpjCpf ? (indiceCpfCnpj[t.cnpjCpf] || null) : null

      if (t.tipo === 'credito') {
        const cls = mapearPlanoConta(t, clienteEncontrado?.nome || null)
        return {
          fitid: t.fitid,
          tipo: 'receita',
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          cnpjCpf: t.cnpjCpf,
          clienteNome: clienteEncontrado?.nome || null,
          planoConta: cls.planoConta,
          grupoConta: cls.grupoConta,
          tipoLancamento: cls.tipo,
          subtipo: cls.subtipo,
        }
      } else {
        const isCliente = !!(t.cnpjCpf && indiceCpfCnpj[t.cnpjCpf])
        const cls = classificarDebito(t.descricao, t.cnpjCpf, isCliente)
        return {
          fitid: t.fitid,
          tipo: 'despesa',
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          cnpjCpf: t.cnpjCpf,
          clienteNome: isCliente ? indiceCpfCnpj[t.cnpjCpf!]!.nome : null,
          planoConta: cls.planoConta,
          grupoConta: cls.grupoConta,
          tipoLancamento: cls.tipo,
          subtipo: cls.subtipo,
        }
      }
    })

    const totalCreditos = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
    const totalDebitos = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)
    const creditosComCliente = transacoes.filter(t => t.tipo === 'receita' && t.clienteNome).length
    const repassesClientes = transacoes.filter(t => t.subtipo === 'repasse_exito').length
    const ignorados = bruto.length - transferenciasAsaas.length - semIgnorados.length
    const devolucoesNeteadas = (semIgnorados.length - liquidas.length) / 2
    const jaImportados = liquidas.length - novas.length

    return Response.json({
      transacoes,
      periodo,
      banco: 'Sicredi',
      totalCreditos,
      totalDebitos,
      creditosComCliente,
      repassesClientes,
      // Transferências Asaas → Sicredi (para conciliar na confirmação)
      transferenciasAsaas: transferenciasAsaas.map(t => ({
        fitid: t.fitid,
        data: t.data,
        valor: t.valor,
        descricao: t.descricao,
      })),
      asaasParaConciliar,
      stats: {
        bruto: bruto.length,
        ignorados,                          // fatura cartão excluída
        transferenciasAsaas: transferenciasAsaas.length,  // Asaas→Sicredi
        totalTransferidoAsaas: transferenciasAsaas.reduce((s, t) => s + t.valor, 0),
        devolucoesNeteadas,
        jaImportados,
        novas: novas.length,
        asaasParaConciliar,
      },
    })
  } catch (err: any) {
    console.error('[importar-ofx]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
