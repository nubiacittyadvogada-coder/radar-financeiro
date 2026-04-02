const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('radar_token')
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('radar_token', token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('radar_token')
      localStorage.removeItem('radar_usuario')
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: any = {
      ...options.headers,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    // Não setar Content-Type se for FormData (deixa o browser definir)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })

    if (res.status === 401) {
      this.clearToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Sessão expirada')
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.erro || `Erro ${res.status}`)
    }

    return data
  }

  // Auth
  async login(email: string, senha: string, tipo: 'bpo' | 'cliente') {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha, tipo }),
    })
    this.setToken(data.token)
    if (typeof window !== 'undefined') {
      localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
    }
    return data
  }

  logout() {
    this.clearToken()
  }

  // Fechamentos
  async getFechamento(clienteId: string, mes: number, ano: number) {
    return this.request(`/api/fechamentos/${clienteId}?mes=${mes}&ano=${ano}`)
  }

  async getHistorico(clienteId: string, ultimos = 6) {
    return this.request(`/api/fechamentos/${clienteId}/historico?ultimos=${ultimos}`)
  }

  // IA
  async gerarEstrategia(clienteId?: string) {
    return this.request('/api/ia/estrategia', {
      method: 'POST',
      body: JSON.stringify({ clienteId }),
    })
  }

  async perguntar(pergunta: string, mes?: number, ano?: number, clienteId?: string) {
    return this.request('/api/ia/perguntar', {
      method: 'POST',
      body: JSON.stringify({ pergunta, mes, ano, clienteId }),
    })
  }

  async getHistoricoIA(clienteId?: string) {
    const query = clienteId ? `?clienteId=${clienteId}` : ''
    return this.request(`/api/ia/historico${query}`)
  }

  // Clientes (BPO)
  async getClientes() {
    return this.request('/api/clientes')
  }

  async criarCliente(data: any) {
    return this.request('/api/clientes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCliente(id: string) {
    return this.request(`/api/clientes/${id}`)
  }

  // Importação
  async uploadPlanilha(clienteId: string, tipo: string, mes: number, ano: number, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    formData.append('clienteId', clienteId)
    formData.append('tipo', tipo)
    formData.append('mes', String(mes))
    formData.append('ano', String(ano))

    return this.request('/api/importacao/upload', {
      method: 'POST',
      body: formData,
    })
  }

  // Alertas
  async getAlertas(clienteId?: string) {
    const query = clienteId ? `?clienteId=${clienteId}` : ''
    return this.request(`/api/alertas${query}`)
  }

  async marcarAlertaVisto(id: string) {
    return this.request(`/api/alertas/${id}/visualizado`, { method: 'PUT' })
  }

  // Relatório
  getRelatorioUrl(clienteId: string, mes: number, ano: number) {
    return `${API_URL}/api/relatorio/${clienteId}?mes=${mes}&ano=${ano}`
  }

  // Lançamentos Manuais
  async getLancamentos(clienteId?: string, mes?: number, ano?: number) {
    const params = new URLSearchParams()
    if (clienteId) params.append('clienteId', clienteId)
    if (mes) params.append('mes', String(mes))
    if (ano) params.append('ano', String(ano))
    return this.request(`/api/lancamentos?${params}`)
  }

  async criarLancamento(data: {
    tipo: string
    descricao: string
    favorecido?: string
    planoConta: string
    valor: number
    data: string
    previsto?: boolean
    observacoes?: string
    clienteId?: string
  }) {
    return this.request('/api/lancamentos', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deletarLancamento(id: string) {
    return this.request(`/api/lancamentos/${id}`, { method: 'DELETE' })
  }

  // Contas a Pagar
  async getContas(clienteId?: string) {
    const query = clienteId ? `?clienteId=${clienteId}` : ''
    return this.request(`/api/contas${query}`)
  }

  async getAlertasContas(clienteId?: string) {
    const query = clienteId ? `?clienteId=${clienteId}` : ''
    return this.request(`/api/contas/alertas${query}`)
  }

  async criarConta(data: {
    descricao: string
    fornecedor?: string
    valor: number
    vencimento: string
    recorrente?: boolean
    frequencia?: string
    categoria?: string
    observacoes?: string
    clienteId?: string
  }) {
    return this.request('/api/contas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async pagarConta(id: string) {
    return this.request(`/api/contas/${id}/pagar`, { method: 'PUT' })
  }

  async deletarConta(id: string) {
    return this.request(`/api/contas/${id}`, { method: 'DELETE' })
  }
}

export const api = new ApiClient()
