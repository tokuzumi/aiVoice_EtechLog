import { useRef, useCallback, useEffect } from 'react';
import { useMessageManager } from './useMessageManager';

export const useTranscriptionManager = () => {
    const { messages, messagesRef, addMessage, updateLiveMessage, completeTurn, resetHistory } = useMessageManager();
    const latestUserTextRef = useRef<string>('');
    const isThinkingRef = useRef(false);

    // Batch Processing Refs
    const messageQueueRef = useRef<any[]>([]);
    const rafIdRef = useRef<number | null>(null);

    // --- Stabilized Dependencies (Refs) ---
    const functionsRef = useRef({
        updateLiveMessage,
        completeTurn,
        commitUserText: (null as any)
    });

    const commitUserText = useCallback(() => {
        if (latestUserTextRef.current) {
            console.log('[useTranscriptionManager] Committing User Text:', latestUserTextRef.current);
            // Access latest updateLiveMessage via ref if needed, but here we can just use the prop
            // Actually, for strict stability, we should use the one in ref? 
            // No, commitUserText effectively captures updateLiveMessage.
            // Let's rely on the fact that functionsRef is updated.
            updateLiveMessage('user', latestUserTextRef.current.trim(), true);
        }
    }, [updateLiveMessage]);

    // Update refs whenever dependencies change (without breaking loop identity)
    useEffect(() => {
        functionsRef.current = { updateLiveMessage, completeTurn, commitUserText };
    }, [updateLiveMessage, completeTurn, commitUserText]);

    const reset = useCallback(() => {
        resetHistory();
        latestUserTextRef.current = '';
        isThinkingRef.current = false;
        messageQueueRef.current = [];
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, [resetHistory]);

    // Batch Processing Logic (Stable Identity)
    const processBatch = useCallback(() => {
        const queue = messageQueueRef.current;

        // Stop loop if empty logic:
        if (queue.length === 0) {
            rafIdRef.current = null;
            return;
        }

        // --- Batch Accumulators ---
        let agentTextDelta = "";
        let userTextToCommit: string | null = null;
        let turnCompleteEncoded = false;

        // --- Process Queue ---
        // Drain entire queue
        const currentBatch = [...queue];
        messageQueueRef.current = [];

        currentBatch.forEach((serverContent) => {
            // 1. Agent Transcriptions
            if (serverContent.modelTurn?.parts || serverContent.model_turn?.parts) {
                isThinkingRef.current = false;
                const parts = serverContent.modelTurn?.parts || serverContent.model_turn?.parts;
                parts.forEach((part: any) => {
                    const text = part.text || part.content;
                    if (text && !part.thought) agentTextDelta += text;
                });
            } else if (serverContent.outputTranscription?.text) {
                isThinkingRef.current = false;
                agentTextDelta += serverContent.outputTranscription.text;
            }

            // 2. User Transcriptions
            const inputT = serverContent.inputTranscription || serverContent.input_transcription || serverContent.inputAudioTranscription;
            if (inputT) {
                const txt = inputT.text || "";
                if (txt) {
                    latestUserTextRef.current += txt;
                    // We only need to render the *latest* state of the user text
                    userTextToCommit = latestUserTextRef.current.trim();
                }
            }

            // 3. Turn Management
            if (serverContent.turnComplete) {
                turnCompleteEncoded = true;
            }
        });

        // --- Perform SINGLE State Updates (using stable refs to prevent recreation) ---
        const { updateLiveMessage, commitUserText: stableCommit, completeTurn } = functionsRef.current;

        if (agentTextDelta) {
            updateLiveMessage('agent', agentTextDelta, false); // isCumulative=false (Append)
        }

        if (userTextToCommit !== null) {
            updateLiveMessage('user', userTextToCommit, true); // isCumulative=true (Replace)
        }

        if (turnCompleteEncoded) {
            isThinkingRef.current = true;
            // Use stable reference to commit
            stableCommit();
            completeTurn();
            latestUserTextRef.current = '';
        }

        // Recursively schedule next frame
        rafIdRef.current = requestAnimationFrame(processBatch);

    }, []); // Empty dependency array = Stable Identity

    // Start/Stop Loop (Only cleanup on unmount)
    useEffect(() => {
        // No auto-start here. Started by data arrival.
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    const processServerContent = useCallback((serverContent: any) => {
        // Intercepta mensagens de link
        if (serverContent.type === 'link_bubble') {
            const { url, alias } = serverContent.payload;
            addMessage('agent_link', alias, 'link', { url, alias });
            return;
        }

        // Just push to queue
        messageQueueRef.current.push(serverContent);

        // "Kick" the loop if sleeping
        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(processBatch);
        }
    }, [processBatch]);

    return {
        messages,
        messagesRef,
        addMessage,
        processServerContent,
        reset,
        isThinkingRef
    };
};
