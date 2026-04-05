import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || ''

// Asaas envia webhook com eventos de pagamento
export async function POST(req: NextRequest) {
  try {
    // Valida token de autenticação do Asaas
    if (WEBHOOK_TOKEN) {
      const asaasToken = req.headers.get('asaas-access-token') || req.headers.get('access_token') || ''
      if (asaasToken !== WEBHOOK_TOKEN) {
        return Response.json({ erro: 'Não autorizado' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { event, payment } = body

    if (!payment?.externalReference) return Response.json({ ok: true })

    const usuarioId = payment.externalReference

    // Busca assinatura pelo usuário
    const assinatura = await prisma.assinaturaRadar.findUnique({ where: { usuarioId } })
    if (!assinatura) return Response.json({ ok: true })

    // Registra pagamento
    if (payment.id) {
      await prisma.pagamentoAssinatura.upsert({
        where: { asaasPaymentId: payment.id },
        update: {
          status: payment.status,
          pagoEm: payment.paymentDate ? new Date(payment.paymentDate) : null,
        },
        create: {
          assinaturaId: assinatura.id,
          asaasPaymentId: payment.id,
          valor: Number(payment.value || assinatura.valorMensal),
          status: payment.status,
          vencimento: new Date(payment.dueDate),
          pagoEm: payment.paymentDate ? new Date(payment.paymentDate) : null,
          linkPagamento: payment.invoiceUrl || null,
        },
      })
    }

    // Atualiza plano conforme evento
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      // Pagamento confirmado: ativa plano por 35 dias (30 + 5 dias de graça)
      const validoAte = new Date()
      validoAte.setDate(validoAte.getDate() + 35)

      await prisma.assinaturaRadar.update({
        where: { id: assinatura.id },
        data: { status: 'ativa', venceEm: validoAte },
      })
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { plano: assinatura.plano, planoValidoAte: validoAte },
      })
    } else if (event === 'PAYMENT_OVERDUE') {
      await prisma.assinaturaRadar.update({
        where: { id: assinatura.id },
        data: { status: 'inadimplente' },
      })
      // Downgrade para básico
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { plano: 'basico', planoValidoAte: null },
      })
    } else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
      await prisma.assinaturaRadar.update({
        where: { id: assinatura.id },
        data: { status: 'cancelada' },
      })
    }

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('Webhook Asaas erro:', err.message)
    return Response.json({ ok: true }) // sempre 200 para Asaas não retentar
  }
}
