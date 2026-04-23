import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { ZApiClient } from '@/lib/zapi'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (!conta.zapiInstanceId || !conta.zapiToken || !conta.zapiClientToken) {
      return Response.json({ erro: 'Z-API não configurado. Preencha Instance ID, Token e Client Token em Configurações.' }, { status: 400 })
    }

    if (!conta.telefoneAlerta) {
      return Response.json({ erro: 'Número de WhatsApp não configurado em Configurações.' }, { status: 400 })
    }

    const zapi = new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)

    // Verifica status antes
    const status = await zapi.consultarStatus()

    const mensagem = `✅ *Radar Financeiro — Teste de Conexão*\n\nOlá, *${conta.nomeEmpresa}*!\n\nSua integração WhatsApp está funcionando. Você receberá alertas neste número.\n\n_${new Date().toLocaleTimeString('pt-BR')}_`

    const resultado = await zapi.enviarTextoDetalhado(conta.telefoneAlerta, mensagem)

    console.log('[Testar Z-API] instanceId:', conta.zapiInstanceId)
    console.log('[Testar Z-API] token (últimos 6):', conta.zapiToken?.slice(-6))
    console.log('[Testar Z-API] clientToken (últimos 6):', conta.zapiClientToken?.slice(-6))
    console.log('[Testar Z-API] telefone:', conta.telefoneAlerta)
    console.log('[Testar Z-API] status:', JSON.stringify(status.body))
    console.log('[Testar Z-API] resultado envio:', JSON.stringify(resultado))

    if (!resultado.ok) {
      return Response.json({
        erro: 'Falha ao enviar. Veja detalhes abaixo.',
        instanciaId: conta.zapiInstanceId,
        statusInstancia: status.body,
        zapiHttpStatus: resultado.status,
        zapiResposta: resultado.body,
        zapiErro: resultado.erro,
      }, { status: 500 })
    }

    return Response.json({
      ok: true,
      mensagem: `Mensagem de teste enviada para ${conta.telefoneAlerta}`,
      instanciaId: conta.zapiInstanceId,
      statusInstancia: status.body,
      zapiResposta: resultado.body,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
