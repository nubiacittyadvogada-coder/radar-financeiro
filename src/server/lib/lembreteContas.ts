import prisma from './db'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/**
 * Verifica contas a pagar e envia lembretes via WhatsApp (Z-API).
 * Rodado todo dia às 8h via cron.
 */
export async function enviarLembreteContas(): Promise<void> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const em7dias = new Date(hoje)
  em7dias.setDate(em7dias.getDate() + 7)
  em7dias.setHours(23, 59, 59, 999)

  // Buscar todos os clientes com WhatsApp habilitado
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nomeEmpresa: true, alertaWpp: true, telefoneWpp: true },
  })

  for (const cliente of clientes) {
    // Atualizar status de atrasadas
    await prisma.contaPagar.updateMany({
      where: {
        clienteId: cliente.id,
        status: 'pendente',
        vencimento: { lt: hoje },
      },
      data: { status: 'atrasado' },
    })

    // Buscar contas: vencidas + vence hoje + próximos 7 dias
    const atrasadas = await prisma.contaPagar.findMany({
      where: { clienteId: cliente.id, status: 'atrasado' },
      orderBy: { vencimento: 'asc' },
    })

    const proximas = await prisma.contaPagar.findMany({
      where: {
        clienteId: cliente.id,
        status: 'pendente',
        vencimento: { gte: hoje, lte: em7dias },
      },
      orderBy: { vencimento: 'asc' },
    })

    const hojeContas = proximas.filter(c => {
      const d = new Date(c.vencimento)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === hoje.getTime()
    })

    if (atrasadas.length === 0 && hojeContas.length === 0 && proximas.length === 0) continue

    // Montar mensagem
    let mensagem = `*🔔 Radar Financeiro — Contas a Pagar*\n\n`

    if (atrasadas.length > 0) {
      mensagem += `⚠️ *ATRASADAS (${atrasadas.length}):*\n`
      atrasadas.forEach(c => {
        const d = new Date(c.vencimento)
        const diasAtraso = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        mensagem += `  • ${c.descricao}: R$ ${fmt(Number(c.valor))} _(venceu há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''})_\n`
      })
      mensagem += '\n'
    }

    if (hojeContas.length > 0) {
      mensagem += `📌 *VENCE HOJE:*\n`
      hojeContas.forEach(c => {
        mensagem += `  • ${c.descricao}: R$ ${fmt(Number(c.valor))}\n`
      })
      mensagem += '\n'
    }

    const proximasSemHoje = proximas.filter(c => {
      const d = new Date(c.vencimento)
      d.setHours(0, 0, 0, 0)
      return d.getTime() !== hoje.getTime()
    })

    if (proximasSemHoje.length > 0) {
      mensagem += `📅 *PRÓXIMOS 7 DIAS:*\n`
      proximasSemHoje.forEach(c => {
        const d = new Date(c.vencimento)
        const dia = d.getDate().toString().padStart(2, '0')
        const mes = (d.getMonth() + 1).toString().padStart(2, '0')
        mensagem += `  • ${c.descricao}: R$ ${fmt(Number(c.valor))} _(${dia}/${mes} — ${DIAS_SEMANA[d.getDay()]})_\n`
      })
    }

    mensagem += `\n_Acesse o Radar Financeiro para marcar como pago._`

    // Enviar via Z-API (se configurado)
    if (cliente.alertaWpp && cliente.telefoneWpp) {
      await enviarWhatsApp(cliente.telefoneWpp, mensagem)
    }

    // Salvar como Alerta no sistema (visível no app independente do WhatsApp)
    const totalPendente = [...atrasadas, ...hojeContas]
    if (totalPendente.length > 0) {
      const totalValor = totalPendente.reduce((s, c) => s + Number(c.valor), 0)
      await prisma.alerta.create({
        data: {
          clienteId: cliente.id,
          tipo: 'conta_vencer',
          titulo: hojeContas.length > 0
            ? `${hojeContas.length} conta${hojeContas.length > 1 ? 's' : ''} vence${hojeContas.length > 1 ? 'm' : ''} hoje`
            : `${atrasadas.length} conta${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''}`,
          mensagem: `Total: R$ ${fmt(totalValor)}. Acesse Contas a Pagar para resolver.`,
          canal: 'sistema',
          enviado: true,
          enviadoEm: new Date(),
        },
      })
    }
  }
}

async function enviarWhatsApp(telefone: string, mensagem: string): Promise<void> {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN

  if (!instanceId || !token) {
    console.log('[Lembretes] Z-API não configurada. Mensagem preparada mas não enviada.')
    return
  }

  try {
    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': process.env.ZAPI_CLIENT_TOKEN || '',
        },
        body: JSON.stringify({
          phone: telefone.replace(/\D/g, ''),
          message: mensagem,
        }),
      }
    )

    if (response.ok) {
      console.log(`[Lembretes] WhatsApp enviado para ${telefone}`)
    } else {
      console.warn(`[Lembretes] Falha ao enviar WhatsApp: ${response.status}`)
    }
  } catch (err) {
    console.warn(`[Lembretes] Erro ao enviar WhatsApp:`, err)
  }
}
