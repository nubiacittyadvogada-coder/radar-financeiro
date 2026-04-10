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
   * Configura a URL do webhook de recebimento de mensagens na Z-API.
   */
  async configurarWebhookRecebimento(webhookUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/update-webhook-received`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({ value: webhookUrl }),
      })
      return res.ok
    } catch {
      return false
    }
  }
}

/**
 * Cria cliente Z-API a partir das env vars de uma ContaEmpresa.
 */
export function getZApiClient(conta: {
  zapiInstanceId?: string | null
  zapiToken?: string | null
  zapiClientToken?: string | null
}): ZApiClient | null {
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
