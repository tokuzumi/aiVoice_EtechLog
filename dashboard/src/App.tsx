import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AgentConfig from './pages/AgentConfig';
import Calls from './pages/Calls';
import Users from './pages/Users';
import ToolsConfig from './pages/ToolsConfig';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

import KnowledgeBase from './pages/KnowledgeBase';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token, loading } = useAuth();
    if (loading) return <div>Carregando...</div>;
    if (!token) return <Navigate to="/login" />;
    return <>{children}</>;
};

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Dashboard />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/agent" element={
                            <ProtectedRoute>
                                <Layout>
                                    <AgentConfig />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/knowledge" element={
                            <ProtectedRoute>
                                <Layout>
                                    <KnowledgeBase />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/calls" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Calls />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/users" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Users />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/tools" element={
                            <ProtectedRoute>
                                <Layout>
                                    <ToolsConfig />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
