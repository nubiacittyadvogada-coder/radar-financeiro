/**
 * POST /api/v2/empresa/zapi/testar-lembrete
 * Envia uma mensagem de teste no formato de lembrete de honorários
 * para o telefoneAlerta da empresa — confirma que o Z-API está funcionando
 * e mostra exatamente como o cliente vai receber.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { getZApiClient } from '@/lib/zapi'
import prisma from '@/server/lib/db'

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (!conta.telefoneAlerta) {
      return Response.json({ erro: 'Número WhatsApp não configurado em Configurações.' }, { status: 400 })
    }

    const zapi = getZApiClient(conta, 'cobranca')
    if (!zapi) {
      return Response.json({ erro: 'Z-API não configurado. Preencha as credenciais em Configurações.' }, { status: 400 })
    }

    // Data de vencimento de exemplo: daqui 3 dias
    const dataVenc = new Date()
    dataVenc.setDate(dataVenc.getDate() + 3)
    const dataFormatada = dataVenc.toLocaleDateString('pt-BR')

    const pixParte = conta.chavePix ? `\n\nPIX: *${conta.chavePix}*` : ''

    const mensagem =
      `⚠️ *ESTA É UMA MENSAGEM DE TESTE*\n\n` +
      `Olá, João Silva! 👋\n\n` +
      `Passando para lembrar que a parcela *"Honorários Mensais"* no valor de *${fmt(1500)}* ` +
      `vence no dia *${dataFormatada}*.\n\n` +
      `Evite encargos e regularize antes do vencimento!${pixParte}\n\n` +
      `Qualquer dúvida, estamos à disposição. 🙏\n\n` +
      `_— ${conta.nomeEmpresa}_`

    const enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)

    if (!enviado) {
      return Response.json({
        erro: 'Falha ao enviar. Verifique se a instância Z-API está conectada e as credenciais estão corretas.',
      }, { status: 500 })
    }

    return Response.json({
      ok: true,
      mensagem: `Lembrete de teste enviado para ${conta.telefoneAlerta}`,
      instancia: conta.zapiInstanceIdCobranca
        ? `Z-API Cobrança (${conta.zapiInstanceIdCobranca.slice(0, 8)}...)`
        : `Z-API Jurídico (${conta.zapiInstanceId?.slice(0, 8)}...)`,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
