/**
 * Cliente Asaas para gestão de cobranças.
 * Documentação: https://docs.asaas.com/reference
 */

const ASAAS_BASE = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3'

export class AsaasClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async req(path: string, options: RequestInit = {}) {
    const res = await fetch(`${ASAAS_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        ...options.headers,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.errors?.[0]?.description || data?.message || `Erro ${res.status}`
      throw new Error(`Asaas: ${msg}`)
    }
    return data
  }

  // ── Clientes ──────────────────────────────────────────────────────────────

  async criarCliente(dados: {
    name: string
    cpfCnpj?: string
    email?: string
    mobilePhone?: string
  }) {
    return this.req('/customers', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  async buscarCliente(cpfCnpj: string) {
    const data = await this.req(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`)
    return data.data?.[0] || null
  }

  // ── Cobranças ─────────────────────────────────────────────────────────────

  async criarCobranca(dados: {
    customer: string       // ID do cliente no Asaas
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED'
    value: number
    dueDate: string        // YYYY-MM-DD
    description?: string
    externalReference?: string  // ID interno da cobrança
    fine?: { value: number }
    interest?: { value: number }
    discount?: { value: number; dueDateLimitDays: number; type: 'PERCENTAGE' | 'FIXED' }
    postalService?: boolean
  }) {
    return this.req('/payments', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  async buscarCobranca(id: string) {
    return this.req(`/payments/${id}`)
  }

  async listarCobrancasCliente(customerId: string) {
    const data = await this.req(`/payments?customer=${customerId}&status=PENDING,OVERDUE`)
    return data.data || []
  }

  async listarInadimplentes(limite = 100) {
    const data = await this.req(`/payments?status=OVERDUE&limit=${limite}&offset=0`)
    return data.data || []
  }

  async buscarClientePorId(clienteId: string) {
    return this.req(`/customers/${clienteId}`)
  }

  async cancelarCobranca(id: string) {
    return this.req(`/payments/${id}`, { method: 'DELETE' })
  }

  // ── PIX ───────────────────────────────────────────────────────────────────

  async gerarQrCodePix(paymentId: string) {
    return this.req(`/payments/${paymentId}/pixQrCode`)
  }

  // ── Links de pagamento ────────────────────────────────────────────────────

  async obterLinkPagamento(paymentId: string) {
    const cobranca = await this.buscarCobranca(paymentId)
    return cobranca?.invoiceUrl || null
  }

  // ── Assinaturas recorrentes ────────────────────────────────────────────────

  async criarAssinatura(dados: {
    customer: string
    billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD'
    value: number
    nextDueDate: string   // YYYY-MM-DD — data do primeiro vencimento
    cycle: 'MONTHLY'
    description?: string
    externalReference?: string
  }) {
    return this.req('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  async buscarAssinatura(id: string) {
    return this.req(`/subscriptions/${id}`)
  }

  async cancelarAssinatura(id: string) {
    return this.req(`/subscriptions/${id}`, { method: 'DELETE' })
  }

  async listarPagamentosAssinatura(subscriptionId: string) {
    const data = await this.req(`/subscriptions/${subscriptionId}/payments`)
    return data.data || []
  }
}

/**
 * Instancia um cliente Asaas com a chave do usuário.
 */
export function getAsaasClient(apiKey: string) {
  return new AsaasClient(apiKey)
}
