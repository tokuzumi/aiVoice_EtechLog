# Integração Gemini Live API: Fonte de Verdade

Este documento descreve a implementação técnica atual da integração com a Gemini Live API. 
*Última atualização: Baseada na análise do código em execução.*

## 1. Status da Migração para o Backend
Conforme solicitado, abaixo listamos os itens que ainda residem no Frontend e que devem ser considerados para migração ou limpeza, já que a arquitetura visa centralizar o processamento no Backend.

| Componente | Localização Atual | Status / Observação |
| :--- | :--- | :--- |
| **Payload de Setup** | Frontend (`useLiveAPI.ts`) | **Redundante.** O Frontend envia um JSON completo com `model`, `generationConfig`, etc. O Backend *ignora* este conteúdo e gera um novo payload baseado no Banco de Dados. **Ação:** Frontend deve enviar apenas um sinal de "start" vazio. |
| **Monitoramento de Tools** | Frontend (`useLiveAPI.ts`) | **Parcialmente Redundante.** O Frontend inspeciona mensagens para `finalizar_atendimento` apenas para fins de log. A lógica real de encerramento já reage ao sinal `session_terminated` do Backend. **Ação:** Remover logs de tool específicos do front. |
| **Processamento de Áudio (RMS)** | Frontend (`AudioWorklet`) | **Frontend (Necessário).** O cálculo de volume (RMS) ocorre no cliente para animar o visualizador com latência zero. Mover isso para o backend exigiria streaming de metadados de volta, o que pode introduzir delay na UI. |

---

## 2. Modelo Utilizado
O projeto define e utiliza estritamente o seguinte modelo no Backend:
**`models/gemini-2.5-flash-native-audio-preview-12-2025`**

Esta definição é estática no código do orquestrador (`server/orchestrator/setup.go`) e sobrescreve qualquer solicitação do cliente.

## 3. Handshake (Conexão e Setup)
A conexão segue o padrão de **Proxy de WebSocket**.

**Fluxo:**
1. **Frontend** conecta em `ws://<SERVER>/ws?callId=...`.
2. **Backend** aceita a conexão e abre um WebSocket secundário com a Google (`wss://generativelanguage.googleapis.com/...`).
3. **Trigger:** O Frontend envia mensagem tipo `setup`.
4. **Intercepção:** O Backend intercepta, ignora o payload do cliente, carrega configurações do PostgreSQL e envia o payload definitivo para a Google.

**Payload de Setup (Gerado pelo Backend):**
```json
{
  "setup": {
    "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "Aoede" } },
        "languageCode": "pt-BR"
      },
      "temperature": 0.7
    },
    "systemInstruction": {
      "parts": [{ "text": "<CONTEUDO_DO_DB>" }]
    },
    "tools": [
      { "functionDeclarations": [ ... ] }
    ]
  }
}
```

## 4. Configurações do Agente
As configurações são geridas na tabela `aiVoice_config` e carregadas a cada nova sessão.

- **voiceName**: Define a voz (Ex: "Aoede", "Puck").
- **languageCode**: "pt-BR".
- **systemPrompt**: A "alma" do agente. Injetado em `systemInstruction` durante o setup.
- **docstringToolKnowledge**: Descrição dinâmica da ferramenta de busca (RAG), permitindo ajustes de prompt sem deploy.

## 5. Configurações de Conversa (Protocolo)
O tráfego de mensagens segue o formato JSON proprietário da Gemini API (Bidi-Streaming).

**Para o Backend (Client Message):**
```json
{
  "client_content": {
    "turns": [
      {
        "role": "user",
        "parts": [{ "text": "Mensagem de texto do usuário" }]
      }
    ],
    "turnComplete": true
  }
}
```

**Do Backend (Server Message):**
```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        { "text": "Resposta de texto..." },
        { "inlineData": { "mimeType": "audio/pcm;rate=24000", "data": "<BASE64>" } }
      ]
    },
    "turnComplete": true
  }
}
```

## 6. Tratamento e Reprodução de Áudio

### Entrada (Upload)
- **Captura:** Microfone do navegador @ 16kHz.
- **Formato:** PCM Linear (Int16).
- **Envio:** Streaming contínuo via WebSocket em chunks base64.
- **Protocolo:** Mensagens do tipo `realtime_input`.

### Saída (Playback)
- **Formato:** PCM Linear (Int16) @ 24kHz.
- **Recebimento:** O Backend repassa os chunks de áudio recebidos da Google diretamente para o Frontend.
- **Buffer:** O Frontend utiliza a classe `AudioStreamer` para criar um buffer jitter-free.
- **Latência:** A reprodução inicia assim que o primeiro chunk chega, sem esperar o fim da frase.

## 7. Transcrições
As transcrições de áudio são processadas pela Gemini API e retornadas em tempo real.

- **Agente:** O texto chega no campo `serverContent.modelTurn.parts[].text`.
- **Usuário:** O reconhecimento de fala (STT) chega em `serverContent.inputTranscription.text`.

**Gerenciamento no Frontend:**
Utiliza-se uma estratégia de **Batching (requestAnimationFrame)** em `useTranscriptionManager.ts` para processar rápidas rajadas de mensagens WebSocket sem travar a UI, garantindo que o texto apareça sincronizado com o áudio.

## 8. Persistência
A responsabilidade de salvar o histórico é **exclusiva do Backend**.

1. **Memória Volátil:** A conversa é acumulada na memória do servidor Go (`Session.Transcript`).
2. **Sincronização:** Ao encerrar a sessão (`Cleanup`), o Backend envia o histórico completo para o Dashboard (`POST /api/calls/sync`).
3. **Status da Chamada:**
   - **Completed:** Se a ferramenta `finalizar_atendimento` foi acionada.
   - **Interrupted:** Qualquer outra forma de desconexão.

## 9. Execução de Funções (Tools)
As ferramentas estão 100% definidas e processadas no Backend.

### Ferramentas Implementadas
1. **`consultar_base_conhecimento`**
   - **Objetivo:** RAG (Retrieval Augmented Generation).
   - **Fluxo:** O Agente solicita -> Backend consulta API do Dashboard -> Backend retorna JSON com trechos de documentos -> Agente formula resposta.
   
2. **`finalizar_atendimento`**
   - **Objetivo:** Encerrar a conversa com elegância.
   - **Fluxo:** O Agente solicita -> Backend marca sessão como `WasGraceful` -> Backend envia sinal de `session_terminated` ao Frontend -> Frontend espera áudio terminar e desconecta.

3. **`sendLink`**
   - **Objetivo:** Enviar links clicáveis para o usuário.
   - **Fluxo:** O Agente solicita (com `url` e `alias`) -> Backend envia evento `link_bubble` para o Cliente -> Cliente renderiza bubble isolado -> Backend persiste link como Markdown no histórico.

### Adicionar Novas Funções
Para criar uma nova função, deve-se:
1. Definir a assinatura JSON e parâmetro de docstring em `server/internal/orchestrator/setup.go`.
2. Implementar o `case` de tratamento em `handleToolCall` no `server/main.go`.
3. Adicionar o campo correspondente no `init.sql` e no Dashboard para gestão dinâmica.
