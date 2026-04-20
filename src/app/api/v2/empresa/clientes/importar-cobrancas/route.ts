/**
 * POST /api/v2/empresa/clientes/importar-cobrancas
 * Importa exportação de cobranças do Asaas (.xlsx) para o sistema.
 *
 * Para cada linha da planilha:
 * - Cria/atualiza ClienteDevedor (nome, CPF, email, telefone, asaasCustomerId via ID externo)
 * - Cria CobrancaDevedor para cobranças pendentes/vencidas (evita duplicatas por asaasPaymentId)
 * - Cria LancamentoEmpresa previsto=true para previsão no DRE
 *
 * Colunas esperadas (exportação Asaas):
 * Identificador, Identificador externo, Nome, CPF ou CNPJ, Email, Celular, Fone,
 * Forma de pagamento, Vencimento, Vencimento original, Data de Pagamento,
 * Valor, Valor original, Valor Líquido, Situação, Número do Boleto, Descrição, ...
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'
import * as XLSX from 'xlsx'

export const maxDuration = 60

// Mapeia situações do Asaas para status interno
function mapearStatus(situacao: string): 'pendente' | 'pago' | 'cancelado' {
  const s = (situacao || '').toLowerCase()
  if (s.includes('recebido') || s.includes('confirmado') || s.includes('creditado')) return 'pago'
  if (s.includes('cancel') || s.includes('estorn')) return 'cancelado'
  return 'pendente'
}

function parsearData(v: any): string | null {
  if (!v) return null
  const s = String(v)
  // DD/MM/YYYY
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // YYYY-MM-DD
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10)
  return null
}

function parsearValor(v: any): number {
  if (typeof v === 'number') return Math.abs(v)
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  return Math.abs(parseFloat(s) || 0)
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (rows.length < 2) return Response.json({ erro: 'Planilha vazia ou sem dados' }, { status: 400 })

    // Mapeia colunas pelo header
    const header = rows[0].map((c: any) => String(c).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const ci = (nomes: string[]) => {
      for (const n of nomes) {
        const idx = header.findIndex(h => h.includes(n))
        if (idx >= 0) return idx
      }
      return -1
    }

    const cols = {
      asaasId:      ci(['identificador', 'id']),
      nome:         ci(['nome']),
      cpfCnpj:      ci(['cpf', 'cnpj']),
      email:        ci(['email']),
      celular:      ci(['celular', 'fone']),
      vencimento:   ci(['vencimento']),
      valor:        ci(['valor']),
      situacao:     ci(['situacao', 'status', 'situação']),
      descricao:    ci(['descricao', 'descrição']),
      formaPgto:    ci(['forma de pagamento', 'forma']),
      dataPgto:     ci(['data de pagamento']),
    }

    // Filtra apenas colunas "Vencimento" (não "Vencimento original")
    // Pega a primeira ocorrência de "vencimento" que não contenha "original"
    const colVencimento = header.findIndex(h => h.includes('vencimento') && !h.includes('original'))
    if (colVencimento >= 0) cols.vencimento = colVencimento

    let clientesCriados = 0, clientesAtualizados = 0
    let cobrancasCriadas = 0, cobrancasDuplicatas = 0
    let lancamentosCriados = 0
    const mesesAfetados = new Set<string>()
    const erros: string[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      try {
        const asaasId = String(row[cols.asaasId] || '').trim()
        const nome = String(row[cols.nome] || '').trim()
        const cpfCnpjRaw = String(row[cols.cpfCnpj] || '').replace(/\D/g, '')
        const email = String(row[cols.email] || '').trim() || null
        const celular = String(row[cols.celular] || '').replace(/\D/g, '') || null
        const vencimento = parsearData(row[cols.vencimento])
        const valor = parsearValor(row[cols.valor])
        const situacao = String(row[cols.situacao] || '').trim()
        const descricao = String(row[cols.descricao] || '').trim() || null
        const formaPgto = String(row[cols.formaPgto] || '').trim() || null
        const dataPgto = parsearData(row[cols.dataPgto])

        if (!nome || !vencimento || valor <= 0) continue

        const status = mapearStatus(situacao)

        // ── 1. Upsert ClienteDevedor ──────────────────────────────────────────
        let devedor = await prisma.clienteDevedor.findFirst({
          where: {
            contaEmpresaId: conta.id,
            OR: [
              ...(cpfCnpjRaw ? [{ cpfCnpj: cpfCnpjRaw }] : []),
              { nome: { equals: nome, mode: 'insensitive' } },
            ],
          },
        })

        if (devedor) {
          await prisma.clienteDevedor.update({
            where: { id: devedor.id },
            data: {
              email: email || devedor.email,
              telefone: celular || devedor.telefone,
              cpfCnpj: cpfCnpjRaw || devedor.cpfCnpj,
              ativo: true,
            },
          })
          clientesAtualizados++
        } else {
          devedor = await prisma.clienteDevedor.create({
            data: {
              contaEmpresaId: conta.id,
              nome,
              cpfCnpj: cpfCnpjRaw || null,
              email,
              telefone: celular,
              tipoVinculo: 'cliente',
            },
          })
          clientesCriados++
        }

        // ── 2. Upsert CobrancaDevedor ─────────────────────────────────────────
        const jaExisteCobranca = asaasId
          ? await prisma.cobrancaDevedor.findFirst({
              where: { clienteDevedorId: devedor.id, asaasPaymentId: asaasId },
            })
          : null

        if (!jaExisteCobranca) {
          await prisma.cobrancaDevedor.create({
            data: {
              clienteDevedorId: devedor.id,
              descricao: descricao || `Cobrança ${vencimento}`,
              valor,
              vencimento: new Date(vencimento + 'T12:00:00Z'),
              status,
              asaasPaymentId: asaasId || null,
              pagoEm: dataPgto ? new Date(dataPgto + 'T12:00:00Z') : null,
              valorPago: status === 'pago' ? valor : null,
            },
          })
          cobrancasCriadas++
        } else {
          cobrancasDuplicatas++
        }

        // ── 3. LancamentoEmpresa previsto (apenas pendentes) ──────────────────
        if (status === 'pendente') {
          const dataVenc = new Date(vencimento + 'T12:00:00Z')
          const mes = dataVenc.getUTCMonth() + 1
          const ano = dataVenc.getUTCFullYear()
          const refObs = `cobranca_asaas:${asaasId || `${nome}_${vencimento}_${valor}`}`

          const jaExisteLanc = await prisma.lancamentoEmpresa.findFirst({
            where: { contaEmpresaId: conta.id, observacoes: refObs },
          })

          if (!jaExisteLanc) {
            await prisma.lancamentoEmpresa.create({
              data: {
                contaEmpresaId: conta.id,
                origem: 'importacao',
                mes, ano,
                favorecido: nome,
                planoConta: '01_RPS.HONORÁRIOS MENSAIS',
                grupoConta: 'Receitas',
                tipo: 'receita',
                subtipo: 'honorario_mensal',
                descricao: descricao || `Cobrança ${nome}`,
                valor,
                dataCompetencia: dataVenc,
                dataVencimento: dataVenc,
                statusPg: 'pendente',
                formaPagamento: formaPgto,
                banco: 'ASAAS',
                previsto: true,
                conciliado: false,
                observacoes: refObs,
              },
            })
            lancamentosCriados++
            mesesAfetados.add(`${mes}-${ano}`)
          }
        }
      } catch (e: any) {
        erros.push(`Linha ${i + 1}: ${e.message}`)
      }
    }

    // Recalcula fechamentos dos meses afetados
    for (const chave of mesesAfetados) {
      const [m, a] = chave.split('-').map(Number)
      await calcularFechamentoEmpresa(conta.id, m, a)
    }

    return Response.json({
      ok: true,
      clientes: { criados: clientesCriados, atualizados: clientesAtualizados },
      cobrancas: { criadas: cobrancasCriadas, duplicatas: cobrancasDuplicatas },
      lancamentosPrevisto: lancamentosCriados,
      mesesAfetados: Array.from(mesesAfetados),
      erros,
    }, { status: 201 })
  } catch (err: any) {
    console.error('[importar-cobrancas]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
