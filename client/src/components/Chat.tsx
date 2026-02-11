import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot } from 'lucide-react';
import { Message } from '../hooks/useMessageManager';

interface ChatProps {
    messages: Message[];
    onSendMessage: (text: string) => void;
    isVisible: boolean;
}

export const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, isVisible }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isVisible]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 10 }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 will-change-transform"
                >
                    <div className="w-full max-w-lg h-[65vh] flex flex-col pointer-events-auto">

                        {/* Glassmorphism Container - Premium Effect */}
                        <div className="flex-1 flex flex-col bg-gradient-to-b from-white/5 to-transparent backdrop-blur-md border border-white/10 rounded-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36),_inset_0_0_0_1px_rgba(255,255,255,0.05),_inset_0_1px_0_0_rgba(255,255,255,0.1)] overflow-hidden relative font-sans">

                            {/* Header */}
                            <div className="p-4 pl-6 border-b border-white/5 flex items-center justify-start">
                                <img
                                    src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1770785207/logo_texto_q4jiwm.png"
                                    alt="EtechLog"
                                    className="h-6 w-auto opacity-90 object-contain"
                                />
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">


                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex max-w-[95%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                            {/* Avatar */}
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-white/10' : 'bg-white/5'
                                                }`}>
                                                {msg.role === 'user' ? (
                                                    <User size={14} className="text-white/70" />
                                                ) : (
                                                    <img
                                                        src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1757012939/icon_white_dvgutb.png"
                                                        alt="Agent"
                                                        className="w-4 h-4 opacity-90 object-contain"
                                                    />
                                                )}
                                            </div>

                                            {/* Bubble */}
                                            {msg.type === 'link' ? (
                                                <a
                                                    href={msg.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="relative px-6 py-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] backdrop-blur-md group hover:from-emerald-500/30 hover:to-emerald-600/20 transition-all duration-300 flex items-center gap-3 decoration-none no-underline"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Send size={14} className="rotate-45" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{msg.alias}</span>
                                                        <span className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Abrir em nova janela</span>
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className={`relative px-5 py-3 rounded-xl text-[15px] leading-relaxed shadow-sm backdrop-blur-md ${msg.role === 'user'
                                                    ? 'bg-white/10 text-white border border-white/10 rounded-tr-sm'
                                                    : 'bg-black/30 text-white/90 border border-white/5 rounded-tl-sm'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-white/5">
                                <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Digite sua mensagem..."
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-6 py-4 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all font-light"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputValue.trim()}
                                        className="absolute right-2 p-2 bg-white text-black rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
