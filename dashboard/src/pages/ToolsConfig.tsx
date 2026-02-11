import { useEffect, useState } from 'react';
import { Terminal, Save, Loader2, BookOpen, Search, Edit2, X, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../components/Toast';

interface AIConfig {
    voiceName: string;
    languageCode: string;
    temperature: number;
    thinkingBudget: number;
    enableAffectiveDialog: boolean;
    proactiveAudio: boolean;
    systemPrompt: string;
    docstringToolKnowledge: string;
    docstringToolTerminate: string;
    proactiveAlertInstruction: string;
    durationLimit: number;
    terminationAlertTime: number;
    docstringToolSendLink: string;
}

interface ToolItem {
    id: string;
    name: string;
    description: string;
    type: string;
    status: 'active' | 'inactive' | 'coming_soon';
}

export default function ToolsConfig() {
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSheet, setShowSheet] = useState(false);
    const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null);
    const { showToast } = useToast();

    // Mock de ferramentas (por enquanto apenas a de conhecimento é funcional via banco)
    const tools: ToolItem[] = [
        {
            id: 'knowledge',
            name: 'consultar_base_conhecimento',
            description: 'Recuperação de informações semânticas (RAG)',
            type: 'Base de Conhecimento',
            status: 'active'
        },
        {
            id: 'terminate',
            name: 'finalizar_atendimento',
            description: 'Encerramento natural ou forçado da sessão',
            type: 'System Tool',
            status: 'active'
        },
        {
            id: 'sendLink',
            name: 'sendLink',
            description: 'Envio de links clicáveis com alias personalizado',
            type: 'Communication Tool',
            status: 'active'
        },
        {
            id: 'calendar',
            name: 'google_calendar_booking',
            description: 'Agendamento de reuniões e consultas',
            type: 'Google Workspace',
            status: 'coming_soon'
        },
        {
            id: 'crm',
            name: 'crm_lead_update',
            description: 'Atualização de status de leads e histórico',
            type: 'External API',
            status: 'coming_soon'
        }
    ];

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data } = await api.get('/dashboard/config');
            setConfig(data);
        } catch (error) {
            console.error('Error fetching config', error);
            showToast('Erro ao carregar configurações.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await api.put('/dashboard/config', config);
            setShowSheet(false);
            showToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Error saving config', error);
            showToast('Erro ao salvar as instruções da ferramenta.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openEditSheet = (tool: ToolItem) => {
        if (tool.status === 'coming_soon') return;
        setSelectedTool(tool);
        setShowSheet(true);
    };

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;

    return (
        <div className="h-full flex flex-col gap-4 p-8">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xl font-bold text-white">
                    <Terminal className="h-6 w-6 text-emerald-500" />
                    <h1>Gerenciamento de Tools</h1>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar ferramenta pelo nome..."
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded px-10 py-2 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>
                <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
                    <span className="text-zinc-500 text-xs font-bold uppercase">Categoria:</span>
                    <select className="bg-zinc-900 border-none text-white text-sm rounded outline-none cursor-pointer">
                        <option>Todas</option>
                        <option>Ativas</option>
                    </select>
                </div>
            </div>

            {/* Tools Table */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex-1">
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="text-xs uppercase bg-black/40 text-zinc-500 font-bold">
                        <tr>
                            <th className="px-6 py-4">Ferramenta</th>
                            <th className="px-6 py-4">Tipo/Integração</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                        {tools.map((tool) => (
                            <tr key={tool.id} className={`transition-colors group ${tool.status === 'coming_soon' ? 'opacity-40' : 'hover:bg-white/5 cursor-pointer'}`} onClick={() => openEditSheet(tool)}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded flex items-center justify-center font-bold text-xs bg-zinc-800 text-white`}>
                                            {tool.id === 'knowledge' ? <BookOpen className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{tool.name}</div>
                                            <div className="text-xs text-zinc-600">{tool.description}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] uppercase font-bold tracking-wide">
                                        {tool.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {tool.status === 'active' ? (
                                        <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded text-[10px] uppercase font-bold tracking-wide flex items-center w-fit gap-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Ativa
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-600 rounded text-[10px] uppercase font-bold tracking-wide">
                                            {tool.status === 'coming_soon' ? 'Em breve' : 'Inativa'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                                        <button
                                            disabled={tool.status === 'coming_soon'}
                                            className="p-2 hover:bg-white/10 rounded text-white transition-colors disabled:opacity-0"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Side Sheet for Editing */}
            <AnimatePresence>
                {showSheet && selectedTool && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowSheet(false)}
                            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <Terminal className="h-6 w-6 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white tracking-tight">Editar Ferramenta</h2>
                                        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{selectedTool.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowSheet(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="h-5 w-5 text-zinc-400" />
                                </button>
                            </div>

                            <div className="flex-1 p-8 overflow-y-auto space-y-8">
                                {/* Tool Metadata */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Integração</span>
                                        <span className="text-sm text-zinc-300 font-medium">{selectedTool.type}</span>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Endpoint</span>
                                        <span className="text-sm text-zinc-300 font-mono">
                                            {selectedTool.id === 'knowledge' ? '/api/knowledge/search' : 'Session Control'}
                                        </span>
                                    </div>
                                </div>

                                {/* Docstring Editor */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="h-3 w-3 text-emerald-500" /> Manual de Uso da Ferramenta (Docstring)
                                        </label>
                                        <span className="text-[10px] font-mono text-zinc-600">
                                            {((selectedTool.id === 'knowledge' ? config?.docstringToolKnowledge : config?.docstringToolTerminate) || '').length} caracteres
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 leading-relaxed italic">
                                        Descreva para o Gemini **o que esta ferramenta faz** e **quando** ele deve acioná-la. Isso define o comportamento técnico do assistente.
                                    </p>
                                    <textarea
                                        value={
                                            selectedTool.id === 'knowledge'
                                                ? (config?.docstringToolKnowledge || '')
                                                : selectedTool.id === 'terminate'
                                                    ? (config?.docstringToolTerminate || '')
                                                    : (config?.docstringToolSendLink || '')
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setConfig(prev => {
                                                if (!prev) return null;
                                                if (selectedTool.id === 'knowledge') return { ...prev, docstringToolKnowledge: val };
                                                if (selectedTool.id === 'terminate') return { ...prev, docstringToolTerminate: val };
                                                return { ...prev, docstringToolSendLink: val };
                                            });
                                        }}
                                        className="w-full h-64 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-emerald-500/50 transition-all focus:ring-1 focus:ring-emerald-500/20"
                                        placeholder="Digite as instruções aqui..."
                                    />
                                </div>

                                {selectedTool.id === 'terminate' && (
                                    <>
                                        <div className="space-y-3 pt-6 border-t border-zinc-800">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Activity className="h-3 w-3 text-blue-500" /> Instrução do Alerta Proativo
                                                </label>
                                                <span className="text-[10px] font-mono text-zinc-600">
                                                    {(config?.proactiveAlertInstruction || '').length} caracteres
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 leading-relaxed italic">
                                                Esta é a **mensagem específica** enviada ao agente no momento do alerta. Utilize para definir o tom de voz e o script de aviso.
                                            </p>
                                            <textarea
                                                value={config?.proactiveAlertInstruction || ''}
                                                onChange={(e) => setConfig(prev => prev ? { ...prev, proactiveAlertInstruction: e.target.value } : null)}
                                                className="w-full h-32 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-blue-500/50 transition-all focus:ring-1 focus:ring-blue-500/20"
                                                placeholder="Digite a instrução do alerta aqui..."
                                            />
                                        </div>

                                        <div className="space-y-6 pt-6 border-t border-zinc-800">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Activity className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Configurações de Tempo</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo Máximo (Segundos)</label>
                                                    <input
                                                        type="number"
                                                        value={config?.durationLimit || 0}
                                                        onChange={(e) => setConfig(prev => prev ? { ...prev, durationLimit: parseInt(e.target.value) } : null)}
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-blue-500/50 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Alerta de Finalização (Segundos)</label>
                                                    <input
                                                        type="number"
                                                        value={config?.terminationAlertTime || 0}
                                                        onChange={(e) => setConfig(prev => prev ? { ...prev, terminationAlertTime: parseInt(e.target.value) } : null)}
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-blue-500/50 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-zinc-600 italic">
                                                O alerta deve ocorrer antes do tempo máximo (ex: Limite 1800s, Alerta 1620s).
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowSheet(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-2.5 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center gap-2 "
                                >
                                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
