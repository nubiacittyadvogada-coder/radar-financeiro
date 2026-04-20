/**
 * POST /api/v2/empresa/clientes/importar-cobrancas
 * Recebe array de cobranças já parseado pelo frontend (planilha Asaas .xlsx).
 *
 * Body: { cobrancas: [{ asaasId, nome, cpfCnpj, email, celular, vencimento, valor, situacao, descricao, formaPgto, dataPgto }] }
 *
 * Para cada cobrança:
 * - Cria/atualiza ClienteDevedor (nome, CPF, email, telefone)
 * - Cria CobrancaDevedor se não existir (dedup por asaasPaymentId)
 * - Cria LancamentoEmpresa previsto=true para pendentes (dedup por observacoes)
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export const maxDuration = 60

function mapearStatus(situacao: string): 'pendente' | 'pago' | 'cancelado' {
  const s = (situacao || '').toLowerCase()
  if (s.includes('recebido') || s.includes('confirmado') || s.includes('creditado')) return 'pago'
  if (s.includes('cancel') || s.includes('estorn')) return 'cancelado'
  return 'pendente'
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json()
    const { cobrancas } = body as { cobrancas: any[] }

    if (!Array.isArray(cobrancas) || cobrancas.length === 0) {
      return Response.json({ erro: 'cobrancas[] obrigatório' }, { status: 400 })
    }

    let clientesCriados = 0, clientesAtualizados = 0
    let cobrancasCriadas = 0, cobrancasDuplicatas = 0
    let lancamentosCriados = 0
    const mesesAfetados = new Set<string>()
    const erros: string[] = []

    for (const c of cobrancas) {
      try {
        const nome = String(c.nome || '').trim()
        const cpfCnpj = String(c.cpfCnpj || '').replace(/\D/g, '')
        const email = c.email || null
        const celular = c.celular || null
        const vencimento = c.vencimento as string | null
        const valor = Number(c.valor)
        const asaasId = String(c.asaasId || '').trim()
        const situacao = String(c.situacao || '')
        const descricao = c.descricao || null
        const formaPgto = c.formaPgto || null
        const dataPgto = c.dataPgto || null
        const status = mapearStatus(situacao)

        if (!nome || !vencimento || valor <= 0) continue

        // ── 1. Upsert ClienteDevedor ──────────────────────────────────────────
        let devedor = await prisma.clienteDevedor.findFirst({
          where: {
            contaEmpresaId: conta.id,
            OR: [
              ...(cpfCnpj ? [{ cpfCnpj }] : []),
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
              cpfCnpj: cpfCnpj || devedor.cpfCnpj,
              ativo: true,
            },
          })
          clientesAtualizados++
        } else {
          devedor = await prisma.clienteDevedor.create({
            data: {
              contaEmpresaId: conta.id,
              nome,
              cpfCnpj: cpfCnpj || null,
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
        erros.push(`${c.nome}: ${e.message}`)
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
