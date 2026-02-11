import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils/cn';
import Threads from './components/Threads/Threads';
import { Chat } from './components/Chat';
import { useLiveAPI } from './hooks/useLiveAPI';
import { Widget } from './components/Widget';

export default function App() {
    const { messages, isLive, status, connect, disconnect, sendMessage } = useLiveAPI();
    const [stageMode, setStageMode] = useState<'intro' | 'active'>('intro');

    // Reactively update stage based on connection status
    useEffect(() => {
        if (isLive) {
            setStageMode('active');
        } else if (status === 'idle' || status === 'error') {
            setStageMode('intro');
        }
    }, [isLive, status]);

    const handleWidgetClick = () => {
        if (isLive) {
            disconnect();
        } else {
            connect();
        }
    };


    return (
        <div className="relative h-screen w-screen bg-black overflow-hidden selection:bg-white/20 font-sans">
            {/* Threads Background with Blur Transition */}
            <div className="absolute inset-0 w-full h-full z-0 opacity-50">
                <Threads
                    amplitude={1}
                    distance={0}
                    enableMouseInteraction={false}
                />
                <motion.div
                    className="absolute inset-0 z-0 bg-transparent"
                    animate={{ backdropFilter: stageMode === 'active' ? 'blur(20px)' : 'blur(0px)' }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>

            {/* Central Chat Interface */}
            <Chat
                messages={messages}
                onSendMessage={sendMessage}
                isVisible={stageMode === 'active'}
            />

            {/* Center Logo (Scale down/fade out when active) */}
            <AnimatePresence>
                {stageMode === 'intro' && (
                    <motion.div
                        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full scale-150 opacity-20" />
                            <img
                                src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1770670094/etheclog_logo_adubqs.png"
                                alt={`${import.meta.env.VITE_INSTANCE_CLIENT_NAME || 'EtechLog'} Logo`}
                                className="h-16 w-auto relative z-10 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)] opacity-90"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Persistent Widget */}
            <Widget
                onClick={handleWidgetClick}
                status={status}
            />

            <style>{`
                .mask-linear-fade {
                    mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
                }
            `}</style>
        </div>
    );
}
