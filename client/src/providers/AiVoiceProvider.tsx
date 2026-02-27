import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AiVoiceCore, LiveStatus, Message } from '../lib/AiVoiceCore';

interface AiVoiceContextData {
    status: LiveStatus;
    isLive: boolean;
    isThinking: boolean;
    messages: Message[];
    connect: () => Promise<void>;
    disconnect: () => void;
    sendMessage: (text: string) => void;
}

const AiVoiceContext = createContext<AiVoiceContextData | null>(null);

export const AiVoiceProvider: React.FC<{ children: React.ReactNode; agentApiUrl: string; clientName: string }> = ({ children, agentApiUrl, clientName }) => {
    const coreRef = useRef<AiVoiceCore | null>(null);
    const [status, setStatus] = useState<LiveStatus>('idle');
    const [isThinking, setIsThinking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        // Inicializa o Core Singleton
        if (!coreRef.current) {
            coreRef.current = new AiVoiceCore({
                agentApiUrl,
                clientName,
                onStatusChange: setStatus,
                onThinkingChange: setIsThinking,
                onMessagesChange: setMessages
            });
        }

        return () => {
            // Cleanup on unmount
            if (coreRef.current) {
                coreRef.current.disconnect(true);
            }
        };
    }, [agentApiUrl, clientName]);

    const contextValue: AiVoiceContextData = {
        status,
        isLive: status === 'connected',
        isThinking,
        messages,
        connect: async () => {
            // Requer interação do usuário para AudioContext, garantimos isso na UI chamando onClick
            if (coreRef.current) await coreRef.current.connect();
        },
        disconnect: () => {
            if (coreRef.current) coreRef.current.disconnect(true);
        },
        sendMessage: (text: string) => {
            if (coreRef.current) coreRef.current.sendMessage(text);
        }
    };

    return (
        <AiVoiceContext.Provider value={contextValue}>
            {children}
        </AiVoiceContext.Provider>
    );
};

export const useAiVoice = (): AiVoiceContextData => {
    const context = useContext(AiVoiceContext);
    if (!context) {
        throw new Error('useAiVoice deve ser usado dentro de um AiVoiceProvider');
    }
    return context;
};
