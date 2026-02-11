package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/sync/errgroup"

	"aivoice-v3/internal/orchestrator"
	"aivoice-v3/internal/protocol"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	db *pgxpool.Pool

	bufferPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 32*1024)
		},
	}
	
	// Mapa global para rastrear sessões ativas: map[string]*Session
	activeSessions sync.Map
)

type Session struct {
	ID         string
	ClientName string
	Context    context.Context
	Cancel     context.CancelFunc
	ClientConn *websocket.Conn
	GeminiConn *websocket.Conn

	ToGemini chan []byte
	ToClient chan []byte

	Transcript     []map[string]interface{}
	TranscriptLock sync.Mutex
	ToolWG         sync.WaitGroup

	InputTokens    int
	OutputTokens   int
	StartTime      time.Time
	WasGraceful    bool
	ShouldTerm     bool

	TurnAgentText string
	TurnUserText  string
	Status        string // Active, Completed, Interrupted

	DurationLimit        int
	TerminationAlertTime int
	AlertInstruction     string
	AlertSent            bool
}

func main() {
	godotenv.Load(".env")
	godotenv.Load("../.env")

	initDB()
	if db != nil {
		defer db.Close()
	}

	http.HandleFunc("/ws", handleWebSocket)
	// Endpoint para terminação forçada (beacon)
	http.HandleFunc("/terminate", handleTerminate)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 aiVoice V3 Orchestrator (Robust Mode V2 - Debug JSON) rodando na porta %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func initDB() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Println("⚠️ DATABASE_URL não configurada.")
		return
	}

	var err error
	db, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Printf("❌ Erro ao conectar ao banco: %v", err)
		return
	}
	log.Println("✅ Conectado ao PostgreSQL.")
	
	// Provisionamento automático do cliente se necessário
	ensureClientExists()
}

