'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { formatarMoeda, MESES } from '@/lib/utils'

type Transacao = {
  id: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  data: string
  mes: number
  ano: number
  categoria?: { nome: string; cor?: string } | null
  projeto?: { nome: string; cor?: string } | null
  cartao?: string | null
  origem: string
}

type Preview = Transacao & { selecionada: boolean }

export default function PessoalTransacoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState<Preview[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewInfo, setPreviewInfo] = useState<{ banco?: string; periodo?: string } | null>(null)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [loteProgresso, setLoteProgresso] = useState<{ atual: number; total: number; log: string[] } | null>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const loteRef = useRef<HTMLInputElement>(null)
  const xlsRef = useRef<HTMLInputElement>(null)
  const cartaoRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    tipo: 'despesa', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10),
    categoriaId: '', projetoId: '', cartao: '', observacoes: '',
  })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarCategorias(t)
    carregarProjetos(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/pessoal/transacoes?mes=${mes}&ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setTransacoes(await res.json())
    setLoading(false)
  }, [token, mes, ano])

  useEffect(() => { carregar() }, [carregar])

  async function carregarCategorias(t: string) {
    const res = await fetch('/api/v2/pessoal/categorias', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setCategorias(await res.json())
  }

  async function carregarProjetos(t: string) {
    const res = await fetch('/api/v2/pessoal/projetos', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setProjetos(await res.json())
  }

  async function adicionarTransacao() {
    if (!token || !form.descricao || !form.valor || !form.data) return
    const res = await fetch('/api/v2/pessoal/transacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, valor: Number(form.valor), categoriaId: form.categoriaId || null, projetoId: form.projetoId || null }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ tipo: 'despesa', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), categoriaId: '', projetoId: '', cartao: '', observacoes: '' })
      carregar()
    }
  }

  async function deletar(id: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/transacoes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregar()
  }

  async function atualizarCategoria(id: string, categoriaId: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/transacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ categoriaId: categoriaId || null }),
    })
    carregar()
  }

  async function importarCartao(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro('')
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v2/pessoal/transacoes/importar-cartao', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setPreview(data.transacoes.map((t: any) => ({
        ...t,
        id: Math.random().toString(),
        selecionada: true,
        origem: 'cartao',
        categoria: t.categoria ? { nome: String(t.categoria) } : null,
      })))
      setPreviewInfo({ banco: data.cartao, periodo: data.fatura })
      setShowPreview(true)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportando(false)
      if (cartaoRef.current) cartaoRef.current.value = ''
    }
  }

  async function importarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro('')
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v2/pessoal/transacoes/importar-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setPreview(data.transacoes.map((t: any) => ({
        ...t,
        id: Math.random().toString(),
        selecionada: true,
        categoria: t.categoria ? { nome: String(t.categoria) } : null,
      })))
      setPreviewInfo({ banco: data.banco, periodo: data.periodo })
      setShowPreview(true)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportando(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  async function importarLote(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !token) return
    setErro('')
    setLoteProgresso({ atual: 0, total: files.length, log: [] })
    const h = { Authorization: `Bearer ${token}` }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setLoteProgresso((p) => p ? { ...p, atual: i + 1, log: [...p.log, `⏳ ${file.name}...`] } : p)
      try {
        // 1. Extrair com IA
        const fd = new FormData()
        fd.append('file', file)
        const resAI = await fetch('/api/v2/pessoal/transacoes/importar-pdf', {
          method: 'POST', headers: h, body: fd,
        })
        const aiData = await resAI.json()
        if (!resAI.ok || !aiData.transacoes?.length) {
          setLoteProgresso((p) => p ? { ...p, log: [...p.log.slice(0, -1), `❌ ${file.name} — ${aiData.erro || 'sem transações'}`] } : p)
          continue
        }
        // 2. Importar direto (sem preview)
        const resImp = await fetch('/api/v2/pessoal/transacoes/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({
            banco: aiData.banco,
            periodo: aiData.periodo,
            nomeArquivo: file.name,
            tipoImport: 'pdf',
            transacoes: aiData.transacoes,
          }),
        })
        const impData = await resImp.json()
        setLoteProgresso((p) => p ? {
          ...p,
          log: [...p.log.slice(0, -1), `✅ ${file.name} — ${impData.total} transações (${aiData.periodo || aiData.banco})`]
        } : p)
      } catch (err: any) {
        setLoteProgresso((p) => p ? { ...p, log: [...p.log.slice(0, -1), `❌ ${file.name} — ${err.message}`] } : p)
      }
    }

    if (loteRef.current) loteRef.current.value = ''
    carregar()
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro('')
    setImportando(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Detecta cabeçalho
      let headerIdx = -1
      let colMap: Record<string, number> = {}
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i].map((c: any) => String(c).toUpperCase())
        if (row.some((c) => c.includes('DATA') && row.some((c2) => c2.includes('DESCRICAO') || c2.includes('VALOR')))) {
          headerIdx = i
          row.forEach((col, idx) => {
            if (col === 'DATA' || col.startsWith('DATA')) colMap.data = idx
            if (col.includes('DESCRICAO') || col.includes('DESCRIÇÃO')) colMap.descricao = idx
            if (col.includes('VALOR')) colMap.valor = idx
            if (col.includes('TIPO')) colMap.tipo = idx
            if (col.includes('CATEGORIA')) colMap.categoria = idx
          })
          break
        }
      }
      if (headerIdx === -1) throw new Error('Cabeçalho não encontrado. Use colunas: Data, Descrição, Valor, Tipo')

      const lista: Preview[] = []
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        const dataRaw = row[colMap.data]
        if (!dataRaw) continue
        const valorRaw = row[colMap.valor]
        const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(',', '.')) || 0
        if (valor === 0) continue
        const dataStr = typeof dataRaw === 'number'
          ? new Date((dataRaw - 25569) * 86400 * 1000).toISOString().slice(0, 10)
          : String(dataRaw)
        const d = new Date(dataStr)
        lista.push({
          id: Math.random().toString(),
          tipo: valor < 0 || String(row[colMap.tipo] || '').toLowerCase().includes('despesa') ? 'despesa' : 'receita',
          descricao: String(row[colMap.descricao] || '').trim(),
          valor: Math.abs(valor),
          data: dataStr,
          mes: d.getMonth() + 1,
          ano: d.getFullYear(),
          categoria: { nome: row[colMap.categoria] ? String(row[colMap.categoria]).trim() : 'Outros' },
          origem: 'importacao_excel',
          selecionada: true,
        })
      }
      setPreview(lista)
      setPreviewInfo(null)
      setShowPreview(true)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportando(false)
      if (xlsRef.current) xlsRef.current.value = ''
    }
  }

  async function confirmarImport() {
    if (!token) return
    const selecionadas = preview.filter((t) => t.selecionada)
    const res = await fetch('/api/v2/pessoal/transacoes/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        banco: previewInfo?.banco,
        periodo: previewInfo?.periodo,
        nomeArquivo: previewInfo?.banco ? `Extrato ${previewInfo.banco} ${previewInfo.periodo ?? ''}`.trim() : 'importação_excel',
        tipoImport: previewInfo?.banco ? 'pdf' : 'excel',
        transacoes: selecionadas.map((t) => ({
          tipo: t.tipo,
          descricao: t.descricao,
          valor: t.valor,
          data: t.data,
          categoria: t.categoria?.nome,
          origem: t.origem,
        })),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setShowPreview(false)
      setPreview([])
      alert(`${data.total} transações importadas!`)
      carregar()
    }
  }

  const filtradas = transacoes.filter((t) => filtroTipo === 'todos' || t.tipo === filtroTipo)
  const totalReceitas = transacoes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
  const totalDespesas = transacoes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Transações</h1>
          <div className="flex gap-2">
            <button onClick={() => pdfRef.current?.click()} disabled={importando}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {importando ? '...' : '📄 PDF'}
            </button>
            <button onClick={() => loteRef.current?.click()} disabled={importando}
              className="px-3 py-2 bg-purple-400 text-white rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50"
              title="Importar vários PDFs de uma vez">
              📄+ Vários
            </button>
            <button onClick={() => cartaoRef.current?.click()} disabled={importando}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
              {importando ? '...' : '💳 Fatura'}
            </button>
            <button onClick={() => xlsRef.current?.click()} disabled={importando}
              className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
              {importando ? '...' : '📊 Excel'}
            </button>
            <button onClick={() => setShowForm(true)}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              + Nova
            </button>
          </div>
          <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={importarPdf} />
          <input ref={loteRef} type="file" accept=".pdf" multiple className="hidden" onChange={importarLote} />
          <input ref={cartaoRef} type="file" accept=".pdf" className="hidden" onChange={importarCartao} />
          <input ref={xlsRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} />
        </div>

        {/* Período + filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={`${mes}-${ano}`}
            onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].flatMap((a) =>
              Array.from({ length: 12 }, (_, i) => (
                <option key={`${i+1}-${a}`} value={`${i + 1}-${a}`}>{MESES[i + 1]} {a}</option>
              ))
            )}
          </select>
          {(['todos', 'receita', 'despesa'] as const).map((f) => (
            <button key={f} onClick={() => setFiltroTipo(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${filtroTipo === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f === 'todos' ? 'Todos' : f === 'receita' ? `Receitas ${formatarMoeda(totalReceitas)}` : `Despesas ${formatarMoeda(totalDespesas)}`}
            </button>
          ))}
        </div>
      </header>

      {erro && (
        <div className="max-w-3xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{erro}</div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl mt-8 shadow-2xl">
            <div className="p-5 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-gray-900">Prévia da importação</h2>
                  {previewInfo && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {previewInfo.banco} — {previewInfo.periodo}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 text-sm">
                  <button onClick={() => setPreview(preview.map((t) => ({ ...t, selecionada: true })))} className="text-blue-600">Todas</button>
                  <button onClick={() => setPreview(preview.map((t) => ({ ...t, selecionada: false })))} className="text-gray-400">Nenhuma</button>
                </div>
              </div>
            </div>
            <div className="max-h-[28rem] overflow-auto p-4 space-y-1">
              {preview.map((t, i) => (
                <div key={i} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                  <input type="checkbox" checked={t.selecionada}
                    onChange={(e) => {
                      const p = [...preview]; p[i].selecionada = e.target.checked; setPreview(p)
                    }}
                  />
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="flex-1 text-sm text-gray-700 truncate min-w-0">{t.descricao}</span>
                  <select
                    value={t.categoria?.nome ?? ''}
                    onChange={(e) => {
                      const p = [...preview]
                      p[i] = { ...p[i], categoria: e.target.value ? { nome: e.target.value } : null }
                      setPreview(p)
                    }}
                    className="text-xs border rounded px-1.5 py-1 text-gray-600 bg-white max-w-[130px]"
                  >
                    <option value="">Sem categoria</option>
                    {['Supermercado','Restaurante','Combustível','Transporte','Moradia','Saúde','Educação','Lazer','Vestuário','Loja / Compras','Serviços / Assinaturas','Impostos pessoais','Investimentos','Salário','Freelance / Consultoria','Empréstimos','Outros'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                  <span className={`text-sm font-medium flex-shrink-0 ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.tipo === 'despesa' ? '-' : '+'}{formatarMoeda(t.valor)}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500">{preview.filter((t) => t.selecionada).length} selecionada(s)</span>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={confirmarImport} disabled={preview.filter((t) => t.selecionada).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  Importar {preview.filter((t) => t.selecionada).length}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form nova transação */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold mb-4">Nova transação</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['despesa', 'receita'] as const).map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.tipo === t ? (t === 'receita' ? 'bg-green-600 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-600'}`}>
                    {t === 'receita' ? 'Receita' : 'Despesa'}
                  </button>
                ))}
              </div>
              <input placeholder="Descrição *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Valor *" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Categoria (opcional)</option>
                {categorias.filter((c) => c.tipo === form.tipo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              {projetos.length > 0 && (
                <select value={form.projetoId} onChange={(e) => setForm({ ...form, projetoId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Projeto (opcional)</option>
                  {projetos.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              )}
              <input placeholder="Cartão (opcional)" value={form.cartao} onChange={(e) => setForm({ ...form, cartao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
              <button onClick={adicionarTransacao} className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium ${form.tipo === 'receita' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">💳</div>
            <p>Nenhuma transação encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map((t) => (
              <div key={t.id} className="bg-white rounded-xl px-5 py-3.5 shadow-sm border flex items-center justify-between group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{t.descricao}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(t.data).toLocaleDateString('pt-BR')}
                      {t.projeto && <span className="ml-2">· 📁 {t.projeto.nome}</span>}
                      {t.cartao && <span className="ml-2">· {t.cartao}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <select
                    value={t.categoria?.nome ?? ''}
                    onChange={(e) => {
                      const catId = categorias.find((c) => c.nome === e.target.value)?.id ?? ''
                      atualizarCategoria(t.id, catId)
                    }}
                    className="text-xs border rounded px-1.5 py-1 text-gray-500 bg-white max-w-[130px] hidden group-hover:block"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.filter((c) => c.tipo === t.tipo).map((c: any) => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                  {t.categoria && <span className="text-xs text-gray-400 group-hover:hidden">{t.categoria.nome}</span>}
                  {!t.categoria && <span className="text-xs text-orange-400 group-hover:hidden cursor-pointer">+ categoria</span>}
                  <span className={`font-bold text-sm ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.tipo === 'despesa' ? '-' : '+'}{formatarMoeda(t.valor)}
                  </span>
                  <button onClick={() => deletar(t.id)} className="text-red-400 hover:text-red-600 text-sm font-bold transition px-1 flex-shrink-0" title="Excluir">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal progresso lote */}
      {loteProgresso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">📄</div>
              <div>
                <h3 className="font-bold text-gray-900">Importação em lote</h3>
                <p className="text-xs text-gray-500">{loteProgresso.atual} de {loteProgresso.total} arquivos</p>
              </div>
              <div className="ml-auto">
                <div className="text-sm font-bold text-green-600">{Math.round((loteProgresso.atual / loteProgresso.total) * 100)}%</div>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${(loteProgresso.atual / loteProgresso.total) * 100}%` }} />
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {loteProgresso.log.map((linha, i) => (
                <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${
                  linha.startsWith('✅') ? 'bg-green-50 text-green-700' :
                  linha.startsWith('❌') ? 'bg-red-50 text-red-600' :
                  'bg-gray-50 text-gray-500'
                }`}>{linha}</div>
              ))}
            </div>
            {loteProgresso.atual === loteProgresso.total && (
              <button
                onClick={() => setLoteProgresso(null)}
                className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700"
              >
                Concluído — fechar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
