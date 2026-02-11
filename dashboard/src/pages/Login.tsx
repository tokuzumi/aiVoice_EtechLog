import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast'; // Added this import
import api from '../services/api';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });

    const { login } = useAuth();
    const { showToast } = useToast(); // Added this line
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('/auth/login', formData);
            login(response.data.token);
            showToast('Bem-vindo de volta!', 'success'); // Added this line
            navigate('/dashboard');
        } catch (error) {
            console.error('Login failed', error);
            showToast('Credenciais inválidas. Tente novamente.', 'error'); // Replaced alert() with showToast()
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-5 bg-black text-white overflow-hidden">
            {/* Coluna da Imagem (4/5) - Sem texto, apenas a imagem imersiva */}
            <div className="col-span-5 lg:col-span-4 relative overflow-hidden hidden lg:block">
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] hover:scale-105"
                    style={{ backgroundImage: `url('https://res.cloudinary.com/dco1sm3hy/image/upload/v1765158141/home_bg_ayshsz.jpg')` }}
                />
                {/* Gradiente sutil para integração visual, mas sem esconder a imagem */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/80" />
            </div>

            {/* Coluna do Formulário (1/5) - Ocupa 100% em mobile, 20% em desktop */}
            <div className="col-span-5 lg:col-span-1 flex flex-col p-8 bg-zinc-950 border-l border-white/5 relative z-10 shadow-2xl h-full">

                {/* Main Content Area - Vertically Centered */}
                <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto">

                    {/* Logo - 80% Width */}
                    <div className="w-full flex justify-center lg:justify-start mb-10">
                        <img
                            src="https://res.cloudinary.com/dco1sm3hy/image/upload/v1757012939/aiVoice_white_h1iae6.png"
                            alt={import.meta.env.VITE_INSTANCE_CLIENT_NAME || 'aiVoice'}
                            className="w-[80%] h-auto"
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="w-full space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-white">Email Corporativo</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-zinc-500" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="block w-full pl-10 pr-3 py-3 bg-zinc-900 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="admin@exemplo.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-white">Senha de Acesso</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-zinc-500" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="block w-full pl-10 pr-10 py-3 bg-zinc-900 border border-zinc-800 rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white text-black rounded font-bold text-sm uppercase tracking-wide hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed !mt-12"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "ENTRAR"
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Fixed at Bottom */}
                <div className="w-full text-center pb-2 shrink-0">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
                        Desenvolvido por TkzM Studio
                    </p>
                </div>
            </div>
        </div>
    );
}
