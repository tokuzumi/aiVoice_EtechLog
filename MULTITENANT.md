# Blueprint: Implantação de Nova Instância aiVoice (Multi-Tenant)

Este guia define o passo a passo para criar um ambiente isolado e "White-Label" para um novo cliente.

## 1. Configuração do `.env` (Obrigatório)

Cada nova instância deve ter seu próprio diretório no servidor (ex: `/opt/cliente_x`) e um arquivo `.env` configurado seguindo o modelo abaixo:

```env
# Identificação Multi-Tenant
INSTANCE_ID=aivoice
INSTANCE_CLIENT_NAME=aiVoice
VITE_INSTANCE_ID=aivoice
VITE_INSTANCE_CLIENT_NAME=aiVoice
COMPOSE_PROJECT_NAME=aivoice_v3

# Portas de Ofuscação (Expostas) - Devem ser ÚNICAS no host
PORT_CLIENT=5175
PORT_DASHBOARD=5176
PORT_BACKEND=8082
PORT_DASHSERVER=8083
PORT_MEILI=7702
DB_PORT=5434

# Configurações do Google Cloud Vertex AI
GOOGLE_PROJECT_ID=seu-projeto-id
GOOGLE_LOCATION=us-central1

# Gemini API Key
GEMINI_API_KEY=SUA_CHAVE_AQUI

# Domínios (Traefik) - Apenas para Produção
DOMAIN_WEBSITE=aivoice.com.br
DOMAIN_API=api.aivoice.com.br
DOMAIN_DASHBOARD=dash.aivoice.com.br
DOMAIN_DASH_API=api-dash.aivoice.com.br

# Configurações do Banco de Dados (PostgreSQL)
DB_HOST=postgres
DB_USER=aivoice_user
DB_PASSWORD=aivoice_pass
DB_NAME=aivoice_db
DATABASE_URL=postgres://aivoice_user:aivoice_pass@postgres:5432/aivoice_db

# DASHBOARD_INTERNAL_URL (Comunicação entre Backend e DashServer no Docker)
DASHBOARD_INTERNAL_URL=http://dash-server:8081

# OpenAi ApiKey para geração de embeddings
OPENAI_API_KEY=SUA_CHAVE_AQUI

# Seguranca (Obrigatório: No mínimo 16 caracteres para Produção)
JWT_SECRET=super_secret_jwt_aivoice_v3_9a8b7c6d5e
MEILI_MASTER_KEY=aivoice_master_key_v3_producao_16chars
MEILI_HOST=http://meilisearch:7700
```

---

> [!WARNING]
> **Segurança do Meilisearch**: Em ambiente de produção, o Meilisearch **exige** que a `MEILI_MASTER_KEY` tenha pelo menos **16 bytes (caracteres)**. Se for menor, o container entrará em loop de erro e a busca não funcionará.

## 2. Redes e Isolamento
O sistema utiliza o `COMPOSE_PROJECT_NAME` para criar redes e volumes isolados automaticamente. 
- **Volumes**: O Docker prefixará os volumes (ex: `aivoice_cliente1_postgres_data`), garantindo que os dados nunca se misturem.
- **Traefik**: O roteamento é feito puramente por host (DNS). O firewall do servidor só precisa das portas 80/443 abertas.

## 3. GitHub CI/CD (Onboarding)
Configure as seguintes variáveis no GitHub em **Settings > Secrets and variables > Actions**:

#### Aba "Variables" (Para visibilidade nos logs)
*   `INSTANCE_ID`: ID em minúsculas (ex: `aivoicev3`).
*   `INSTANCE_CLIENT_NAME`: Nome amigável (ex: `aiVoice`).

#### Aba "Secrets" (Dados Sensíveis)
*   `DOMAIN_WEBSITE`, `DOMAIN_API`, `DOMAIN_DASHBOARD`, `DOMAIN_DASH_API`
*   `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`
*   `JWT_SECRET`, `MEILI_MASTER_KEY`

O pipeline `deploy.yml` utiliza `vars.INSTANCE_ID` para que o nome apareça claramente nos logs em vez de `***`.

## 4. Banco de Dados (Auto-Seed)
Não é necessário rodar scripts SQL manuais para o cliente. 
- Ao subir o container `orchestrator` pela primeira vez, ele identificará que o cliente não existe e criará automaticamente:
    1. O registro do cliente na tabela `aiVoice_clients`.
    2. A configuração padrão (Prompt, Voz, etc.) na tabela `aiVoice_config`.

---

> [!IMPORTANT]
> **Checklist de Novo Cliente**:
> 1. [ ] DNS apontado para o Servidor (A Records).
> 2. [ ] Variáveis cadastradas no GitHub Actions.
> 3. [ ] Diretório `/opt/id_do_cliente` criado no servidor.
> 4. [ ] `.env` local na pasta do servidor configurado com as portas únicas.

---

## 5. Troubleshooting (Resolução de Problemas)

### Erro: Dashboard ou Site Inacessível/Conflito
Se você subir uma nova instância e o Dashboard de outro cliente parar de funcionar:
1. **Verifique os Secrets no GitHub**: Veja se `DOMAIN_API` ou `DOMAIN_DASH_API` não foram preenchidos com os domínios de outro cliente por engano.
2. **Remova Containers Fantasmas**: Se você mudou o `INSTANCE_ID`, os containers antigos (ex: `backend_NomeAntigo`) podem continuar rodando e segurando o domínio no Traefik.
    - **Solução**: `docker rm -f $(docker ps -a -q --filter "name=ID_ANTIGO")`
3. **Limpe as Redes**: Redes órfãs podem causar colisões internas. 
    - **Solução**: `docker network prune -f`

> [!TIP]
> Use sempre **letras minúsculas** e nomes curtos para o `INSTANCE_ID`. Isso evita erros de sintaxe no Docker e facilita a leitura dos logs.
