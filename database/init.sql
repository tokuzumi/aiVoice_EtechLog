-- Tabelas de Clientes e Configurações (Estrutura apenas)
CREATE TABLE IF NOT EXISTS aiVoice_clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aiVoice_config (
    id SERIAL PRIMARY KEY,
    client_id INTEGER UNIQUE REFERENCES aiVoice_clients(id) ON DELETE CASCADE,
    voice_name VARCHAR(100) DEFAULT 'Aoede',
    language_code VARCHAR(50) DEFAULT 'pt-BR',
    temperature FLOAT DEFAULT 0.7,
    thinking_budget INTEGER DEFAULT 0,
    enable_affective_dialog BOOLEAN DEFAULT false,
    proactive_audio BOOLEAN DEFAULT false,
    system_prompt TEXT,
    docstring_tool_knowledge TEXT,
    docstring_tool_terminate TEXT,
    docstring_tool_send_link TEXT,
    proactive_alert_instruction TEXT DEFAULT '',
    duration_limit INTEGER DEFAULT 300,
    termination_alert_time INTEGER DEFAULT 210,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelas para o Dashboard e Histórico
CREATE TABLE IF NOT EXISTS dashboard_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aiVoice_calls (
    id SERIAL PRIMARY KEY,
    call_id UUID UNIQUE NOT NULL,
    client_id INTEGER REFERENCES aiVoice_clients(id),
    transcript JSONB DEFAULT '[]'::jsonb,
    duration_seconds INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aivoice_calls_client_updated ON aiVoice_calls(client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_aivoice_calls_call_id ON aiVoice_calls(call_id);
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para Base de Conhecimento (Atualizada com Categoria)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category_id INTEGER REFERENCES knowledge_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserção do usuário administrador padrão (Senha: admin123)
INSERT INTO dashboard_users (email, password_hash, name, role)
VALUES ('admin@exemplo.com', '$2a$10$uSjHFAk9k.iIpsY5MNd3MuA4cSSM4HauEkeN1Xc.8s0FJi.0LJ6LC', 'Administrador', 'admin')
ON CONFLICT (email) DO NOTHING;
