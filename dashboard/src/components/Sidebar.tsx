import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Phone, Bot, Users, LogOut, ChevronDown, Book, Settings, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

const menuItems = [
    { icon: LayoutDashboard, label: 'Painel', path: '/dashboard' },
    { icon: Phone, label: 'Atendimentos', path: '/calls' },
];

const agentSubMenu = [
    { icon: Settings, label: 'Configuração', path: '/agent' },
    { icon: Book, label: 'Base de Conhecimento', path: '/knowledge' },
    { icon: Terminal, label: 'Tools', path: '/tools' },
];

export default function Sidebar() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const [agentOpen, setAgentOpen] = useState(true);

    const isAgentPath = agentSubMenu.some(item => item.path === location.pathname);

    useEffect(() => {
        if (isAgentPath) setAgentOpen(true);
    }, [isAgentPath]);

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-zinc-900 border-r border-white/10 flex flex-col z-50">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <img
                    src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1770670094/etheclog_logo_adubqs.png"
                    alt={import.meta.env.VITE_INSTANCE_CLIENT_NAME || 'EtechLog'}
                    className="h-auto max-h-12 w-auto object-contain"
                />
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group
              ${isActive ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
            `}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span className="text-sm">{item.label}</span>
                        </div>
                        {/* Active Indicator */}
                        {location.pathname === item.path && (
                            <motion.div layoutId="active-nav" className="w-1 h-4 bg-emerald-500 rounded-full" />
                        )}
                    </NavLink>
                ))}

                {/* Menu Agentes com Submenu */}
                <div className="pt-2 pb-2">
                    <button
                        onClick={() => setAgentOpen(!agentOpen)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group
                        ${isAgentPath || agentOpen ? 'text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <Bot className="h-4 w-4" />
                            <span className="text-sm font-medium">Agentes</span>
                        </div>
                        <ChevronDown className={`h-3 w-3 transition-transform ${agentOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {agentOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden pl-4 space-y-1"
                            >
                                {agentSubMenu.map((sub) => (
                                    <NavLink
                                        key={sub.path}
                                        to={sub.path}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                                            ${isActive ? 'text-emerald-500 bg-emerald-500/5' : 'text-zinc-500 hover:text-zinc-300'}
                                        `}
                                    >
                                        <div className={`h-1.5 w-1.5 rounded-full ${location.pathname === sub.path ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                                        <span>{sub.label}</span>
                                    </NavLink>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <NavLink
                    to="/users"
                    className={({ isActive }) => `
              flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group
              ${isActive ? 'bg-emerald-500/10 text-emerald-500 font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
            `}
                >
                    <div className="flex items-center gap-3">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Usuários</span>
                    </div>
                    {location.pathname === '/users' && (
                        <motion.div layoutId="active-nav" className="w-1 h-4 bg-emerald-500 rounded-full" />
                    )}
                </NavLink>

            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-white/5">
                <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between group hover:bg-white/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-xs font-bold text-white">
                            {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white truncate max-w-[100px]">{user?.name || 'Admin'}</span>
                            <span className="text-xs text-zinc-500 truncate max-w-[100px]">{user?.email || 'admin@exemplo'}</span>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        title="Sair"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
