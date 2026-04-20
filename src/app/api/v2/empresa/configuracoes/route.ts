import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { ZApiClient } from '@/lib/zapi'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })
    // Não expõe a API key completa
    return Response.json({
      ...conta,
      asaasApiKey: conta.asaasApiKey ? '***' + conta.asaasApiKey.slice(-4) : null,
      zapiToken: conta.zapiToken ? '***' + conta.zapiToken.slice(-4) : null,
      zapiClientToken: conta.zapiClientToken ? '***' + conta.zapiClientToken.slice(-4) : null,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()

    // Apenas campos permitidos
    const permitidos = [
      'nomeEmpresa', 'cnpj', 'setor', 'telefoneAlerta', 'alertaAtivo', 'chavePix',
      'asaasAtivo', 'asaasApiKey', 'zapiInstanceId', 'zapiToken', 'zapiClientToken',
      'cobrancaDescontoMax', 'cobrancaParcelasMax', 'metaLucro', 'metaReceita',
    ]
    // Campos numéricos opcionais — string vazia vira null
    const camposNumericos = ['cobrancaDescontoMax', 'cobrancaParcelasMax', 'metaLucro', 'metaReceita']
    const update: any = {}
    for (const key of permitidos) {
      if (key in body) {
        if (camposNumericos.includes(key)) {
          const v = body[key]
          update[key] = (v === '' || v === null || v === undefined) ? null : Number(v)
        } else {
          update[key] = body[key]
        }
      }
    }

    const atualizada = await prisma.contaEmpresa.update({
      where: { id: conta.id },
      data: update,
    })

    // Auto-configura webhook de recebimento na Z-API quando credenciais são salvas
    const instanceId = update.zapiInstanceId || atualizada.zapiInstanceId
    const token = update.zapiToken || atualizada.zapiToken
    const clientToken = update.zapiClientToken || atualizada.zapiClientToken

    if (instanceId && token && clientToken && (update.zapiInstanceId || update.zapiToken || update.zapiClientToken)) {
      try {
        const zapi = new ZApiClient(instanceId, token, clientToken)
        const host = req.headers.get('host') || 'radar-financeiro-roan.vercel.app'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const webhookUrl = `${protocol}://${host}/api/v2/webhook/zapi`
        const ok = await zapi.configurarWebhookRecebimento(webhookUrl)
        console.log(`[Config] Webhook Z-API configurado: ${ok ? 'OK' : 'FALHOU'} → ${webhookUrl}`)
      } catch (err: any) {
        console.error('[Config] Erro ao configurar webhook Z-API:', err.message)
      }
    }

    return Response.json({ ok: true, nomeEmpresa: atualizada.nomeEmpresa, alertaAtivo: atualizada.alertaAtivo })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
