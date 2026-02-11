import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen w-screen bg-black text-white overflow-hidden">
            <Sidebar />
            <main className="flex-1 ml-64 h-full flex flex-col relative overflow-hidden">
                {/* 
                  Container principal sem padding global padrão.
                  Cada página deve definir seu próprio padding e comportamento de scroll.
                */}
                <div className="flex-1 h-full w-full relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
