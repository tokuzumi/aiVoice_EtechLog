import { useEffect, useState } from 'react';
import { Bot, Save, Loader2, Brain, Activity } from 'lucide-react';
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
}


export default function AgentConfig() {
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

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
            showToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Error saving config', error);
            showToast('Erro ao salvar as configurações.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;
    if (!config) return <div>Erro ao carregar.</div>;

    return (
        <div className="flex flex-col gap-4 h-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Bot className="h-6 w-6 text-emerald-500" />
                    <h1 className="text-xl font-bold tracking-tight text-white">Configuração do Agente</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Salvar Alterações
                </button>
            </div>

            {/* Grid Bento Moderno (2 Colunas) - Full Height */}
            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

                {/* Coluna 1: Identidade & Configuração UNIFICADO (3 cols) */}
                <div className="col-span-12 lg:col-span-3 h-full min-h-0">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 h-full flex flex-col relative overflow-y-auto">

                        {/* Badge Online - Topo Direito */}
                        <div className="absolute top-5 right-5 z-10">
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                            </span>
                        </div>

                        {/* Avatar Centralizado (Sem Borda Extra) */}
                        <div className="flex justify-center mt-2 mb-8 shrink-0">
                            <div className="h-32 w-32 rounded-full overflow-hidden shadow-2xl relative">
                                <img
                                    src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1770785437/logomarca_etechlog_ghzjhw.png"
                                    alt="EtechLog Logo"
                                    className="h-full w-full object-contain p-2"
                                />
                            </div>
                        </div>

                        {/* Seção de Controles (Comportamento) */}
                        <div className="flex-1 flex flex-col gap-6">
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <Activity className="h-3 w-3" /> Comportamento
                                </label>

                                <label className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${config.enableAffectiveDialog ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-zinc-700'}`} />
                                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Modo Afetivo</span>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full relative transition-colors ${config.enableAffectiveDialog ? 'bg-pink-700' : 'bg-zinc-800'}`}>
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enableAffectiveDialog ? 'translate-x-4' : 'translate-x-0'}`} />
                                        <input
                                            type="checkbox"
                                            checked={config.enableAffectiveDialog}
                                            onChange={(e) => setConfig({ ...config, enableAffectiveDialog: e.target.checked })}
                                            className="hidden"
                                        />
                                    </div>
                                </label>

                                <label className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${config.proactiveAudio ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-700'}`} />
                                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Proatividade</span>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full relative transition-colors ${config.proactiveAudio ? 'bg-yellow-700' : 'bg-zinc-800'}`}>
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${config.proactiveAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                                        <input
                                            type="checkbox"
                                            checked={config.proactiveAudio}
                                            onChange={(e) => setConfig({ ...config, proactiveAudio: e.target.checked })}
                                            className="hidden"
                                        />
                                    </div>
                                </label>

                                <div className="space-y-2 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-300">Duração Máxima (s)</span>
                                        <span className="text-[10px] text-zinc-500 font-mono italic">aviso aos {Math.round(config.durationLimit * 0.8)}s</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={config.durationLimit}
                                        onChange={(e) => {
                                            const limit = parseInt(e.target.value) || 0;
                                            setConfig({
                                                ...config,
                                                durationLimit: limit,
                                                terminationAlertTime: Math.round(limit * 0.8)
                                            });
                                        }}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 2: Cérebro / System Prompt (9 cols) */}
                <div className="col-span-12 lg:col-span-9 h-full min-h-0 flex flex-col">
                    <div className="h-full bg-zinc-950 border border-zinc-800 rounded-2xl p-0 flex flex-col overflow-hidden relative group">
                        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-50" />

                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/30 shrink-0">
                            <div className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-zinc-400" />
                                <span className="font-bold text-sm text-zinc-300">System Prompt</span>
                            </div>
                            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded border border-zinc-700 font-mono">
                                {config.systemPrompt.length} chars
                            </span>
                        </div>

                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                            className="flex-1 bg-transparent p-6 text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none selection:bg-blue-500/30"
                            placeholder="// Digite aqui as instruções completas do agente..."
                            spellCheck={false}
                        />

                        <div className="p-3 bg-zinc-900/50 border-t border-white/5 text-xs text-zinc-600 text-center shrink-0">
                            O prompt define a personalidade e as regras de negócio do agente.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
