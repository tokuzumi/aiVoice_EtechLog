# Checklist: Variáveis e Secrets para Deploy (GitHub Actions)

Este documento lista **todas** as configurações necessárias no repositório GitHub para realizar o deploy automatizado e isolado do **aiVoice v3.5**.

> **Projetos de Exemplo:** Os valores abaixo usam o cliente **"EtechLog"** como referência.

## 1. Environment Variables (Aba "Variables")
*Configurações públicas, de branding e identificação.*

| Nome da Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `INSTANCE_ID` | `etechlog` | ID único, minúsculo, sem espaços. |
| `INSTANCE_CLIENT_NAME` | `EtechLog` | Nome amigável para exibição nos logs/titulo. |
| `DOMAIN_WEBSITE` | `etechlog.aivoice.com.br` | URL do Widget/Chat (Frontend). |
| `DOMAIN_API` | `etechlog-api.aivoice.com.br` | URL do Orchestrator (Backend). |
| `DOMAIN_DASHBOARD` | `etechlog-dash.aivoice.com.br` | URL do Painel Administrativo. |
| `DOMAIN_DASH_API` | `etechlog-dashapi.aivoice.com.br` | URL da API do Dashboard. |
| `VITE_CLIENT_TITLE` | `EtechLog - Atendimento Inteligente` | Título da aba do navegador. |
| `VITE_CLIENT_DESCRIPTION` | `Agente virtual especializado em logística.` | Meta descrição para SEO. |

---

## 2. Repository Secrets (Aba "Secrets")
*Credenciais sensíveis e chaves de criptografia.*

| Nome da Secret | Valor de Exemplo (Placeholder) | Descrição |
| :--- | :--- | :--- |
| `GH_PAT` | `ghp_12345...` | Token de Acesso Pessoal (Packages R/W). |
| `SERVER_IP` | `192.168.1.100` | Endereço IP do Servidor VPS. |
| `SERVER_USER` | `ubuntu` | Usuário SSH (geralmente root ou ubuntu). |
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH PRIVATE KEY...` | Chave privada para conexão SSH. |
| `DB_USER` | `etechlog_admin` | Usuário do PostgreSQL (único por cliente). |
| `DB_PASSWORD` | `s3nh4_F0rt3_EtechLog!2024` | Senha do PostgreSQL. |
| `DB_NAME` | `etechlog_db` | Nome do Banco (único por cliente). |
| `JWT_SECRET` | `geVADwC7EpVT_p8Fcc5uXRKNiya5FqECnT6HN7nxLW-F_Ydl1XsXfBAn1-2JCBcZ9sYGhholAuVtFDYlrZSTvdg` | Chave para assinar tokens (+32 chars). |
| `MEILI_MASTER_KEY` | `hI2EXtlxs-TIlGmZjgzu-1G_RDJsM-XnirKKeQSiDXc` | Chave Mestra do Meilisearch (+16 bytes). |
| `OPENAI_API_KEY` | `sk-...` | Chave da OpenAI para embeddings/chat. |
| `GEMINI_API_KEY` | `AIza...` | Chave do Google Gemini para voz/chat. |

---

## 3. Como usar esta lista

1.  Vá em **Settings > Secrets and variables > Actions** no repositório GitHub.
2.  Na aba **Variables**, crie/atualize os itens da seção 1.
3.  Na aba **Secrets**, crie/atualize os itens da seção 2.
4.  Dispare o workflow `deploy.yml`.

> ⚠️ **Nota:** O arquivo `deploy.yml` foi configurado para injetar automaticamente essas secrets no ambiente de execução do Docker, garantindo que o servidor não precise de arquivos `.env` manuais para rodar.
