import { useState, useRef, useCallback } from 'react';

export type Message = {
    id: string;
    role: 'user' | 'agent' | 'agent_link';
    text: string;
    type: 'text' | 'link';
    url?: string;
    alias?: string;
    timestamp: Date;
};

export const useMessageManager = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesRef = useRef<Message[]>([]);
    const userMessageIdRef = useRef<string | null>(null);
    const agentMessageIdRef = useRef<string | null>(null);

    // Pilar: Consistência - Autoridade Síncrona
    // Atualiza o Ref IMEDIATAMENTE (Síncrono) para que persistTurn tenha o dado fresco
    const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
        const next = updater(messagesRef.current);
        messagesRef.current = next;
        setMessages(next);
    }, []);

    const addMessage = useCallback((role: 'user' | 'agent' | 'agent_link', text: string, type: 'text' | 'link' = 'text', extra?: { url: string; alias: string }) => {
        const id = Math.random().toString(36).substring(7);
        updateMessages(prev => [
            ...prev,
            { id, role, text, type, timestamp: new Date(), ...extra }
        ]);
        return id;
    }, [updateMessages]);

    const updateLiveMessage = useCallback((role: 'user' | 'agent', text: string, isCumulative = false) => {
        const msgIdRef = role === 'user' ? userMessageIdRef : agentMessageIdRef;

        if (!msgIdRef.current) {
            const newId = Math.random().toString(36).substring(7);
            msgIdRef.current = newId;
            updateMessages(prev => [
                ...prev,
                { id: newId, role, text, type: 'text', timestamp: new Date() }
            ]);
        } else {
            const id = msgIdRef.current;
            updateMessages(prev => prev.map(m => {
                if (m.id !== id) return m;
                return { ...m, text: isCumulative ? text : (m.text + text) };
            }));
        }
    }, [updateMessages]);

    const completeTurn = useCallback(() => {
        const historyCount = messagesRef.current.length;
        console.log(`🏁 Turn Complete - Resetting IDs (History so far: ${historyCount})`);
        userMessageIdRef.current = null;
        agentMessageIdRef.current = null;
    }, []);

    const resetHistory = useCallback(() => {
        setMessages([]);
        messagesRef.current = [];
        userMessageIdRef.current = null;
        agentMessageIdRef.current = null;
    }, []);

    return {
        messages,
        messagesRef,
        addMessage,
        updateLiveMessage,
        completeTurn,
        resetHistory
    };
};
