/**
 * Cliente Z-API para envio de mensagens WhatsApp.
 * Documentação: https://developer.z-api.io/
 */

export class ZApiClient {
  private instanceId: string
  private token: string
  private clientToken: string

  constructor(instanceId: string, token: string, clientToken: string) {
    this.instanceId = instanceId
    this.token = token
    this.clientToken = clientToken
  }

  private get baseUrl() {
    return `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`
  }

  async enviarTexto(telefone: string, mensagem: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({ phone: telefone, message: mensagem }),
      })
      const data = await res.json()
      // Z-API retorna { id, phone, status } — basta checar res.ok
      return res.ok && !data.error
    } catch {
      return false
    }
  }

  async enviarTemplate(telefone: string, mensagem: string): Promise<boolean> {
    return this.enviarTexto(telefone, mensagem)
  }

  /**
   * Envia um documento (PDF, etc.) via base64.
   * Z-API endpoint: POST /send-document/
   * @param base64 conteúdo do arquivo em base64 (sem prefixo data:...)
   */
  async enviarDocumento(telefone: string, base64: string, fileName: string, caption = ''): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/send-document/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: telefone,
          document: base64,
          fileName,
          caption,
        }),
      })
      const data = await res.json()
      return res.ok && !data.error
    } catch {
      return false
    }
  }

  /**
   * Configura a URL do webhook de recebimento de mensagens na Z-API.
   * Tenta múltiplos endpoints e formatos da API.
   */
  async configurarWebhookRecebimento(webhookUrl: string): Promise<{ ok: boolean; detalhes: string }> {
    const tentativas = [
      { endpoint: '/update-webhook-received', method: 'PUT', body: { value: webhookUrl } },
      { endpoint: '/update-webhook-received', method: 'PUT', body: { webhookUrl } },
      { endpoint: '/webhook', method: 'PUT', body: { receivedUrl: webhookUrl } },
    ]

    for (const t of tentativas) {
      try {
        const res = await fetch(`${this.baseUrl}${t.endpoint}`, {
          method: t.method,
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
          },
          body: JSON.stringify(t.body),
        })
        const data = await res.json().catch(() => ({}))
        console.log(`[Z-API] Webhook ${t.endpoint}: status=${res.status}`, JSON.stringify(data).substring(0, 200))
        if (res.ok) {
          return { ok: true, detalhes: `${t.endpoint} configurado com sucesso` }
        }
      } catch (err: any) {
        console.error(`[Z-API] Webhook ${t.endpoint} falhou:`, err.message)
      }
    }

    return { ok: false, detalhes: 'Nenhum endpoint da Z-API aceitou a configuração. Configure manualmente no painel Z-API.' }
  }
}

/**
 * Cria cliente Z-API a partir dos campos de uma ContaEmpresa.
 *
 * @param tipo 'juridico' (padrão) — alertas internos, DRE, resumos para a sócia
 *             'cobranca'          — mensagens para clientes/devedores
 *             Se 'cobranca' não estiver configurado, usa fallback para 'juridico'.
 */
export function getZApiClient(
  conta: {
    zapiInstanceId?: string | null
    zapiToken?: string | null
    zapiClientToken?: string | null
    zapiInstanceIdCobranca?: string | null
    zapiTokenCobranca?: string | null
    zapiClientTokenCobranca?: string | null
  },
  tipo: 'juridico' | 'cobranca' = 'juridico'
): ZApiClient | null {
  if (tipo === 'cobranca') {
    // Prefere a instância de cobrança; se não configurada faz fallback para jurídico
    const instanceId = conta.zapiInstanceIdCobranca || conta.zapiInstanceId
    const token = conta.zapiTokenCobranca || conta.zapiToken
    const clientToken = conta.zapiClientTokenCobranca || conta.zapiClientToken
    if (!instanceId || !token || !clientToken) return null
    return new ZApiClient(instanceId, token, clientToken)
  }
  // Jurídico (padrão)
  if (!conta.zapiInstanceId || !conta.zapiToken || !conta.zapiClientToken) return null
  return new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)
}

/**
 * Envia via Z-API configurada no sistema (env vars globais).
 * Para alertas do sistema (ex: cron de vencimentos).
 */
export async function enviarWhatsAppSistema(telefone: string, mensagem: string): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !clientToken) {
    console.warn('[Z-API] Env vars não configuradas — WhatsApp não enviado')
    return false
  }

  const client = new ZApiClient(instanceId, token, clientToken)
  return client.enviarTexto(telefone, mensagem)
}
