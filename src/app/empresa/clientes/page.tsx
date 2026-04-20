'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type TipoVinculo = 'cliente' | 'parceiro' | 'funcionario'

interface Cliente {
  id: string
  nome: string
  cpfCnpj: string | null
  email: string | null
  telefone: string | null
  tipoVinculo: TipoVinculo
  asaasCustomerId: string | null
  totalDevido: number
  totalPago: number
  ativo: boolean
  criadoEm: string
  _count: { cobrancas: number; mensagens: number }
}

interface ClienteDetalhe extends Cliente {
  cobrancas: Cobranca[]
  lancamentos: Lancamento[]
  cobrancasAsaas: CobrancaAsaas[]
  mensagens: Mensagem[]
}

interface Cobranca {
  id: string
  descricao: string
  valor: number
  vencimento: string
  status: string
  asaasLink: string | null
  asaasPaymentId: string | null
}

interface CobrancaAsaas {
  id: string
  description: string
  value: number
  dueDate: string
  status: string
  invoiceUrl: string | null
  billingType: string
}

interface Lancamento {
  id: string
  planoConta: string
  tipo: string
  subtipo: string | null
  valor: number
  dataCompetencia: string | null
  statusPg: string
  descricao: string | null
  origem: string
  previsto: boolean
}

interface Mensagem {
  id: string
  conteudo: string
  direcao: string
  criadoEm: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoVinculo, string> = {
  cliente: 'Cliente',
  parceiro: 'Parceiro',
  funcionario: 'Funcionário',
}

const TIPO_COLOR: Record<TipoVinculo, string> = {
  cliente: 'bg-blue-100 text-blue-700',
  parceiro: 'bg-purple-100 text-purple-700',
  funcionario: 'bg-green-100 text-green-700',
}

const TIPO_AVATAR: Record<TipoVinculo, string> = {
  cliente: 'bg-blue-500',
  parceiro: 'bg-purple-500',
  funcionario: 'bg-green-500',
}

function initiais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

function formatarCpf(v: string | null) {
  if (!v) return '—'
  if (v.length === 11) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
  if (v.length === 14) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
  return v
}

function formatarTel(v: string | null) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

const STATUS_ASAAS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'text-yellow-600' },
  RECEIVED: { label: 'Recebido', color: 'text-green-600' },
  CONFIRMED: { label: 'Confirmado', color: 'text-green-600' },
  OVERDUE: { label: 'Vencido', color: 'text-red-600' },
  REFUNDED: { label: 'Estornado', color: 'text-gray-500' },
  CANCELED: { label: 'Cancelado', color: 'text-gray-400' },
}

// ─── Formulário modal ─────────────────────────────────────────────────────────

interface FormModal {
  aberto: boolean
  editando: Cliente | null
}

