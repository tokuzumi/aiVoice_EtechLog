import { useEffect, useState } from 'react';
import { Clock, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { cn } from '../utils/cn';

interface Call {
    id: number;
    callId: string;
    clientName: string;
    transcript: any; // JSONB
    durationSeconds: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    createdAt: string;
}

export default function Calls() {
    const [calls, setCalls] = useState<Call[]>([]);
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 7;

    const totalPages = Math.ceil(calls.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCalls = calls.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    useEffect(() => {
        fetchCalls();
    }, []);

    const fetchCalls = async () => {
        try {
            const { data } = await api.get('/dashboard/calls');
            setCalls(data || []);
        } catch (error) {
            console.error('Error fetching calls', error);
        }
    };

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}m ${sec}s`;
    };

    return (
        <div className="relative h-full overflow-y-auto p-8">
            <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-3xl font-bold">Atendimentos</h1>
                <p className="text-zinc-400">Histórico de conversas realizadas pelo agente.</p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-xs uppercase text-zinc-400">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Duração</th>
                                <th className="p-4">Tokens (I/O)</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paginatedCalls.map((call) => (
                                <tr key={call.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-zinc-500">#{call.id}</td>
                                    <td className="p-4 font-medium">{call.clientName}</td>
                                    <td className="p-4 text-zinc-400">{new Date(call.createdAt).toLocaleString()}</td>
                                    <td className="p-4 flex items-center gap-1 text-zinc-300">
                                        <Clock className="h-3 w-3" />
                                        {formatDuration(call.durationSeconds)}
                                    </td>
                                    <td className="p-4 font-mono text-xs text-zinc-400">
                                        {call.inputTokens} / {call.outputTokens}
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-[10px] font-bold border uppercase",
                                            (call.status?.toLowerCase() === 'active') ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                (call.status?.toLowerCase() === 'interrupted' || call.status?.toLowerCase() === 'terminated') ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-green-500/10 text-green-500 border-green-500/20"
                                        )}>
                                            {call.status || 'Completed'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => setSelectedCall(call)}
                                            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FileText className="h-4 w-4" /> Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedCalls.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-zinc-500">Nenhum atendimento registrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {calls.length > ITEMS_PER_PAGE && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">
                            Mostrando {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, calls.length)} de {calls.length}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs font-medium rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="px-2 py-1 text-xs text-zinc-400 flex items-center">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs font-medium rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                Próximo
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Lateral Sheet Details */}
            <AnimatePresence>
                {selectedCall && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedCall(null)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-white/10 z-50 p-6 shadow-2xl overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Detalhes do Atendimento #{selectedCall.id}</h2>
                                <button onClick={() => setSelectedCall(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="p-4 bg-white/5 rounded-xl space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400 text-sm">Início</span>
                                        <span className="font-medium">{new Date(selectedCall.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400 text-sm">Duração</span>
                                        <span className="font-medium">{formatDuration(selectedCall.durationSeconds)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                                        <span className="text-zinc-400 text-sm">Tokens Entrada</span>
                                        <span className="font-medium text-blue-400">{selectedCall.inputTokens}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400 text-sm">Tokens Saída</span>
                                        <span className="font-medium text-purple-400">{selectedCall.outputTokens}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                                        <span className="text-zinc-400 text-sm">Status</span>
                                        <span className="font-medium uppercase text-xs">{selectedCall.status}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-600 font-mono mt-4 break-all">
                                        ID: {selectedCall.callId}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-400" /> Transcrição do Atendimento
                                    </h3>
                                    <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-6 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar shadow-inner">
                                        {Array.isArray(selectedCall.transcript) && selectedCall.transcript.length > 0 ? (
                                            selectedCall.transcript.map((msg: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className={cn(
                                                        "flex gap-3 max-w-[90%]",
                                                        msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                                                    )}
                                                >
                                                    {/* Avatar / Inicial */}
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1 shadow-lg",
                                                        msg.role === 'user' ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300 border border-white/10"
                                                    )}>
                                                        {msg.role === 'user' ? 'U' : 'AI'}
                                                    </div>

                                                    <div className={cn(
                                                        "flex flex-col",
                                                        msg.role === 'user' ? "items-end" : "items-start"
                                                    )}>
                                                        <div
                                                            className={cn(
                                                                "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                                                                msg.role === 'user'
                                                                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none"
                                                                    : "bg-zinc-800/80 text-zinc-200 rounded-tl-none border border-white/10"
                                                            )}
                                                        >
                                                            {(() => {
                                                                const text = msg.text;
                                                                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                                                                const parts = [];
                                                                let lastIndex = 0;
                                                                let match;

                                                                while ((match = linkRegex.exec(text)) !== null) {
                                                                    if (match.index > lastIndex) {
                                                                        parts.push(text.substring(lastIndex, match.index));
                                                                    }
                                                                    parts.push(
                                                                        <a
                                                                            key={match.index}
                                                                            href={match[2]}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium"
                                                                        >
                                                                            {match[1]}
                                                                        </a>
                                                                    );
                                                                    lastIndex = linkRegex.lastIndex;
                                                                }

                                                                if (lastIndex < text.length) {
                                                                    parts.push(text.substring(lastIndex));
                                                                }

                                                                return parts.length > 0 ? parts : text;
                                                            })()}
                                                        </div>
                                                        <span className="text-[9px] text-zinc-500 mt-1.5 uppercase tracking-wider font-semibold opacity-60">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
                                                <FileText className="h-8 w-8 opacity-20" />
                                                <span className="text-sm">Nenhuma mensagem registrada nesta chamada.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
