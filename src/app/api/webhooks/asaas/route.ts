/**
 * Webhook Asaas — recebe notificações de pagamento.
 * Configurar no painel Asaas: URL = https://seu-dominio.com/api/webhooks/asaas
 *
 * Eventos tratados:
 * - PAYMENT_RECEIVED: pagamento recebido (pix, boleto)
 * - PAYMENT_CONFIRMED: pagamento confirmado
 * - PAYMENT_OVERDUE: pagamento vencido
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'
import { enviarEmailPagamentoRecebido } from '@/lib/email'

// Mapeia a descrição da cobrança para um código de plano de contas
function mapearPlanoConta(descricao: string): { planoConta: string; tipo: string; subtipo: string; grupoConta: string } {
  const d = (descricao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (d.includes('exito') || d.includes('êxito') || d.includes('exito')) {
    return { planoConta: '01_RPS.ÊXITO', tipo: 'receita', subtipo: 'exito', grupoConta: 'Receitas' }
  }
  if (d.includes('inicial') || d.includes('contrato') || d.includes('abertura')) {
    return { planoConta: '01_RPS.HONORÁRIOS INICIAIS', tipo: 'receita', subtipo: 'honorario_inicial', grupoConta: 'Receitas' }
  }
  if (d.includes('consulta')) {
    return { planoConta: '01_RPS.CONSULTA', tipo: 'receita', subtipo: 'consulta', grupoConta: 'Receitas' }
  }
  if (d.includes('repasse')) {
    return { planoConta: '01_RPS.REPASSE DE ÊXITO', tipo: 'receita', subtipo: 'repasse_exito', grupoConta: 'Receitas' }
  }
  // Padrão: honorários mensais
  return { planoConta: '01_RPS.HONORÁRIOS MENSAIS', tipo: 'receita', subtipo: 'honorario_mensal', grupoConta: 'Receitas' }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, payment } = body

    if (!event || !payment) {
      return Response.json({ ok: true }) // ignora eventos sem dados
    }

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      // Localiza a cobrança pelo ID do Asaas
      const cobranca = await prisma.cobrancaDevedor.findUnique({
        where: { asaasPaymentId: payment.id },
        include: { clienteDevedor: { include: { contaEmpresa: true } } },
      })

      if (cobranca) {
        const valorPago = payment.value || Number(cobranca.valor)

        await prisma.cobrancaDevedor.update({
          where: { id: cobranca.id },
          data: {
            status: 'pago',
            pagoEm: new Date(),
            valorPago,
          },
        })

        // Atualiza totalPago do devedor
        await prisma.clienteDevedor.update({
          where: { id: cobranca.clienteDevedorId },
          data: {
            totalPago: { increment: valorPago },
            totalDevido: { decrement: valorPago },
          },
        })

        // Registra acordo se houve desconto
        if (Number(cobranca.valor) > valorPago) {
          await prisma.acordoCobranca.create({
            data: {
              clienteDevedorId: cobranca.clienteDevedorId,
              cobrancaId: cobranca.id,
              tipo: 'desconto',
              valorOriginal: cobranca.valor,
              valorAcordado: valorPago,
              status: 'cumprido',
            },
          })
        }

        // ── Cria LancamentoEmpresa automático ───────────────────────────────
        const contaEmpresa = cobranca.clienteDevedor.contaEmpresa
        const refObservacao = `asaas:${payment.id}`

        // Dedup: não criar se já existe um lançamento para este pagamento
        const jaExiste = await prisma.lancamentoEmpresa.findFirst({
          where: { contaEmpresaId: contaEmpresa.id, observacoes: refObservacao },
        })

        if (!jaExiste) {
          const dataRecebimento = payment.paymentDate
            ? new Date(payment.paymentDate)
            : new Date()

          const mes = dataRecebimento.getMonth() + 1
          const ano = dataRecebimento.getFullYear()

          const { planoConta, tipo, subtipo, grupoConta } = mapearPlanoConta(cobranca.descricao)

          await prisma.lancamentoEmpresa.create({
            data: {
              contaEmpresaId: contaEmpresa.id,
              origem: 'asaas_webhook',
              mes,
              ano,
              favorecido: cobranca.clienteDevedor.nome,
              planoConta,
              grupoConta,
              tipo,
              subtipo,
              descricao: cobranca.descricao,
              valor: valorPago,
              dataCompetencia: dataRecebimento,
              dataPagamento: dataRecebimento,
              statusPg: 'pago',
              formaPagamento: 'PIX/Boleto',
              banco: 'ASAAS',
              conciliado: false, // aguarda confirmação pelo extrato bancário (OFX Sicredi)
              observacoes: refObservacao,
            },
          })

          // Recalcula fechamento do mês
          calcularFechamentoEmpresa(contaEmpresa.id, mes, ano).catch((e) =>
            console.error('[Asaas Webhook] Erro ao recalcular fechamento:', e.message)
          )
        }
        // ────────────────────────────────────────────────────────────────────

        // Envia email para o dono da empresa
        try {
          const contaComUsuario = await prisma.contaEmpresa.findUnique({
            where: { id: contaEmpresa.id },
            include: { usuario: true },
          })
          if (contaComUsuario?.usuario?.email) {
            enviarEmailPagamentoRecebido({
              toEmail: contaComUsuario.usuario.email,
              toNome: contaComUsuario.usuario.nome,
              nomeDevedor: cobranca.clienteDevedor.nome,
              descricao: cobranca.descricao,
              valor: valorPago,
            }).catch(() => {})
          }
        } catch {}

        console.log(`[Asaas Webhook] Pagamento ${payment.id} confirmado — ${cobranca.clienteDevedor.nome}`)
      }
    }

    if (event === 'PAYMENT_OVERDUE') {
      // Atualiza perfil do devedor para recorrente se já tem histórico
      const cobranca = await prisma.cobrancaDevedor.findUnique({
        where: { asaasPaymentId: payment.id },
        include: {
          clienteDevedor: {
            include: { _count: { select: { cobrancas: true } } },
          },
        },
      })

      if (cobranca) {
        const totalCobrancas = cobranca.clienteDevedor._count.cobrancas
        let novoPerfil = cobranca.clienteDevedor.perfilDevedor

        if (totalCobrancas >= 5) novoPerfil = 'longo_prazo'
        else if (totalCobrancas >= 3) novoPerfil = 'recorrente'
        else if (totalCobrancas >= 2) novoPerfil = 'segundo_atraso'

        if (novoPerfil !== cobranca.clienteDevedor.perfilDevedor) {
          await prisma.clienteDevedor.update({
            where: { id: cobranca.clienteDevedorId },
            data: { perfilDevedor: novoPerfil },
          })
        }
      }
    }

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('[Asaas Webhook] Erro:', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
