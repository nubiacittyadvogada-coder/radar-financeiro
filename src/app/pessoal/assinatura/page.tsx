'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Pagamento = {
  id: string
  valor: string | number
  status: string
  vencimento: string
  pagoEm: string | null
  linkPagamento: string | null
  criadoEm: string
}

type Assinatura = {
  id: string
  plano: string
  status: string
  valorMensal: string | number
  venceEm: string | null
  linkPagamento: string | null
  criadoEm: string
  pagamentos?: Pagamento[]
}

type StatusData = {
  plano: string
  planoValidoAte: string | null
  assinatura: Assinatura | null
}

const PLANO_CORES: Record<string, string> = {
  basico: 'bg-gray-100 text-gray-700',
  pro: 'bg-blue-100 text-blue-700',
  premium: 'bg-green-100 text-green-700',
}

const STATUS_CORES: Record<string, string> = {
  ativa: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  cancelada: 'bg-gray-100 text-gray-500',
  inadimplente: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  ativa: 'Ativa',
  pendente: 'Aguardando pagamento',
  cancelada: 'Cancelada',
  inadimplente: 'Inadimplente',
}

function fmt(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function AssinaturaPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState('')
  // Checkout inline
  const [planoSelecionado, setPlanoSelecionado] = useState<string | null>(null)
  const [billingType, setBillingType] = useState('PIX')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [assinalando, setAssinalando] = useState(false)
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    // Detecta ?plano= na URL
    const params = new URLSearchParams(window.location.search)
    const planoParam = params.get('plano')
    if (planoParam && ['pro', 'premium'].includes(planoParam)) setPlanoSelecionado(planoParam)
    fetch('/api/v2/assinatura/status', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(setData)
      .catch(() => setErro('Erro ao carregar status da assinatura.'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleAssinar() {
    if (!token || !planoSelecionado) return
    setAssinalando(true)
    setErro('')
    try {
      const res = await fetch('/api/v2/assinatura/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plano: planoSelecionado, billingType, cpfCnpj: cpfCnpj || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.erro || 'Erro ao processar assinatura')
      if (json.linkPagamento) {
        setLinkPagamento(json.linkPagamento)
      } else {
        // Recarrega status
        const r2 = await fetch('/api/v2/assinatura/status', { headers: { Authorization: `Bearer ${token}` } })
        setData(await r2.json())
        setPlanoSelecionado(null)
      }
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setAssinalando(false)
    }
  }

  async function cancelar() {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Seu acesso fica ativo até o final do período pago.')) return
    setCancelando(true)
    setErro('')
    try {
      const r = await fetch('/api/v2/assinatura/cancelar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || 'Erro ao cancelar')
      // Recarrega dados
      const r2 = await fetch('/api/v2/assinatura/status', { headers: { Authorization: `Bearer ${token}` } })
      setData(await r2.json())
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setCancelando(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-400">Carregando...</div>
    )
  }

  const planoAtual = data?.plano || 'basico'
  const assinatura = data?.assinatura
  const planoNome = planoAtual === 'pro' ? 'Pro' : planoAtual === 'premium' ? 'Premium' : 'Básico'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Plano</h1>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{erro}</div>
      )}

      {/* ── CHECKOUT INLINE ── */}
      {planoSelecionado && !linkPagamento && (
        <div className="bg-white rounded-xl border-2 border-green-500 shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">
                Assinar plano {planoSelecionado === 'pro' ? 'Pro' : 'Premium'}
              </h2>
              <p className="text-sm text-gray-500">
                {planoSelecionado === 'pro' ? 'R$ 29,90/mês' : 'R$ 49,90/mês'}
              </p>
            </div>
            <button onClick={() => setPlanoSelecionado(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Forma de pagamento</label>
              <div className="flex gap-2">
                {[
                  { value: 'PIX', label: '⚡ PIX' },
                  { value: 'BOLETO', label: '📄 Boleto' },
                  { value: 'CREDIT_CARD', label: '💳 Cartão' },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setBillingType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      billingType === opt.value ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">CPF ou CNPJ <span className="text-gray-400 font-normal">(opcional, para NF)</span></label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
              />
            </div>

            <button
              onClick={handleAssinar}
              disabled={assinalando}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {assinalando ? 'Processando...' : `Confirmar assinatura ${planoSelecionado === 'pro' ? 'Pro — R$ 29,90/mês' : 'Premium — R$ 49,90/mês'}`}
            </button>
            <p className="text-xs text-gray-400 text-center">Você receberá o link de pagamento após confirmar. Cancele quando quiser.</p>
          </div>
        </div>
      )}

      {/* Link de pagamento gerado */}
      {linkPagamento && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
          <div className="text-3xl mb-3">🎉</div>
          <h2 className="font-bold text-green-900 mb-2">Assinatura criada!</h2>
          <p className="text-sm text-green-700 mb-4">Clique no botão abaixo para pagar e ativar seu plano.</p>
          <a href={linkPagamento} target="_blank" rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition">
            Pagar agora →
          </a>
          <p className="text-xs text-green-600 mt-3">Após o pagamento, seu plano é ativado automaticamente.</p>
        </div>
      )}

      {/* Plano atual */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Plano atual</div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${PLANO_CORES[planoAtual] || PLANO_CORES.basico}`}>
              {planoNome}
            </span>
          </div>
          {data?.planoValidoAte && planoAtual !== 'basico' && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Válido até</div>
              <div className="text-sm font-medium text-gray-700">{fmtDate(data.planoValidoAte)}</div>
            </div>
          )}
        </div>

        {planoAtual === 'basico' && (
          <div className="mt-2">
            <p className="text-sm text-gray-500 mb-3">
              Você está no plano gratuito. Faça upgrade para desbloquear todas as funcionalidades.
            </p>
            <Link
              href="/planos"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Ver planos e precos
            </Link>
          </div>
        )}
      </div>

      {/* Status da assinatura */}
      {assinatura && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Assinatura</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Status</div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CORES[assinatura.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[assinatura.status] || assinatura.status}
              </span>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Valor mensal</div>
              <div className="text-sm font-medium text-gray-700">{fmt(assinatura.valorMensal)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Plano</div>
              <div className="text-sm font-medium text-gray-700 capitalize">{assinatura.plano}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Próximo vencimento</div>
              <div className="text-sm font-medium text-gray-700">{fmtDate(assinatura.venceEm)}</div>
            </div>
          </div>

          {assinatura.status === 'pendente' && assinatura.linkPagamento && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 mb-2 font-medium">Pagamento pendente — finalize para ativar seu plano.</p>
              <a
                href={assinatura.linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 transition"
              >
                Pagar agora
              </a>
            </div>
          )}

          {assinatura.status === 'inadimplente' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">Sua assinatura está inadimplente. Regularize para recuperar o acesso.</p>
            </div>
          )}

          {(assinatura.status === 'ativa' || assinatura.status === 'pendente') && (
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <Link
                href="/planos"
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                Ver outros planos
              </Link>
              {assinatura.status === 'ativa' && (
                <button
                  onClick={cancelar}
                  disabled={cancelando}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                  {cancelando ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pagamentos recentes */}
      {assinatura?.pagamentos && assinatura.pagamentos.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Pagamentos recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 font-medium">Vencimento</th>
                  <th className="text-left pb-2 font-medium">Valor</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Pago em</th>
                </tr>
              </thead>
              <tbody>
                {assinatura.pagamentos.map((pg) => (
                  <tr key={pg.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-700">{fmtDate(pg.vencimento)}</td>
                    <td className="py-2 text-gray-700">{fmt(pg.valor)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        pg.status === 'RECEIVED' || pg.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : pg.status === 'OVERDUE'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {pg.status === 'RECEIVED' || pg.status === 'CONFIRMED' ? 'Pago' : pg.status === 'OVERDUE' ? 'Vencido' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{fmtDate(pg.pagoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sem assinatura */}
      {!assinatura && planoAtual === 'basico' && (
        <div className="bg-white rounded-xl border shadow-sm p-6 text-center">
          <div className="text-4xl mb-3">⭐</div>
          <h3 className="font-semibold text-gray-900 mb-2">Desbloqueie todo o potencial</h3>
          <p className="text-sm text-gray-500 mb-4">
            Assine o plano Pro ou Premium para importações ilimitadas, IA e muito mais.
          </p>
          <Link
            href="/planos"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Ver planos
          </Link>
        </div>
      )}
    </div>
  )
}
