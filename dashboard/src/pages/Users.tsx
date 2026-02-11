import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search, X, Loader2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../components/Toast';

interface User {
    id: number;
    email: string;
    name: string;
    role: string;
    createdAt: string;
}

export default function Users() {
    const [users, setUsers] = useState<User[]>([]);
    const [showSheet, setShowSheet] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(true);

    const { showToast } = useToast();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/dashboard/users');
            setUsers(data || []);
        } catch (error) {
            showToast('Erro ao carregar usuários.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setSelectedUser(null);
        setFormData({ name: '', email: '', password: '' });
        setShowSheet(true);
    };

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user);
        setFormData({ name: user.name, email: user.email, password: '' });
        setShowSheet(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); // Using general loading for form submission
        try {
            if (selectedUser) {
                await api.put(`/dashboard/users?id=${selectedUser.id}`, formData);
                showToast('Usuário atualizado com sucesso!', 'success');
            } else {
                await api.post('/dashboard/users', formData);
                showToast('Usuário criado com sucesso!', 'success');
            }
            await fetchUsers();
            setShowSheet(false);
        } catch (error) {
            console.error(error);
            showToast('Erro ao processar solicitação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
        try {
            await api.delete(`/dashboard/users?id=${id}`);
            showToast('Usuário excluído com sucesso!', 'success');
            fetchUsers();
        } catch (error) {
            showToast('Erro ao excluir usuário.', 'error');
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 p-8">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xl font-bold text-white">
                    <UsersIcon className="h-6 w-6 text-emerald-500" />
                    <h1>Gerenciamento de Usuários</h1>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Novo Usuário
                </button>
            </div>

            <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded px-10 py-2 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex-1">
                {loading ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-6 w-6 text-zinc-500" /></div>
                ) : (
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="text-xs uppercase bg-black/40 text-zinc-500 font-bold">
                            <tr>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Permissão</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                    onClick={() => handleOpenEdit(user)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center text-white font-bold text-xs uppercase">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{user.name}</div>
                                                <div className="text-xs text-zinc-600">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] uppercase font-bold tracking-wide">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded text-[10px] uppercase font-bold tracking-wide flex items-center w-fit gap-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Ativo
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-2 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <AnimatePresence>
                {showSheet && (
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
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <div className="bg-white text-black p-0.5 rounded-full">
                                            {selectedUser ? <Edit2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        </div>
                                        {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
                                    </h2>
                                    <p className="text-zinc-500 text-xs mt-1">
                                        {selectedUser ? 'Altere as informações do usuário.' : 'Cadastre um novo membro para a equipe.'}
                                    </p>
                                </div>
                                <button onClick={() => setShowSheet(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="h-5 w-5 text-zinc-400" />
                                </button>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Nome Completo</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ex: João Silva"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">E-mail</label>
                                        <input
                                            required
                                            type="email"
                                            placeholder="admin@exemplo.com"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">
                                            {selectedUser ? 'Senha (deixe em branco para manter)' : 'Senha Provisória'}
                                        </label>
                                        <input
                                            required={!selectedUser}
                                            type="password"
                                            placeholder="••••••••"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                                    form="user-form"
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 bg-white text-black text-sm font-bold rounded hover:bg-zinc-200 transition-colors flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="animate-spin h-3 w-3" />}
                                    {selectedUser ? 'Salvar Alterações' : 'Criar Usuário'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function UsersIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
