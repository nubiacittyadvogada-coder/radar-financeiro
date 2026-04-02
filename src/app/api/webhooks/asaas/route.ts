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
import { enviarEmailPagamentoRecebido } from '@/lib/email'

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
        include: { clienteDevedor: true },
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

        // Envia email para o dono da empresa
        try {
          const contaEmpresa = await prisma.contaEmpresa.findUnique({
            where: { id: cobranca.clienteDevedor.contaEmpresaId },
            include: { usuario: true },
          })
          if (contaEmpresa?.usuario?.email) {
            enviarEmailPagamentoRecebido({
              toEmail: contaEmpresa.usuario.email,
              toNome: contaEmpresa.usuario.nome,
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

        if (totalCobrancas >= 3) novoPerfil = 'longo_prazo'
        else if (totalCobrancas >= 2) novoPerfil = 'recorrente'

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
