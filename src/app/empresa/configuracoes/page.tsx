'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EmpresaConfiguracoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [testando, setTestando] = useState(false)
  const [testeMsg, setTesteMsg] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarConfig(t)
  }, [router])

  async function carregarConfig(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/empresa/configuracoes', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
      setForm({
        nomeEmpresa: data.nomeEmpresa || '',
        cnpj: data.cnpj || '',
        setor: data.setor || '',
        telefoneAlerta: data.telefoneAlerta || '',
        alertaAtivo: data.alertaAtivo || false,
        metaReceita: data.metaReceita || '',
        metaLucro: data.metaLucro || '',
        asaasAtivo: data.asaasAtivo || false,
        asaasApiKey: '',  // sempre limpo por segurança
        zapiInstanceId: data.zapiInstanceId || '',
        zapiToken: '',
        zapiClientToken: '',
        cobrancaDescontoMax: data.cobrancaDescontoMax || '',
        cobrancaParcelasMax: data.cobrancaParcelasMax || '',
      })
    }
    setLoading(false)
  }

  async function testarWhatsApp() {
    if (!token) return
    setTestando(true)
    setTesteMsg('')
    try {
      const res = await fetch('/api/v2/empresa/zapi/testar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setTesteMsg('✅ ' + data.mensagem)
    } catch (err: any) {
      setTesteMsg('❌ ' + err.message)
    } finally {
      setTestando(false)
    }
  }

  async function salvar() {
    if (!token) return
    setSalvando(true)
    setErro('')
    setSucesso(false)

    // Só envia campos não vazios de credenciais
    const payload: any = { ...form }
    if (!payload.asaasApiKey) delete payload.asaasApiKey
    if (!payload.zapiToken) delete payload.zapiToken
    if (!payload.zapiClientToken) delete payload.zapiClientToken
    if (payload.metaReceita) payload.metaReceita = Number(payload.metaReceita)
    if (payload.metaLucro) payload.metaLucro = Number(payload.metaLucro)
    if (payload.cobrancaDescontoMax) payload.cobrancaDescontoMax = Number(payload.cobrancaDescontoMax)
    if (payload.cobrancaParcelasMax) payload.cobrancaParcelasMax = Number(payload.cobrancaParcelasMax)

    try {
      const res = await fetch('/api/v2/empresa/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const inp = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  )

  if (loading) return <div className="p-10 text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Configurações da Empresa</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Dados básicos */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Dados da empresa</h2>
          {inp('Nome da empresa', 'nomeEmpresa')}
          <div className="grid grid-cols-2 gap-4">
            {inp('CNPJ', 'cnpj', 'text', 'XX.XXX.XXX/0001-XX')}
            {inp('Setor', 'setor', 'text', 'Ex: Advocacia')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {inp('Meta de Receita (R$)', 'metaReceita', 'number')}
            {inp('Meta de Lucro (R$)', 'metaLucro', 'number')}
          </div>
        </div>

        {/* Alertas WhatsApp */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Alertas WhatsApp</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="alertaAtivo"
              checked={form.alertaAtivo}
              onChange={(e) => setForm({ ...form, alertaAtivo: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="alertaAtivo" className="text-sm text-gray-700">
              Receber alertas de vencimento e resumo semanal
            </label>
          </div>
          {inp('Número WhatsApp', 'telefoneAlerta', 'text', '5531999096712')}
          <p className="text-xs text-gray-500">Formato: 55 + DDD + número (sem espaços ou traços)</p>
        </div>

        {/* Asaas */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Asaas (Cobrança)</h2>
          <p className="text-sm text-gray-500">
            Integração com Asaas para gerar links de pagamento PIX e gerenciar cobranças de inadimplentes.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="asaasAtivo"
              checked={form.asaasAtivo}
              onChange={(e) => setForm({ ...form, asaasAtivo: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="asaasAtivo" className="text-sm text-gray-700">Ativar integração Asaas</label>
          </div>
          {form.asaasAtivo && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key Asaas
                  {config?.asaasApiKey && <span className="ml-2 text-xs text-gray-400">(atual: {config.asaasApiKey})</span>}
                </label>
                <input
                  type="password"
                  value={form.asaasApiKey}
                  onChange={(e) => setForm({ ...form, asaasApiKey: e.target.value })}
                  placeholder="Cole a nova key para atualizar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {inp('Desconto máx. (%)', 'cobrancaDescontoMax', 'number', '30')}
                {inp('Parcelas máximas', 'cobrancaParcelasMax', 'number', '12')}
              </div>
            </>
          )}
        </div>

        {/* Z-API */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Z-API (WhatsApp)</h2>
          <p className="text-sm text-gray-500">
            Integração Z-API para enviar mensagens de cobrança personalizadas via WhatsApp.
          </p>
          {inp('Instance ID', 'zapiInstanceId', 'text', 'Ex: 3F13F86C80D15015D87D4AC8C214C6FF')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token
              {config?.zapiToken && <span className="ml-2 text-xs text-gray-400">(atual: {config.zapiToken})</span>}
            </label>
            <input
              type="password"
              value={form.zapiToken}
              onChange={(e) => setForm({ ...form, zapiToken: e.target.value })}
              placeholder="Cole o novo token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Token
              {config?.zapiClientToken && <span className="ml-2 text-xs text-gray-400">(atual: {config.zapiClientToken})</span>}
            </label>
            <input
              type="password"
              value={form.zapiClientToken}
              onChange={(e) => setForm({ ...form, zapiClientToken: e.target.value })}
              placeholder="Cole o novo client token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
        </div>

        {testeMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm ${testeMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {testeMsg}
          </div>
        )}
        {erro && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm">Configurações salvas!</div>}

        <div className="flex gap-3">
          <button
            onClick={testarWhatsApp}
            disabled={testando}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {testando ? 'Enviando...' : '📱 Testar WhatsApp'}
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </main>
    </div>
  )
}
