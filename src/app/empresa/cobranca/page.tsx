'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

type Devedor = {
  id: string
  nome: string
  cpfCnpj?: string
  telefone?: string
  email?: string
  perfilDevedor: string
  totalDevido: number
  totalPago: number
  cobrancaPausadaAte?: string | null
  cobrancas: Array<{
    id: string
    descricao: string
    valor: number
    vencimento: string
    status: string
    asaasLink?: string
  }>
  _count: { mensagens: number }
}

const PERFIL_LABEL: Record<string, { label: string; color: string }> = {
  primeiro_atraso: { label: 'Primeiro atraso', color: 'bg-yellow-100 text-yellow-700' },
  segundo_atraso: { label: 'Segundo atraso', color: 'bg-amber-100 text-amber-700' },
  recorrente: { label: 'Recorrente', color: 'bg-orange-100 text-orange-700' },
  longo_prazo: { label: 'Longo prazo', color: 'bg-red-100 text-red-700' },
}

export default function CobrancaPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [devedores, setDevedores] = useState<Devedor[]>([])
  const [loading, setLoading] = useState(true)
  const [cobrando, setCobrando] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: '', cpfCnpj: '', email: '', telefone: '',
    perfilDevedor: 'primeiro_atraso',
    descricao: '', valor: '', vencimento: '',
  })
  // Estado para nova cobrança em devedor existente
  const [showNovaCobranca, setShowNovaCobranca] = useState<string | null>(null) // devedorId
  const [formCobranca, setFormCobranca] = useState({ descricao: '', valor: '', vencimento: '' })
  const [salvandoCobranca, setSalvandoCobranca] = useState(false)
  const [erro, setErro] = useState('')
  const [importando, setImportando] = useState(false)
  const [previewAsaas, setPreviewAsaas] = useState<any[] | null>(null)
  const [importandoConfirm, setImportandoConfirm] = useState(false)
  const [acordosPendentes, setAcordosPendentes] = useState<any[]>([])
  const [decidindo, setDecidindo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [pausando, setPausando] = useState<string | null>(null)
  const [showConversa, setShowConversa] = useState<string | null>(null) // devedorId
  const [mensagensConversa, setMensagensConversa] = useState<any[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [msgEnvio, setMsgEnvio] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarDevedores(t)
    carregarAcordosPendentes(t)
  }, [router])

  async function carregarDevedores(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/empresa/devedores', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setDevedores(await res.json())
    setLoading(false)
  }

  async function carregarAcordosPendentes(t: string) {
    const res = await fetch('/api/v2/empresa/acordos', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setAcordosPendentes(await res.json())
  }

  async function decidirAcordo(id: string, decisao: 'aprovar' | 'rejeitar') {
    if (!token) return
    setDecidindo(id)
    try {
      const res = await fetch(`/api/v2/empresa/acordos/${id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decisao }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      carregarAcordosPendentes(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setDecidindo(null)
    }
  }

  async function sincronizarAsaas() {
    if (!token) return
    setSincronizando(true)
    try {
      const res = await fetch('/api/v2/empresa/devedores/sincronizar-asaas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      alert(`✅ ${data.mensagem}`)
      carregarDevedores(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSincronizando(false)
    }
  }

  async function pausarCobranca(devedorId: string, dias: number) {
    if (!token) return
    setPausando(devedorId)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/pausar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dias }),
      })
      if (res.ok && token) carregarDevedores(token)
    } finally {
      setPausando(null)
    }
  }

  async function cobrar(devedorId: string) {
    if (!token) return
    setCobrando(devedorId)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/cobrar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      const enviados = data.resultados.filter((r: any) => r.enviado).length
      alert(`Cobrança enviada! ${enviados} mensagem(ns) enviada(s) via WhatsApp.`)
      carregarDevedores(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setCobrando(null)
    }
  }

  async function buscarDoAsaas() {
    if (!token) return
    setImportando(true)
    try {
      const res = await fetch('/api/v2/empresa/devedores/importar-asaas', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setPreviewAsaas(data)
    } catch (err: any) {
      alert('Erro ao buscar do Asaas: ' + err.message)
    } finally {
      setImportando(false)
    }
  }

  async function confirmarImportacao() {
    if (!token || !previewAsaas) return
    setImportandoConfirm(true)
    try {
      const res = await fetch('/api/v2/empresa/devedores/importar-asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientes: previewAsaas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setPreviewAsaas(null)
      carregarDevedores(token)
      alert(`✅ Importação concluída!\n${data.importados} novo(s) | ${data.atualizados} atualizado(s)`)
    } catch (err: any) {
      alert('Erro na importação: ' + err.message)
    } finally {
      setImportandoConfirm(false)
    }
  }

  async function cadastrarDevedor() {
    if (!token || !form.nome || !form.descricao || !form.valor || !form.vencimento) {
      setErro('Preencha nome, descrição, valor e vencimento')
      return
    }
    setErro('')
    try {
      const res = await fetch('/api/v2/empresa/devedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: form.nome,
          cpfCnpj: form.cpfCnpj || null,
          email: form.email || null,
          telefone: form.telefone || null,
          perfilDevedor: form.perfilDevedor,
          totalDevido: Number(form.valor),
          cobranca: { descricao: form.descricao, valor: Number(form.valor), vencimento: form.vencimento },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setShowForm(false)
      setForm({ nome: '', cpfCnpj: '', email: '', telefone: '', perfilDevedor: 'primeiro_atraso', descricao: '', valor: '', vencimento: '' })
      carregarDevedores(token)
    } catch (err: any) {
      setErro(err.message)
    }
  }

  async function abrirConversa(devedorId: string) {
    setShowConversa(devedorId)
    setLoadingMsgs(true)
    setMensagensConversa([])
    const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/mensagens`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setMensagensConversa(await res.json())
    setLoadingMsgs(false)
  }

  async function enviarMsgManual() {
    if (!token || !showConversa || !msgEnvio.trim()) return
    setEnviandoMsg(true)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${showConversa}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensagem: msgEnvio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setMsgEnvio('')
      abrirConversa(showConversa) // recarrega
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setEnviandoMsg(false)
    }
  }

  async function adicionarCobranca(devedorId: string) {
    if (!token || !formCobranca.descricao || !formCobranca.valor || !formCobranca.vencimento) return
    setSalvandoCobranca(true)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/cobrancas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descricao: formCobranca.descricao,
          valor: Number(formCobranca.valor),
          vencimento: formCobranca.vencimento,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setShowNovaCobranca(null)
      setFormCobranca({ descricao: '', valor: '', vencimento: '' })
      carregarDevedores(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSalvandoCobranca(false)
    }
  }

  const totalInadimplente = devedores.reduce((s, d) => s + Number(d.totalDevido), 0)
  const devedoresFiltrados = devedores.filter(d =>
    !busca || d.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (d.cpfCnpj || '').includes(busca) ||
    (d.telefone || '').includes(busca)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500">
            {devedores.length} devedor(es) — Total: {formatarMoeda(totalInadimplente)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="🔍 Buscar devedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48"
          />
          <button
            onClick={sincronizarAsaas}
            disabled={sincronizando}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {sincronizando ? '⏳ Verificando...' : '✅ Sincronizar pagos'}
          </button>
          <button
            onClick={buscarDoAsaas}
            disabled={importando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {importando ? '⏳ Buscando...' : '🔄 Importar do Asaas'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            + Cadastrar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Painel de aprovações pendentes */}
        {acordosPendentes.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔔</span>
              <h2 className="font-bold text-yellow-800 text-lg">Negociações aguardando sua aprovação ({acordosPendentes.length})</h2>
            </div>
            <div className="space-y-3">
              {acordosPendentes.map((a) => {
                const desconto = Math.round((1 - Number(a.valorAcordado) / Number(a.valorOriginal)) * 100)
                const fmt = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-yellow-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{a.clienteDevedor.nome}</div>
                      <div className="text-sm text-gray-500">{a.cobranca.descricao}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm">
                        <span className="text-gray-500 line-through">{fmt(a.valorOriginal)}</span>
                        <span className="font-bold text-green-700">{fmt(a.valorAcordado)}</span>
                        {desconto > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{desconto}% desconto</span>}
                        {a.parcelas > 1 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{a.parcelas}x</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => decidirAcordo(a.id, 'rejeitar')}
                        disabled={decidindo === a.id}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                      >
                        ✕ Recusar
                      </button>
                      <button
                        onClick={() => decidirAcordo(a.id, 'aprovar')}
                        disabled={decidindo === a.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {decidindo === a.id ? '...' : '✓ Aprovar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modal preview Asaas */}
        {previewAsaas && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
              <h2 className="text-lg font-bold mb-1">🔄 Inadimplentes no Asaas</h2>
              <p className="text-sm text-gray-500 mb-4">
                {previewAsaas.length} cliente(s) com cobranças vencidas. Confirme para importar.
              </p>
              <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                {previewAsaas.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">Nenhum inadimplente encontrado no Asaas.</p>
                ) : previewAsaas.map((cli, i) => (
                  <div key={i} className="border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{cli.nome}</div>
                        {cli.cpfCnpj && <div className="text-xs text-gray-400">{cli.cpfCnpj}</div>}
                      </div>
                      <div className="text-red-600 font-bold">{formatarMoeda(cli.totalDevido)}</div>
                    </div>
                    <div className="space-y-1">
                      {cli.cobrancas.map((c: any, j: number) => (
                        <div key={j} className="flex justify-between text-xs bg-red-50 rounded px-3 py-1.5">
                          <span className="text-gray-600">{c.descricao}</span>
                          <span className="text-red-600 font-medium">{formatarMoeda(c.valor)} · venc. {new Date(c.vencimento).toLocaleDateString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5 border-t pt-4">
                <button onClick={() => setPreviewAsaas(null)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                {previewAsaas.length > 0 && (
                  <button
                    onClick={confirmarImportacao}
                    disabled={importandoConfirm}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importandoConfirm ? 'Importando...' : `✅ Importar ${previewAsaas.length} cliente(s)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Formulário novo devedor */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="text-lg font-bold mb-4">Cadastrar devedor</h2>
              <div className="space-y-3">
                <input
                  placeholder="Nome *"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="CPF/CNPJ"
                    value={form.cpfCnpj}
                    onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    placeholder="WhatsApp (5531...)"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <select
                  value={form.perfilDevedor}
                  onChange={(e) => setForm({ ...form, perfilDevedor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="primeiro_atraso">Primeiro atraso</option>
                  <option value="segundo_atraso">Segundo atraso</option>
                  <option value="recorrente">Recorrente</option>
                  <option value="longo_prazo">Longo prazo</option>
                </select>
                <hr />
                <input
                  placeholder="Descrição do débito *"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Valor *"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    placeholder="Vencimento *"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={cadastrarDevedor}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Cadastrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal nova cobrança para devedor existente */}
        {showNovaCobranca && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-lg font-bold mb-1">Nova cobrança</h2>
              <p className="text-sm text-gray-500 mb-4">
                {devedores.find((d) => d.id === showNovaCobranca)?.nome}
              </p>
              <div className="space-y-3">
                <input
                  placeholder="Descrição do débito *"
                  value={formCobranca.descricao}
                  onChange={(e) => setFormCobranca({ ...formCobranca, descricao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Valor *"
                    value={formCobranca.valor}
                    onChange={(e) => setFormCobranca({ ...formCobranca, valor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={formCobranca.vencimento}
                    onChange={(e) => setFormCobranca({ ...formCobranca, vencimento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowNovaCobranca(null)}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => adicionarCobranca(showNovaCobranca)}
                  disabled={salvandoCobranca || !formCobranca.descricao || !formCobranca.valor || !formCobranca.vencimento}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {salvandoCobranca ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de conversa WhatsApp */}
        {showConversa && (() => {
          const dv = devedores.find(d => d.id === showConversa)
          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-4 border-b flex items-center justify-between bg-green-600 rounded-t-2xl">
                  <div>
                    <div className="font-bold text-white">{dv?.nome}</div>
                    <div className="text-xs text-green-100">{dv?.telefone || 'sem telefone'} · IA ativa</div>
                  </div>
                  <button onClick={() => setShowConversa(null)} className="text-white hover:text-green-200 text-xl font-bold">✕</button>
                </div>
                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50 min-h-[300px]">
                  {loadingMsgs ? (
                    <div className="text-center text-gray-400 py-10">Carregando...</div>
                  ) : mensagensConversa.length === 0 ? (
                    <div className="text-center text-gray-400 py-10 text-sm">
                      Nenhuma mensagem ainda.<br/>
                      <span className="text-xs">Quando o cliente responder, as mensagens aparecerão aqui.</span>
                    </div>
                  ) : (
                    mensagensConversa.map((m: any) => (
                      <div key={m.id} className={`flex ${m.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                          m.direcao === 'enviada'
                            ? 'bg-green-100 text-gray-800'
                            : 'bg-white text-gray-800 border'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.conteudo}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-gray-400">
                              {new Date(m.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {m.direcao === 'enviada' && (
                              <span className={`text-[10px] ${m.enviado ? 'text-blue-500' : 'text-red-400'}`}>
                                {m.enviado ? '✓✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* Input */}
                <div className="px-4 py-3 border-t flex gap-2">
                  <input
                    type="text"
                    value={msgEnvio}
                    onChange={(e) => setMsgEnvio(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMsgManual()}
                    placeholder="Mensagem manual..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  />
                  <button
                    onClick={enviarMsgManual}
                    disabled={enviandoMsg || !msgEnvio.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {enviandoMsg ? '...' : '➤'}
                  </button>
                  <button
                    onClick={() => abrirConversa(showConversa!)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                    title="Atualizar"
                  >
                    🔄
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : devedores.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-gray-500">Nenhum devedor cadastrado.</p>
            <p className="text-sm text-gray-400 mt-2">Cadastre devedores para ativar a régua de cobrança automática.</p>
          </div>
        ) : devedoresFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Nenhum devedor encontrado para "{busca}"
          </div>
        ) : (
          <div className="space-y-4">
            {devedoresFiltrados.map((d) => {
              const perfil = PERFIL_LABEL[d.perfilDevedor] || { label: d.perfilDevedor, color: 'bg-gray-100 text-gray-600' }
              const totalPendente = d.cobrancas.reduce((s, c) => s + Number(c.valor), 0)
              return (
                <div key={d.id} className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">{d.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${perfil.color}`}>
                          {perfil.label}
                        </span>
                      </div>
                      {d.telefone && <div className="text-xs text-gray-500">📱 {d.telefone}</div>}
                      {d.email && <div className="text-xs text-gray-500">✉️ {d.email}</div>}
                      <div className="text-sm text-red-600 font-semibold mt-2">
                        {formatarMoeda(d.totalDevido)} em aberto
                        {d._count.mensagens > 0 && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">
                            {d._count.mensagens} msg(s) enviada(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {/* Indicador de pausa */}
                      {d.cobrancaPausadaAte && new Date(d.cobrancaPausadaAte) > new Date() && (
                        <span className="text-xs text-amber-600 font-medium">
                          ⏸ Pausado até {new Date(d.cobrancaPausadaAte).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <div className="flex gap-2">
                        {/* Botão pausar/retomar */}
                        {d.cobrancaPausadaAte && new Date(d.cobrancaPausadaAte) > new Date() ? (
                          <button
                            onClick={() => pausarCobranca(d.id, 0)}
                            disabled={pausando === d.id}
                            className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
                          >
                            ▶ Retomar
                          </button>
                        ) : (
                          <button
                            onClick={() => pausarCobranca(d.id, 7)}
                            disabled={pausando === d.id}
                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                          >
                            ⏸ Pausar 7d
                          </button>
                        )}
                        <button
                          onClick={() => abrirConversa(d.id)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 relative"
                        >
                          💬
                          {d._count.mensagens > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                              {d._count.mensagens > 9 ? '9+' : d._count.mensagens}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => cobrar(d.id)}
                          disabled={cobrando === d.id || d.cobrancas.length === 0}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {cobrando === d.id ? 'Enviando...' : '📲 Cobrar agora'}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setFormCobranca({ descricao: '', valor: '', vencimento: '' })
                          setShowNovaCobranca(d.id)
                        }}
                        className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                      >
                        + Nova cobrança
                      </button>
                    </div>
                  </div>

                  {d.cobrancas.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {d.cobrancas.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm bg-red-50 px-3 py-2 rounded-lg">
                          <span className="text-gray-700">{c.descricao}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-red-600 font-medium">{formatarMoeda(c.valor)}</span>
                            <span className="text-gray-400 text-xs">
                              venc. {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                            </span>
                            {c.asaasLink && (
                              <a
                                href={c.asaasLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline"
                              >
                                Link PIX
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
