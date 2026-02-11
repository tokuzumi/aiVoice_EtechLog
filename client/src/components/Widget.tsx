import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

interface WidgetProps {
    onClick: () => void;
    status: 'idle' | 'connecting' | 'connected' | 'error';
}

export const Widget: React.FC<WidgetProps> = ({ onClick, status }) => {
    const isConnected = status === 'connected';
    const isConnecting = status === 'connecting';

    const marqueeText = isConnected
        ? "aiVoice ativo ... pergunte o que quiser!"
        : isConnecting
            ? "Conectando o aiVoice ..."
            : "aguardando você...";

    return (
        <motion.button
            onClick={onClick}
            className="fixed bottom-8 right-8 z-50 flex items-center justify-between gap-6 bg-black border border-white/10 rounded-full h-16 pl-6 pr-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-105 transition-all duration-300 group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{
                opacity: 1,
                y: 0,
                borderColor: isConnected ? ["rgba(255,255,255,0.1)", "rgba(134,239,172,0.6)", "rgba(255,255,255,0.1)"] : "rgba(255,255,255,0.1)"
            }}
            transition={{
                duration: 0.5,
                delay: 0.5,
                borderColor: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
        >
            {/* Logo Icon */}
            <div className="relative flex-shrink-0 flex items-center justify-center">
                <img
                    src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1757012939/icon_white_dvgutb.png"
                    alt="aiVoice Icon"
                    className={`h-5 w-auto transition-opacity duration-300 ${isConnected ? 'opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'opacity-90'}`}
                />
            </div>

            {/* Scrolling Text Container */}
            <div className="overflow-hidden w-[180px] h-full flex items-center relative mask-linear-fade">
                <motion.div
                    className="whitespace-nowrap flex gap-0 text-white/[0.65] font-sans text-[14px] font-medium tracking-wide items-center"
                    animate={{ x: "-50%" }}
                    transition={{
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 12,
                        ease: "linear",
                    }}
                >
                    {/* First Copy */}
                    <div className="flex items-center gap-6 pr-6">
                        <span className="flex items-center gap-6">
                            <span>{marqueeText}</span>
                            <span className="text-[8px] opacity-40">■</span>
                        </span>
                        <span className="flex items-center gap-6">
                            <span>{marqueeText}</span>
                            <span className="text-[8px] opacity-40">■</span>
                        </span>
                    </div>
                    {/* Second Copy (for seamless loop) */}
                    <div className="flex items-center gap-6 pr-6">
                        <span className="flex items-center gap-6">
                            <span>{marqueeText}</span>
                            <span className="text-[8px] opacity-40">■</span>
                        </span>
                        <span className="flex items-center gap-6">
                            <span>{marqueeText}</span>
                            <span className="text-[8px] opacity-40">■</span>
                        </span>
                    </div>
                </motion.div>
                {/* Gradient Masks for fade effect */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />
            </div>

            {/* Static Arrow Icon */}
            <div className="text-white/70 group-hover:text-white transition-colors">
                <ArrowUpRight size={18} strokeWidth={2.5} />
            </div>
        </motion.button>
    );
};
