# aiVoice v3.5 (Stable)

## 🎙️ Introdução
O **aiVoice v3.5** é uma implementação de referência completa para agentes de voz de alta performance utilizando a **Gemini Live API (Multimodal Service)**. Esta versão consolida a **Arquitetura Multi-Tenant**, permitindo múltiplas instâncias isoladas no mesmo servidor, e introduz a **Busca Semântica v1.35.0** com Meilisearch.

---

> [!IMPORTANT]
> **REGRA DE OURO:**
> O modelo configurado é o **`models/gemini-2.5-flash-native-audio-preview-12-2025`**.
> **NÃO ALTERE ESTE VALOR** no código do Orchestrator.
> Esta versão é a que garante a latência ultra-baixa e a estabilidade nativa de áudio implementada nesta arquitetura.

## 🚀 Arquitetura Multi-Tenant v3.5 (Enterprise Ready)
Esta versão foca em isolamento total e escalabilidade:

### 1. Plano de Dados (Data Plane) - Agente de Voz
*   **Serviço**: `backend` (Go) | Porta Interna: `8080` | Local: `8082`
*   **Front-end**: `client` (React/Vite) | Porta Interna: `5173` | Local: `5175`
*   **Função**: Focado em latência ultra-baixa e comunicação via WebSockets.

### 2. Plano de Controle (Control Plane) - Administração
*   **Serviço**: `dash-server` (Go) | Porta Interna: `8081` | Local: `8083`
*   **Front-end**: `dashboard` (React/Vite) | Porta Interna: `5173` | Local: `5176`
*   **Função**: Gestão de prompts, usuários, logs e base de conhecimento.

### 3. Inteligência e Persistência
*   **Meilisearch v1.35.0**: Busca Semântica via OpenAI (Embeddings 1536). Porta Local: `7702`.
*   **PostgreSQL 17**: Persistência robusta com suporte a UPSERT incremental. Porta Local: `5434`.

---

## ⚙️ Configuração Dinâmica (Dashboard)
O Dashboard permite controlar o comportamento do agente em tempo real:
- **Modo Afetivo**: Injeta instruções de empatia e variação tonal.
- **Proatividade**: Define se o agente deve tomar a iniciativa na conversa.
- **Tooling Intelligence**: Edição direta de docstrings para RAG, Terminal e Envio de Links.

## 📦 Desenvolvimento e Testes Locais
O ambiente local utiliza o arquivo `docker-compose.yml` e o arquivo `.env` na raiz.

### Acesso Local (Default)
| Serviço | URL | Credenciais Padrão |
| :--- | :--- | :--- |
| **Agente de Voz** | [http://localhost:5175](http://localhost:5175) | *(Acesso ao Widget)* |
| **Dashboard Admin** | [http://localhost:5176](http://localhost:5176) | **Login**: `admin@exemplo.com` / `admin123` |
| **API Dashboard** | [http://localhost:8083](http://localhost:8083) | *(Documentação JSON)* |

---

## 🚀 Deploy e CI/CD (GitHub Actions)
O deploy é 100% automatizado via GitHub Actions (`deploy.yml`).

> [!TIP]
> **GitHub Variables vs Secrets**:
> - Use **Variables** para `INSTANCE_ID` e `INSTANCE_CLIENT_NAME` (para visibilidade nos logs).
> - Use **Secrets** para senhas, chaves de API e domínios.

### Nova Instância?
Para subir um novo cliente, consulte o [MULTITENANT.md](file:///c:/Users/Daniel%20Tokuzumi/Documents/TkzM%20Studio/aiVoice/starter/MULTITENANT.md).

---
*Este documento é a fonte única de verdade para o aiVoice v3.5.*