function ModalCliente({
  editando,
  onFechar,
  onSalvar,
}: {
  editando: Cliente | null
  onFechar: () => void
  onSalvar: (dados: any) => Promise<void>
}) {
  const [nome, setNome] = useState(editando?.nome || '')
  const [cpfCnpj, setCpfCnpj] = useState(editando?.cpfCnpj || '')
  const [email, setEmail] = useState(editando?.email || '')
  const [telefone, setTelefone] = useState(editando?.telefone || '')
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>(editando?.tipoVinculo || 'cliente')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErro('Nome obrigatório'); return }
    setSalvando(true); setErro('')
    try {
      await onSalvar({ nome, cpfCnpj, email, telefone, tipoVinculo })
      onFechar()
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{editando ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              value={nome} onChange={e => setNome(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CPF / CNPJ</label>
              <input
                value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value as TipoVinculo)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="cliente">Cliente</option>
                <option value="parceiro">Parceiro</option>
                <option value="funcionario">Funcionário</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp / Telefone</label>
            <input
              value={telefone} onChange={e => setTelefone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(00) 90000-0000"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onFechar} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit" disabled={salvando}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Criar cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Painel de detalhe ────────────────────────────────────────────────────────

function PainelDetalhe({
  clienteId,
  token,
  onEditar,
  onFechar,
}: {
  clienteId: string
  token: string
  onEditar: () => void
  onFechar: () => void
}) {
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'cobrancas' | 'lancamentos' | 'mensagens'>('cobrancas')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v2/empresa/clientes/${clienteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setDetalhe(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clienteId, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Carregando...
      </div>
    )
  }

  if (!detalhe) return null

  const cobrancasExibir = detalhe.cobrancasAsaas.length > 0
    ? detalhe.cobrancasAsaas.map(c => ({
        id: c.id, descricao: c.description, valor: c.value,
        vencimento: c.dueDate, status: c.status, link: c.invoiceUrl,
        tipo: c.billingType,
      }))
    : detalhe.cobrancas.map(c => ({
        id: c.id, descricao: c.descricao, valor: Number(c.valor),
        vencimento: c.vencimento.slice(0, 10), status: c.status,
        link: c.asaasLink, tipo: 'LOCAL',
      }))

  return (
    <div className="flex flex-col h-full">
      {/* Header do painel */}
      <div className="flex items-start justify-between p-5 border-b">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${TIPO_AVATAR[detalhe.tipoVinculo]}`}>
            {initiais(detalhe.nome)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{detalhe.nome}</h3>
            <p className="text-xs text-gray-500">{formatarCpf(detalhe.cpfCnpj)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEditar} className="text-xs px-2.5 py-1 border rounded-lg text-gray-600 hover:bg-gray-50">
            ✏️ Editar
          </button>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
      </div>

      {/* Info resumida */}
      <div className="px-5 py-3 bg-gray-50 border-b grid grid-cols-2 gap-3 text-center text-sm">
        <div>
          <div className="text-xs text-gray-500">A receber</div>
          <div className={`font-bold ${Number(detalhe.totalDevido) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {formatarMoeda(Number(detalhe.totalDevido))}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Já pago</div>
          <div className={`font-bold ${Number(detalhe.totalPago) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
            {formatarMoeda(Number(detalhe.totalPago))}
          </div>
        </div>
      </div>

      {/* Info de contato */}
      <div className="px-5 py-3 border-b space-y-1 text-xs text-gray-600">
        {detalhe.telefone && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📱</span>
            <a href={`https://wa.me/55${detalhe.telefone}`} target="_blank" rel="noreferrer" className="hover:text-blue-600">
              {formatarTel(detalhe.telefone)}
            </a>
          </div>
        )}
        {detalhe.email && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📧</span>
            <a href={`mailto:${detalhe.email}`} className="hover:text-blue-600">{detalhe.email}</a>
          </div>
        )}
        {detalhe.asaasCustomerId && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">🔗</span>
            <a
              href={`https://app.asaas.com/customers/${detalhe.asaasCustomerId}`}
              target="_blank" rel="noreferrer"
              className="hover:text-indigo-600 text-indigo-500"
            >
              Ver no Asaas
            </a>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex border-b text-xs font-medium">
        {(['cobrancas', 'lancamentos', 'mensagens'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-1 py-2.5 capitalize transition ${aba === a ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {a === 'cobrancas' ? `Cobranças (${cobrancasExibir.length})` : a === 'lancamentos' ? `Lançamentos (${detalhe.lancamentos.length})` : `Mensagens (${detalhe.mensagens.length})`}
          </button>
        ))}
      </div>

      {/* Conteúdo abas */}
      <div className="flex-1 overflow-y-auto">
        {aba === 'cobrancas' && (
          <div className="divide-y">
            {cobrancasExibir.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma cobrança</p>
            ) : (
              cobrancasExibir.map(c => {
                const st = STATUS_ASAAS[c.status] || { label: c.status, color: 'text-gray-500' }
                const venc = new Date(c.vencimento + 'T12:00:00')
                const hoje = new Date()
                const atrasado = c.status === 'PENDING' && venc < hoje
                return (
                  <div key={c.id} className="px-5 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.descricao}</p>
                        <p className={`text-xs mt-0.5 ${atrasado ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {atrasado ? '⚠️ ' : ''}Venc. {new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{formatarMoeda(c.valor)}</p>
                        <p className={`text-xs ${st.color}`}>{st.label}</p>
                      </div>
                    </div>
                    {c.link && (c.status === 'PENDING' || c.status === 'OVERDUE') && (
                      <a
                        href={c.link} target="_blank" rel="noreferrer"
                        className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                      >
                        🔗 Link de pagamento
                      </a>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {aba === 'lancamentos' && (
          <div className="divide-y">
            {detalhe.lancamentos.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhum lançamento vinculado</p>
            ) : (
              detalhe.lancamentos.map(l => (
                <div key={l.id} className="px-5 py-3 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{l.planoConta}</p>
                      {l.descricao && <p className="text-xs text-gray-400 truncate">{l.descricao}</p>}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${l.statusPg === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {l.statusPg === 'pago' ? 'Pago' : 'Previsto'}
                        </span>
                        {l.previsto && <span className="text-xs text-gray-400">(provisionado)</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                        {l.tipo === 'receita' ? '+' : '-'}{formatarMoeda(l.valor)}
                      </p>
                      {l.dataCompetencia && (
                        <p className="text-xs text-gray-400">
                          {new Date(l.dataCompetencia).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {aba === 'mensagens' && (
          <div className="divide-y">
            {detalhe.mensagens.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma mensagem registrada</p>
            ) : (
              detalhe.mensagens.map(m => (
                <div key={m.id} className={`px-5 py-3 ${m.direcao === 'enviada' ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">{m.direcao === 'enviada' ? '📤 Enviada' : '📥 Recebida'}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(m.criadoEm).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{m.conteudo}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [stats, setStats] = useState<any>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // Seleção
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)

  // Modais
  const [modal, setModal] = useState<FormModal>({ aberto: false, editando: null })

  // Ações
  const [sincronizando, setSincronizando] = useState(false)
  const [importandoCobrancas, setImportandoCobrancas] = useState(false)
  const cobrancasRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregarClientes = useCallback(async (tok: string) => {
    setLoading(true)
    setErro('')
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (filtroTipo) params.set('tipoVinculo', filtroTipo)
      const res = await fetch(`/api/v2/empresa/clientes?${params}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setClientes(data.clientes)
      setTotal(data.total)
      setStats(data.stats)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }, [busca, filtroTipo])

  useEffect(() => {
    if (token) carregarClientes(token)
  }, [token, carregarClientes])

  async function sincronizarAsaas() {
    if (!token) return
    setSincronizando(true)
    setErro('')
    setSucesso('')
    try {
      const res = await fetch('/api/v2/empresa/clientes/sync-asaas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setSucesso(`✅ Asaas sincronizado: ${data.criados} novos, ${data.atualizados} atualizados (${data.totalAsaas} clientes total)`)
      carregarClientes(token)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSincronizando(false)
    }
  }

  async function importarCobrancas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setImportandoCobrancas(true)
    setErro('')
    setSucesso('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v2/empresa/clientes/importar-cobrancas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setSucesso(
        `✅ ${data.clientes.criados} clientes novos · ${data.clientes.atualizados} atualizados · ${data.cobrancas.criadas} cobranças · ${data.lancamentosPrevisto} receitas previstas no DRE`
      )
      carregarClientes(token)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportandoCobrancas(false)
      if (cobrancasRef.current) cobrancasRef.current.value = ''
    }
  }

  async function salvarCliente(dados: any) {
    if (!token) return
    if (modal.editando) {
      const res = await fetch(`/api/v2/empresa/clientes/${modal.editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dados),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
    } else {
      const res = await fetch('/api/v2/empresa/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dados),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
    }
    setSucesso(modal.editando ? '✅ Cliente atualizado' : '✅ Cliente criado')
    carregarClientes(token)
  }

  async function desativarCliente(id: string, nome: string) {
    if (!token) return
    if (!confirm(`Remover "${nome}"? O cliente será desativado.`)) return
    const res = await fetch(`/api/v2/empresa/clientes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      if (clienteSelecionado === id) setClienteSelecionado(null)
      carregarClientes(token)
    }
  }

  const abrir = (c: Cliente) => {
    setClienteSelecionado(c.id)
    setModal({ aberto: false, editando: null })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats ? `${stats.total} cadastrados · ${stats.comAsaas} vinculados ao Asaas` : 'Carregando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sincronizarAsaas}
            disabled={sincronizando}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <span className={sincronizando ? 'animate-spin' : ''}>⟳</span>
            {sincronizando ? 'Sincronizando...' : 'Sync Asaas'}
          </button>
          <button
            onClick={() => cobrancasRef.current?.click()}
            disabled={importandoCobrancas}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Importar planilha de cobranças exportada do Asaas"
          >
            {importandoCobrancas ? '⏳ Importando...' : '📥 Cobranças Asaas'}
          </button>
          <input ref={cobrancasRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarCobrancas} />
          <button
            onClick={() => setModal({ aberto: true, editando: null })}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Novo cliente
          </button>
        </div>
      </header>

      {/* Alertas */}
      {(erro || sucesso) && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${erro ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          <span>{erro || sucesso}</span>
          <button onClick={() => { setErro(''); setSucesso('') }} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="px-6 py-3 flex gap-3 overflow-x-auto">
          {[
            { label: 'Todos', value: '', count: stats.total, color: 'bg-gray-100 text-gray-700' },
            { label: 'Clientes', value: 'cliente', count: stats.porTipo?.cliente || 0, color: 'bg-blue-100 text-blue-700' },
            { label: 'Parceiros', value: 'parceiro', count: stats.porTipo?.parceiro || 0, color: 'bg-purple-100 text-purple-700' },
            { label: 'Funcionários', value: 'funcionario', count: stats.porTipo?.funcionario || 0, color: 'bg-green-100 text-green-700' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setFiltroTipo(s.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${filtroTipo === s.value ? s.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            >
              {s.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filtroTipo === s.value ? 'bg-white/60' : 'bg-gray-100'}`}>{s.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Busca */}
      <div className="px-6 pb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista + Painel */}
      <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-4 min-h-0">
        {/* Lista de clientes */}
        <div className={`flex-1 bg-white rounded-2xl border shadow-sm overflow-y-auto ${clienteSelecionado ? 'hidden md:block md:max-w-sm lg:max-w-md' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Carregando...</div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <span className="text-4xl">👥</span>
              <p>Nenhum cliente encontrado</p>
              <button onClick={() => setModal({ aberto: true, editando: null })} className="text-blue-600 text-xs hover:underline">
                + Adicionar primeiro cliente
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {clientes.map(c => (
                <div
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 transition group ${clienteSelecionado === c.id ? 'bg-blue-50' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${TIPO_AVATAR[c.tipoVinculo]}`}>
                    {initiais(c.nome)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                      {c.asaasCustomerId && <span className="text-xs text-indigo-500 shrink-0" title="Vinculado ao Asaas">🔗</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TIPO_COLOR[c.tipoVinculo]}`}>
                        {TIPO_LABEL[c.tipoVinculo]}
                      </span>
                      {c.cpfCnpj && <span className="text-xs text-gray-400">{formatarCpf(c.cpfCnpj)}</span>}
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="text-right shrink-0">
                    {Number(c.totalDevido) > 0 && (
                      <p className="text-sm font-semibold text-red-500">{formatarMoeda(Number(c.totalDevido))}</p>
                    )}
                    {Number(c.totalPago) > 0 && (
                      <p className="text-xs text-green-500">{formatarMoeda(Number(c.totalPago))} pago</p>
                    )}
                    {Number(c.totalDevido) === 0 && Number(c.totalPago) === 0 && (
                      <p className="text-xs text-gray-300">sem cobrança</p>
                    )}

                    {/* Ações hover */}
                    <div className="hidden group-hover:flex items-center gap-1 mt-1 justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); setModal({ aberto: true, editando: c }); setClienteSelecionado(null) }}
                        className="text-xs text-gray-500 hover:text-blue-600 px-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); desativarCliente(c.id, c.nome) }}
                        className="text-xs text-gray-400 hover:text-red-500 px-1"
                        title="Remover"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel de detalhe */}
        {clienteSelecionado && token && (
          <div className="flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
            <PainelDetalhe
              clienteId={clienteSelecionado}
              token={token}
              onEditar={() => {
                const c = clientes.find(x => x.id === clienteSelecionado)
                if (c) setModal({ aberto: true, editando: c })
              }}
              onFechar={() => setClienteSelecionado(null)}
            />
          </div>
        )}
      </div>

      {/* Modal adicionar/editar */}
      {modal.aberto && (
        <ModalCliente
          editando={modal.editando}
          onFechar={() => setModal({ aberto: false, editando: null })}
          onSalvar={salvarCliente}
        />
      )}
    </div>
  )
}