func ensureClientExists() {
	clientName := os.Getenv("INSTANCE_CLIENT_NAME")
	if clientName == "" {
		clientName = "aiVoice"
	}

	ctx := context.Background()
	var exists bool
	err := db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM aiVoice_clients WHERE name=$1)", clientName).Scan(&exists)
	if err != nil {
		log.Printf("⚠️ Erro ao verificar cliente: %v", err)
		return
	}

	if !exists {
		log.Printf("🆕 Criando semente automática para o cliente: %s", clientName)
		var clientID int
		err = db.QueryRow(ctx, "INSERT INTO aiVoice_clients (name) VALUES ($1) RETURNING id", clientName).Scan(&clientID)
		if err != nil {
			log.Printf("❌ Erro ao criar cliente inicial: %v", err)
			return
		}

		// Configuração Padrão Robusta
		defaultPrompt := fmt.Sprintf("Você é o %s, um assistente de voz avançado criado pelo estúdio TkzM.", clientName)
		defaultKnowledge := fmt.Sprintf("Invoque esta ferramenta sempre que o usuário tiver dúvidas sobre preços, prazos ou funcionalidades específicas do %s.", clientName)

		_, err = db.Exec(ctx, `
			INSERT INTO aiVoice_config (
				client_id, voice_name, language_code, temperature, 
				system_prompt, docstring_tool_knowledge, 
				docstring_tool_terminate, docstring_tool_send_link
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			clientID, "Aoede", "pt-BR", 0.7,
			defaultPrompt, defaultKnowledge,
			"Invoque esta ferramenta para encerrar a sessão de forma amigável.",
			"Use esta ferramenta para enviar links úteis ao usuário.",
		)
		if err != nil {
			log.Printf("❌ Erro ao criar configuração inicial: %v", err)
		}
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Upgrade error: %v", err)
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("❌ GEMINI_API_KEY não encontrada")
		clientConn.Close()
		return
	}

	clientName := os.Getenv("INSTANCE_CLIENT_NAME")
	if clientName == "" {
		clientName = r.URL.Query().Get("client")
		if clientName == "" {
			clientName = "aiVoice"
		}
	}

	geminiURL := fmt.Sprintf("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=%s", apiKey)
	geminiConn, _, err := websocket.DefaultDialer.Dial(geminiURL, nil)
	if err != nil {
		log.Printf("❌ Gemini Dial error: %v", err)
		clientConn.Close()
		return
	}

	sessionID := uuid.New().String()
	if cid := r.URL.Query().Get("callId"); cid != "" {
		sessionID = cid
	}

	ctx, cancel := context.WithCancel(context.Background())
	s := &Session{
		ID:         sessionID,
		ClientName: clientName,
		Context:    ctx,
		Cancel:     cancel,
		ClientConn: clientConn,
		GeminiConn: geminiConn,
		ToGemini:   make(chan []byte, 512),
		ToClient:   make(chan []byte, 512),
		StartTime:  time.Now(),
		Transcript: []map[string]interface{}{}, // Inicialização explícita para evitar nulo
		Status:     "Active",
	}

	log.Printf("🔗 Sessão iniciada: %s (Client: %s)", s.ID, s.ClientName)
	activeSessions.Store(s.ID, s)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		for {
			select {
			case msg := <-s.ToGemini:
				if err := s.GeminiConn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return fmt.Errorf("Gemini Write error: %w", err)
				}
			case <-ctx.Done():
				return nil
			}
		}
	})

	// Monitoramento de Contexto para Cancelamento Imediato (Deadlock Fix)
	go func() {
		<-ctx.Done()
		// Forçar fechamento das conexões para desbloquear as goroutines de leitura
		// Isso garante que g.Wait() retorne e s.Cleanup() seja executado.
		s.ClientConn.Close()
		s.GeminiConn.Close()
	}()

	g.Go(func() error {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case msg := <-s.ToClient:
				if err := s.ClientConn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return fmt.Errorf("Client Write error: %w", err)
				}
			case <-ticker.C:
				if err := s.ClientConn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return fmt.Errorf("Client Ping error: %w", err)
				}
			case <-ctx.Done():
				return nil
			}
		}
	})

	g.Go(func() error {
		for {
			_, message, err := s.ClientConn.ReadMessage()
			if err != nil {
				return fmt.Errorf("Client Read error: %w", err)
			}

			var msg struct {
				Type    string          `json:"type"`
				Payload json.RawMessage `json:"payload"`
			}
			if err := json.Unmarshal(message, &msg); err != nil {
				s.ToGemini <- message
				continue
			}

			var clientMsg protocol.ClientMessage
			switch msg.Type {
			case "setup":
				setupPayload, err := orchestrator.GetInitialSetup(ctx, db, s.ClientName)
				if err != nil {
					log.Printf("⚠️ Erro no setup: %v", err)
				}
				
				// Extrai limites para a sessão (caso tenhamos carregado)
				// NOTA: Para ser mais limpo, setup.go poderia retornar o config também, mas vamos simplificar buscando novamente ou aceitando que setupPayload já tem o necessário.
				// Como GetInitialSetup já buscou do DB, vamos garantir que a s.Session tenha os limites.
				// Para evitar redundância, vamos buscar os limites extras aqui ou alterar GetInitialSetup.
				// Vamos buscar rapidamente os limites extras.
				var dLimit, tAlert int
				var pAlert string
				db.QueryRow(ctx, "SELECT duration_limit, termination_alert_time, COALESCE(proactive_alert_instruction, '') FROM aiVoice_config c JOIN aiVoice_clients cl ON c.client_id = cl.id WHERE cl.name = $1", s.ClientName).Scan(&dLimit, &tAlert, &pAlert)
				s.DurationLimit = dLimit
				s.TerminationAlertTime = tAlert
				s.AlertInstruction = pAlert

				clientMsg.Setup = setupPayload
			case "realtimeInput", "realtime_input":
				var data struct {
					Audio struct {
						Data     string `json:"data"`
						MimeType string `json:"mimeType"`
					} `json:"audio"`
				}
				if err := json.Unmarshal(msg.Payload, &data); err == nil {
					clientMsg.RealtimeInput = &protocol.RealtimeInput{
						MediaChunks: []protocol.InlineData{{MimeType: data.Audio.MimeType, Data: data.Audio.Data}},
					}
				}
			case "clientContent", "client_content":
				var content protocol.ClientContent
				if err := json.Unmarshal(msg.Payload, &content); err == nil {
					clientMsg.ClientContent = &content
					
					// Verifica se é o "Olá" proativo (silencioso)
					isProactive := false
					if len(content.Turns) == 1 && len(content.Turns[0].Parts) == 1 {
						if content.Turns[0].Parts[0].Text == "Olá" {
							isProactive = true
						}
					}

					if !isProactive {
						s.TranscriptLock.Lock()
						for _, turn := range content.Turns {
							for _, part := range turn.Parts {
								if part.Text != "" {
									if s.TurnUserText != "" {
										s.TurnUserText += " "
									}
									s.TurnUserText += part.Text
								}
							}
						}
						s.TranscriptLock.Unlock()
					}
				}
			case "toolResponse", "tool_response":
				var resp protocol.ToolResponse
				if err := json.Unmarshal(msg.Payload, &resp); err == nil {
					clientMsg.ToolResponse = &resp
				}
			}

			if clientMsg.Setup != nil || clientMsg.ClientContent != nil || clientMsg.RealtimeInput != nil || clientMsg.ToolResponse != nil {
				b, _ := json.Marshal(clientMsg)
				s.ToGemini <- b
			}
		}
	})

	g.Go(func() error {
		for {
			_, message, err := s.GeminiConn.ReadMessage()
			if err != nil {
				return fmt.Errorf("Gemini Read error: %w", err)
			}

			// log.Printf("📥 Gemini RAW: %s", string(message)) // Descomente para debug pesado

			var serverMsg protocol.ServerMessage
			if err := json.Unmarshal(message, &serverMsg); err != nil {
				log.Printf("⚠️ Erro Unmarshal Gemini: %v | Msg: %s", err, string(message))
				s.ToClient <- message
				continue
			}

			// Injeção Proativa Silenciosa (Despertar do Agente após Setup)
			if serverMsg.SetupComplete != nil {
				log.Printf("✨ Setup Complete do Gemini. Enviando saudação proativa silenciosa...")
				go func() {
					proactiveMsg := protocol.ClientMessage{
						ClientContent: &protocol.ClientContent{
							Turns:        []protocol.Turn{{Role: "user", Parts: []protocol.Part{{Text: "Olá"}}}},
							TurnComplete: true,
						},
					}
					b, _ := json.Marshal(proactiveMsg)
					s.ToGemini <- b
				}()
			}

			s.ToClient <- message

			if serverMsg.ToolCall != nil {
				for _, fc := range serverMsg.ToolCall.FunctionCalls {
					// ASSÍNCRONO: Processa a ferramenta em goroutine
					s.ToolWG.Add(1)
					go func(fc protocol.FunctionCall) {
						defer s.ToolWG.Done()
						s.handleToolCall(fc)
					}(fc)
				}
			}

			if serverMsg.ServerContent != nil {
				s.processServerContent(serverMsg.ServerContent)
			}

			if serverMsg.UsageMetadata != nil {
				s.TranscriptLock.Lock()
				s.InputTokens = serverMsg.UsageMetadata.PromptTokenCount
				s.OutputTokens = serverMsg.UsageMetadata.CandidatesTokenCount
				s.TranscriptLock.Unlock()
			}
		}
	})

	if err := g.Wait(); err != nil {
		log.Printf("🔌 Sessão terminada: %v", err)
	}

	activeSessions.Delete(s.ID)
	s.Cleanup()
}

func (s *Session) handleToolCall(fc protocol.FunctionCall) {
	log.Printf("🛠️ Tool Call: %s", fc.Name)
	if fc.Name == "consultar_base_conhecimento" {
		query, _ := fc.Args["query"].(string)
		category, _ := fc.Args["category"].(string)
		toolResp, _ := callRAG(query, category)
		
		resp := protocol.ClientMessage{
			ToolResponse: &protocol.ToolResponse{
				FunctionResponses: []protocol.FunctionResponse{
					{Name: fc.Name, ID: fc.ID, Response: toolResp},
				},
			},
		}
		b, _ := json.Marshal(resp)
		s.ToGemini <- b
	}

	if fc.Name == "finalizar_atendimento" {
		log.Printf("🏁 Tool: finalizar_atendimento solicitada")
		resp := protocol.ClientMessage{
			ToolResponse: &protocol.ToolResponse{
				FunctionResponses: []protocol.FunctionResponse{
					{Name: fc.Name, ID: fc.ID, Response: map[string]interface{}{"status": "success"}},
				},
			},
		}
		b, _ := json.Marshal(resp)
		s.ToGemini <- b

		s.TranscriptLock.Lock()
		s.WasGraceful = true
		s.Status = "Completed"
		s.ShouldTerm = true
		s.TranscriptLock.Unlock()
	}

	if fc.Name == "sendLink" {
		url, _ := fc.Args["url"].(string)
		alias, _ := fc.Args["alias"].(string)
		log.Printf("🔗 Tool: sendLink [%s] -> %s", alias, url)

		// 1. Envia bubble isolado para o cliente
		linkMsg := map[string]interface{}{
			"type": "link_bubble",
			"payload": map[string]interface{}{
				"url":   url,
				"alias": alias,
			},
		}
		b, _ := json.Marshal(linkMsg)
		s.ToClient <- b

		// 2. Responde ao Gemini
		resp := protocol.ClientMessage{
			ToolResponse: &protocol.ToolResponse{
				FunctionResponses: []protocol.FunctionResponse{
					{
						Name:       fc.Name,
						ID:         fc.ID,
						Response:   map[string]interface{}{"status": "success", "message": "Link exibido no chat com sucesso."},
						Scheduling: "SILENT",
					},
				},
			},
		}
		br, _ := json.Marshal(resp)
		s.ToGemini <- br

		// 3. Persiste no histórico (como Markdown para o Dashboard)
		s.TranscriptLock.Lock()
		s.Transcript = append(s.Transcript, map[string]interface{}{
			"id":        uuid.New().String()[:8],
			"role":      "agent",
			"text":      fmt.Sprintf("[%s](%s)", alias, url),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		s.TranscriptLock.Unlock()
	}
}

func (s *Session) processServerContent(sc *protocol.ServerContent) {
	s.TranscriptLock.Lock()
	defer s.TranscriptLock.Unlock()

	if sc.ModelTurn != nil && s.TurnUserText != "" {
		s.Transcript = append(s.Transcript, map[string]interface{}{
			"id": uuid.New().String()[:8], "role": "user", "text": s.TurnUserText, "timestamp": time.Now().Format(time.RFC3339),
		})
		s.TurnUserText = ""
	}

	if sc.InputTranscription != nil && sc.InputTranscription.Text != "" {
		s.TurnUserText += sc.InputTranscription.Text
	}

	if sc.ModelTurn != nil {
		for _, p := range sc.ModelTurn.Parts {
			if p.Text != "" {
				s.TurnAgentText += p.Text
			}
		}
	}

	if sc.OutputTranscription != nil && sc.OutputTranscription.Text != "" {
		s.TurnAgentText += sc.OutputTranscription.Text
	}

	if sc.TurnComplete {
		if s.TurnAgentText != "" {
			s.Transcript = append(s.Transcript, map[string]interface{}{
				"id": uuid.New().String()[:8], "role": "agent", "text": s.TurnAgentText, "timestamp": time.Now().Format(time.RFC3339),
			})
			s.TurnAgentText = ""
		}

		// MONITORAMENTO DE TEMPO: Envia aviso se passar do TerminationAlertTime
		if !s.AlertSent && s.TerminationAlertTime > 0 {
			elapsed := int(time.Since(s.StartTime).Seconds())
			if elapsed >= s.TerminationAlertTime {
				log.Printf("⏳ Tempo limite aproximando (%ds/%ds). Enviando aviso proativo...", elapsed, s.DurationLimit)
				s.AlertSent = true
				go func() {
					instruction := s.AlertInstruction
					if instruction == "" {
						instruction = "SISTEMA: O tempo de atendimento está acabando. Finalize gentilmente a conversa agora."
					}
					warningMsg := protocol.ClientMessage{
						ClientContent: &protocol.ClientContent{
							Turns:        []protocol.Turn{{Role: "user", Parts: []protocol.Part{{Text: instruction}}}},
							TurnComplete: true,
						},
					}
					b, _ := json.Marshal(warningMsg)
					s.ToGemini <- b
				}()
			}
		}

		// CHECKPOINT: Sincroniza o histórico, tokens e duração a cada fim de turno
		go func(id string, cName string, t []map[string]interface{}, it, ot int, st time.Time, status string) {
			duration := int(time.Since(st).Seconds())
			syncWithDashboard(id, cName, t, duration, it, ot, status)
		}(s.ID, s.ClientName, append([]map[string]interface{}{}, s.Transcript...), s.InputTokens, s.OutputTokens, s.StartTime, s.Status)
		
		if s.ShouldTerm {
			log.Printf("👋 Encerrando sessão amigavelmente (TurnComplete detectado): %s", s.ID)
			termSignal, _ := json.Marshal(map[string]interface{}{"type": "session_terminated"})
			s.ToClient <- termSignal
			go func() { 
				// Aguarda buffer esvaziar ou timeout
				timeout := time.After(5 * time.Second)
				ticker := time.NewTicker(100 * time.Millisecond)
				defer ticker.Stop()
				for {
					select {
					case <-timeout:
						s.Cancel() 
						return
					case <-ticker.C:
						if len(s.ToClient) == 0 {
							time.Sleep(200 * time.Millisecond) // Margem para envio de rede
							s.Cancel()
							return
						}
					}
				}
			}()
		}
	}
}

// Novo Handler para terminação via Beacon/Fetch
func handleTerminate(w http.ResponseWriter, r *http.Request) {
	// CORS para garantir que o fetch funcione
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		// Fallback para tentar ler do corpo se necessário, mas query param é mais seguro pro beacon
		http.Error(w, "Missing sessionId", http.StatusBadRequest)
		return
	}

	log.Printf("🛑 Sinal de terminação recebido para sessão: %s", sessionID)

	if val, ok := activeSessions.Load(sessionID); ok {
		s := val.(*Session)
		// Beacon = O usuário fechou a aba (ou saiu da página).
		// Isso deve ser considerado "Interrupted" pois não foi um encerramento lógico da conversa pelo agente.
		s.TranscriptLock.Lock()
		s.WasGraceful = false // Garante que o status final seja Interrupted
		s.TranscriptLock.Unlock()
		
		s.Cancel() 
		// O Cleanup será chamado pela goroutine principal do WS quando ela sair do g.Wait()
		// Mas podemos forçar uma garantia aqui caso o WS já esteja zumbi
		// OBS: Deixar o WS cleanup lidar com a persistência para evitar duplicidade.
		// Ao cancelar o contexto, o g.Wait() lá embaixo deve retornar imediatamente.
	} else {
		log.Printf("⚠️ Tentativa de terminar sessão não encontrada ou já encerrada: %s", sessionID)
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Session) Cleanup() {
	s.Cancel()
	s.ClientConn.Close()
	s.GeminiConn.Close()

	s.TranscriptLock.Lock()
	duration := int(time.Since(s.StartTime).Seconds())
	if s.Status == "Active" {
		s.Status = "Interrupted"
	}
	currentStatus := s.Status
	currentTranscript := append([]map[string]interface{}{}, s.Transcript...)
	inputTokens := s.InputTokens
	outputTokens := s.OutputTokens
	s.TranscriptLock.Unlock()

	log.Printf("🏁 Cleanup Sessão: %s | Status: %s | Msgs: %d", s.ID, currentStatus, len(currentTranscript))
	syncWithDashboard(s.ID, s.ClientName, currentTranscript, duration, inputTokens, outputTokens, currentStatus)
}

func syncWithDashboard(sessionID string, clientName string, transcript []map[string]interface{}, duration, inputTokens, outputTokens int, status string) {
	dashboardURL := os.Getenv("DASHBOARD_INTERNAL_URL")
	if dashboardURL == "" {
		dashboardURL = "http://dashboard-server:8081"
	}
	
	if transcript == nil {
		transcript = []map[string]interface{}{}
	}

	syncPayload := map[string]interface{}{
		"callId":          sessionID,
		"clientName":      clientName,
		"newTranscript":   transcript,
		"durationSeconds": duration,
		"inputTokens":     inputTokens,
		"outputTokens":    outputTokens,
		"status":          status,
	}

	payloadBytes, _ := json.Marshal(syncPayload)
	
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	
	resp, err := client.Post(dashboardURL+"/api/calls/sync", "application/json", bytes.NewBuffer(payloadBytes))
	if err == nil {
		defer resp.Body.Close()
		log.Printf("✅ Dash Sync [%s]: OK (Status API: %d)", sessionID, resp.StatusCode)
	} else {
		log.Printf("❌ Dash Error [%s]: %v", sessionID, err)
	}
}

func callRAG(query, category string) (map[string]interface{}, error) {
	dashboardURL := os.Getenv("DASHBOARD_INTERNAL_URL")
	if dashboardURL == "" {
		dashboardURL = "http://dashboard-server:8080"
	}

	if category == "" {
		category = "all"
	}
	searchURL := fmt.Sprintf("%s/api/knowledge/search?q=%s&category=%s", dashboardURL, url.QueryEscape(query), url.QueryEscape(category))

	resp, err := http.Get(searchURL)
	if err != nil {
		return map[string]interface{}{"error": "Erro de conexão"}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return map[string]interface{}{"error": "Erro na busca"}, fmt.Errorf("status: %d", resp.StatusCode)
	}

	var searchResult struct {
		Hits []interface{} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		return map[string]interface{}{"error": "Erro ao processar"}, err
	}

	return map[string]interface{}{"content": searchResult.Hits}, nil
}
