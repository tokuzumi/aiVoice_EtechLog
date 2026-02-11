import { Users, Phone, Zap, TrendingUp } from 'lucide-react';

export default function Dashboard() {
    return (
        <div className="h-full overflow-y-auto p-8 space-y-6">
            {/* Cards de Métricas (Mini Cards Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: 'TOTAL DE ATENDIMENTOS (HOJE)', value: '0', sub: 'Baseado nas conversas de hoje', icon: Phone, change: '+12.5%', trend: 'up' },
                    { title: 'ATENDIMENTOS QUALIFICADOS', value: '0', sub: 'Negócios criados hoje', icon: Users, change: '+5.2%', trend: 'up' },
                    { title: 'AGENDAMENTOS CRIADOS', value: '0', sub: 'Funcionalidade em breve', icon: Zap, change: '-10s', trend: 'down', good: true },
                    { title: 'PENDÊNCIAS CRÍTICAS', value: '0', sub: 'Funcionalidade em breve', icon: TrendingUp, change: '-1.2%', trend: 'down', good: false },
                ].map((stat, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-start min-h-[120px]">
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">{stat.title}</p>
                        <h3 className="text-3xl font-bold text-white mb-1">{stat.value}</h3>
                        <p className="text-zinc-600 text-xs">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Gráfico Principal (Lead Flow Map Style) */}
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-lg min-h-[400px] relative">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-zinc-500 text-sm font-medium">Lead Flow Map - Hoje: {new Date().toLocaleDateString()}</h3>
                        <p className="text-4xl font-bold text-white mt-2">0</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20 transition-colors">Hoje</button>
                        <button className="px-3 py-1 text-zinc-500 text-xs hover:text-white transition-colors">Mês Atual</button>
                    </div>
                </div>

                {/* Mock Visual do Flow */}
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-zinc-900 rounded-xl">
                    <p className="text-zinc-700 text-sm font-mono">[ Visualização de Funil do Agente ]</p>
                </div>
            </div>

            {/* Últimas Atividades Footer */}
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-lg">
                <h3 className="flex items-center gap-2 text-white font-bold text-base">
                    <div className="h-4 w-4 rounded border border-white/20" /> Últimas Atividades
                </h3>
            </div>
        </div>
    );
}
