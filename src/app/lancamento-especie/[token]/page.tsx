'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Cliente = { id: string; nome: string; cpfCnpj: string | null }
type Estado = 'carregando' | 'formulario' | 'enviando' | 'sucesso' | 'erro_link'

export default function LancamentoEspeciePage() {
  const { token } = useParams<{ token: string }>()

  const [estado, setEstado] = useState<Estado>('carregando')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [erro, setErro] = useState('')

  // Form
  const [clienteBusca, setClienteBusca] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  const [valor, setValor] = useState('')
  const [referencia, setReferencia] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Resultado
  const [recibo, setRecibo] = useState<any>(null)

  const buscarTimeout = useRef<NodeJS.Timeout>()

  // Valida token ao montar
  useEffect(() => {
    if (!token) { setEstado('erro_link'); return }
    fetch(`/api/v2/especie/buscar-empresa?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.erro) { setEstado('erro_link'); return }
        setNomeEmpresa(d.nomeEmpresa)
        setEstado('formulario')
      })
      .catch(() => setEstado('erro_link'))
  }, [token])

  // Busca clientes com debounce
  const buscarClientes = useCallback((q: string) => {
    clearTimeout(buscarTimeout.current)
    if (q.length < 2) { setSugestoes([]); return }
    buscarTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v2/especie/buscar-clientes?token=${token}&q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSugestoes(data.clientes || [])
      } catch {
        setSugestoes([])
      }
    }, 300)
  }, [token])

  function selecionarCliente(c: Cliente) {
    setClienteSelecionado(c)
    setClienteBusca(c.nome)
    setSugestoes([])
  }

  function formatarValor(v: string): string {
    // Remove tudo que não é número
    const nums = v.replace(/\D/g, '')
    if (!nums) return ''
    // Formata como moeda brasileira: 1500 → "15,00", 150000 → "1.500,00"
    const cents = parseInt(nums, 10)
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function parsearValor(v: string): number {
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const valorNum = parsearValor(valor)
    if (!clienteBusca.trim()) { setErro('Informe o nome do cliente'); return }
    if (valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (!referencia.trim()) { setErro('Informe a referência do pagamento'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/v2/especie/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          clienteNome: clienteSelecionado?.nome || clienteBusca.trim(),
          clienteId: clienteSelecionado?.id || null,
          valor: valorNum,
          referencia: referencia.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setRecibo(data)
      setEstado('sucesso')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function novoLancamento() {
    setClienteBusca('')
    setClienteSelecionado(null)
    setSugestoes([])
    setValor('')
    setReferencia('')
    setErro('')
    setRecibo(null)
    setEstado('formulario')
  }

  // ─── Estados de UI ──────────────────────────────────────────────────────────

  if (estado === 'carregando') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verificando link...</p>
        </div>
      </div>
    )
  }

  if (estado === 'erro_link') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-500 text-sm">Este link de lançamento não é válido ou expirou. Solicite um novo link ao escritório.</p>
        </div>
      </div>
    )
  }

  if (estado === 'sucesso' && recibo) {
    const dataFormatada = new Date(recibo.data).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    const valorFormatado = Number(recibo.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-gray-900">Pagamento registrado!</h1>
            <p className="text-sm text-gray-500 mt-1">Aguardando confirmação do escritório.</p>
          </div>

          {/* Recibo */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Escritório</span>
              <span className="font-medium text-gray-900">{recibo.nomeEmpresa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente</span>
              <span className="font-medium text-gray-900">{recibo.clienteNome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Valor</span>
              <span className="font-bold text-green-600 text-base">{valorFormatado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Referência</span>
              <span className="font-medium text-gray-900 text-right max-w-[180px]">{recibo.referencia}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data/hora</span>
              <span className="text-gray-700">{dataFormatada}</span>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-400 text-center">Protocolo: {recibo.id?.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <button
            onClick={novoLancamento}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            + Registrar outro pagamento
          </button>
        </div>
      </div>
    )
  }

  // ─── Formulário principal ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Lançamento em Espécie</p>
        <h1 className="text-lg font-bold text-gray-900">{nomeEmpresa}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <form onSubmit={enviar} className="space-y-5">
          {/* Cliente */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clienteBusca}
              onChange={e => {
                setClienteBusca(e.target.value)
                setClienteSelecionado(null)
                buscarClientes(e.target.value)
              }}
              placeholder="Digite o nome do cliente..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
              autoCapitalize="words"
            />
            {/* Autocomplete */}
            {sugestoes.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {sugestoes.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selecionarCliente(c)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">{c.nome}</div>
                    {c.cpfCnpj && <div className="text-xs text-gray-400">{c.cpfCnpj}</div>}
                  </button>
                ))}
              </div>
            )}
            {clienteSelecionado && (
              <p className="text-xs text-green-600 mt-1">✓ Cliente encontrado no cadastro</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Valor recebido <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
              <input
                type="tel"
                inputMode="numeric"
                value={valor}
                onChange={e => setValor(formatarValor(e.target.value))}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-base text-right font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Referência */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Referência / Descrição <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ex: Honorários março 2026, Consulta..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoCapitalize="sentences"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {erro}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={enviando}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors mt-2"
          >
            {enviando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registrando...
              </span>
            ) : '💵 Registrar Pagamento'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Este registro ficará pendente até a confirmação do escritório.
          </p>
        </form>
      </div>
    </div>
  )
}
