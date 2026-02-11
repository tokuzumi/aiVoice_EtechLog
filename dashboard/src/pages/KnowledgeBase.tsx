import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search, X, Loader2, Book, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../components/Toast';

interface KnowledgeItem {
    id: number;
    question: string;
    answer: string;
    categoryId: number | null;
    categoryName: string;
    createdAt: string;
}

interface Category {
    id: number;
    name: string;
}

export default function KnowledgeBase() {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showSheet, setShowSheet] = useState(false);
    const [formData, setFormData] = useState({ id: 0, question: '', answer: '', categoryId: null as number | null });
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const { showToast } = useToast();
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        fetchItems();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/dashboard/categories');
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories', error);
            showToast('Erro ao carregar categorias.', 'error');
        }
    };

    const fetchItems = async () => {
        try {
            const { data } = await api.get('/dashboard/knowledge');
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching knowledge', error);
            showToast('Erro ao carregar base de conhecimento.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setFormData({ id: 0, question: '', answer: '', categoryId: null });
        setIsEditing(false);
        setShowSheet(true);
    };

    const handleOpenEdit = (item: KnowledgeItem) => {
        setFormData({ id: item.id, question: item.question, answer: item.answer, categoryId: item.categoryId });
        setIsEditing(true);
        setShowSheet(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEditing) {
                await api.put(`/dashboard/knowledge/item?id=${formData.id}`, formData);
            } else {
                await api.post('/dashboard/knowledge', formData);
            }
            await fetchItems();
            setShowSheet(false);
            setFormData({ id: 0, question: '', answer: '', categoryId: null });
            showToast('Conhecimento salvo com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar conhecimento', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            await api.delete(`/dashboard/knowledge/item?id=${id}`);
            setItems(items.filter(i => i.id !== id));
            showToast('Item excluído com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir item', 'error');
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 p-8">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xl font-bold text-white">
                    <Book className="h-6 w-6 text-emerald-500" />
                    <h1>Base de Conhecimento</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-zinc-400 text-sm font-bold rounded border border-zinc-800 hover:text-white hover:border-zinc-700 transition-colors"
                    >
                        Gerenciar Categorias
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Adicionar Conhecimento
                    </button>
                </div>
            </div>

            {/* Barra de Ferramentas - Busca Mockada */}
            <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar por perguntas ou respostas..."
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded px-10 py-2 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>
            </div>

            {/* Tabela de Dados */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex-1">
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="text-xs bg-black/40 text-zinc-500 font-bold border-b border-zinc-900">
                        <tr>
                            <th className="px-6 py-4 w-[15%]">Categoria</th>
                            <th className="px-6 py-4 w-[30%] font-bold uppercase tracking-wider">Pergunta</th>
                            <th className="px-6 py-4 w-[40%] font-bold uppercase tracking-wider">Resposta</th>
                            <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 align-top">
                                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase rounded border border-emerald-500/20">
                                        {item.categoryName || 'Sem Categoria'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="text-white font-medium leading-relaxed">{item.question}</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="text-zinc-500 text-sm line-clamp-2 leading-relaxed">{item.answer}</div>
                                </td>
                                <td className="px-6 py-4 text-right align-top">
                                    <div className="flex items-center justify-end gap-2 opacity-100">
                                        <button
                                            onClick={() => handleOpenEdit(item)}
                                            className="p-2 hover:bg-white/10 rounded text-zinc-200 hover:text-white"
                                            title="Editar"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 hover:bg-red-500/20 rounded text-zinc-200 hover:text-red-500"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 italic">
                                    Nenhum conhecimento cadastrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sheet Lateral Animado */}
            <AnimatePresence>
                {showSheet && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowSheet(false)}
                            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <div className="bg-white text-black p-0.5 rounded-full">
                                            {isEditing ? <Edit2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        </div>
                                        {isEditing ? 'Editar Conhecimento' : 'Novo Conhecimento'}
                                    </h2>
                                    <p className="text-zinc-500 text-xs mt-1">Este conteúdo será utilizado pelo agente para responder dúvidas.</p>
                                </div>
                                <button onClick={() => setShowSheet(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="h-5 w-5 text-zinc-400" />
                                </button>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Categoria</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowCategoryModal(true)}
                                                className="text-[10px] text-emerald-500 hover:underline font-bold uppercase"
                                            >
                                                + Nova Categoria
                                            </button>
                                        </div>
                                        <select
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
                                            value={formData.categoryId || ''}
                                            onChange={e => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}
                                        >
                                            <option value="">Selecione uma categoria...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Pergunta</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ex: Qual o horário de atendimento?"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                            value={formData.question}
                                            onChange={e => setFormData({ ...formData, question: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Resposta do Agente</label>
                                        <textarea
                                            required
                                            rows={6}
                                            placeholder="Ex: O nosso horário de atendimento é de segunda a sexta, das 8h às 18h."
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700 resize-none"
                                            value={formData.answer}
                                            onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                        />
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowSheet(false)}
                                    className="px-4 py-2 text-sm font-medium text-white hover:underline"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-6 py-2 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-colors flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="animate-spin h-3 w-3" />}
                                    {isEditing ? 'Salvar Alterações' : 'Adicionar Conhecimento'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Modal de Nova Categoria */}
            <AnimatePresence>
                {showCategoryModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-xl shadow-2xl"
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Nova Categoria</h3>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Nome da categoria..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none mb-6"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const btn = document.getElementById('save-cat-btn');
                                        btn?.click();
                                    }
                                }}
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    id="save-cat-btn"
                                    onClick={async () => {
                                        if (!newCategoryName.trim()) return;
                                        try {
                                            const { data } = await api.post('/dashboard/categories', { name: newCategoryName });
                                            setCategories([...categories, data]);
                                            setFormData({ ...formData, categoryId: data.id });
                                            setNewCategoryName('');
                                            setShowCategoryModal(false);
                                            showToast('Categoria criada!');
                                        } catch (error) {
                                            showToast('Erro ao criar categoria', 'error');
                                        }
                                    }}
                                    className="px-6 py-2 bg-emerald-500 text-black text-sm font-bold rounded hover:bg-emerald-400 transition-colors"
                                >
                                    Criar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


        </div>
    );
}

// Helper to Import missing icons if needed or Bot

// Note: Bot was missing from imports, adding it but it might cause duplicate if I'm not careful.
// Let's check imports.
