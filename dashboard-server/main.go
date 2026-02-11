package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AIConfig struct {
	VoiceName                 string  `json:"voiceName"`
	LanguageCode              string  `json:"languageCode"`
	Temperature               float64 `json:"temperature"`
	ThinkingBudget            int     `json:"thinkingBudget"`
	EnableAffectiveDialog     bool    `json:"enableAffectiveDialog"`
	ProactiveAudio            bool    `json:"proactiveAudio"`
	SystemPrompt              string  `json:"systemPrompt,omitempty"`
	DocstringToolKnowledge    string  `json:"docstringToolKnowledge,omitempty"`
	DurationLimit             int     `json:"durationLimit"`
	TerminationAlertTime      int     `json:"terminationAlertTime"`
	DocstringToolTerminate    string  `json:"docstringToolTerminate,omitempty"`
	DocstringToolSendLink     string  `json:"docstringToolSendLink,omitempty"`
	ProactiveAlertInstruction string  `json:"proactiveAlertInstruction,omitempty"`
}

// Structs para Dashboard
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type DashboardUser struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type CallSyncRequest struct {
	CallID         string          `json:"callId"`
	ClientName     string          `json:"clientName"`
	NewTranscript  json.RawMessage `json:"newTranscript"`
	DurationSecond int             `json:"durationSeconds"`
	InputTokens    int             `json:"inputTokens"`
	OutputTokens   int             `json:"outputTokens"`
	Status         string          `json:"status"`
}

type CallRecord struct {
	ID              int             `json:"id"`
	CallID          string          `json:"callId"`
	ClientName      string          `json:"clientName"`
	Transcript      json.RawMessage `json:"transcript"`
	DurationSeconds int             `json:"durationSeconds"`
	InputTokens     int             `json:"inputTokens"`
	OutputTokens    int             `json:"outputTokens"`
	Status          string          `json:"status"`
	CreatedAt       time.Time       `json:"createdAt"`
}

var (
	db        *pgxpool.Pool
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
)

func main() {
	godotenv.Load("../.env")

	if len(jwtSecret) == 0 {
		jwtSecret = []byte("default-secret-change-me-in-production")
	}

	// Inicializa conexão com o banco
	initDB()
	if db != nil {
		defer db.Close()
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081" // Default port for Dashboard Server
	}

	// Rotas Públicas
	http.HandleFunc("/api/auth/login", handleLogin)
	http.HandleFunc("/api/knowledge/search", handleSearch)

	// Rotas Protegidas (Dashboard)
	http.HandleFunc("/api/dashboard/users", authMiddleware(handleUsers))
	http.HandleFunc("/api/dashboard/config", authMiddleware(handleConfig))
	http.HandleFunc("/api/dashboard/calls", authMiddleware(handleCalls))
	http.HandleFunc("/api/calls/sync", handleSync) // Public (called by agent client)
	http.HandleFunc("/api/dashboard/knowledge", authMiddleware(handleKnowledge))
	http.HandleFunc("/api/dashboard/knowledge/item", authMiddleware(handleKnowledgeItem))
	http.HandleFunc("/api/dashboard/categories", authMiddleware(handleCategories))

    // Inicializa MeiliSearch em background
    go initMeiliSearch()


	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	})

	log.Printf("Server aiVoice Dashboard API rodando na porta %s", port)
	
	// Envolve com Middleware de CORS Global
	handlerWithCORS := corsMiddleware(http.DefaultServeMux)
	
	if err := http.ListenAndServe(":"+port, handlerWithCORS); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func initDB() {
// ... (rest of the file stays same, but I need to remove headers from handlers below)
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Println("DATABASE_URL não configurada. O sistema funcionará sem banco.")
		return
	}

	var err error
	db, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Printf("Não foi possível conectar ao banco: %v", err)
		log.Fatal("Encerrando aplicação para forçar restart via Docker.")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.Ping(ctx); err != nil {
		log.Printf("Erro no ping do banco: %v", err)
		log.Fatal("Encerrando aplicação para forçar restart via Docker.")
	}
	log.Println("✅ Dashboard Server conectado ao PostgreSQL com sucesso!")

	// Auto-Onboarding dinâmico
	go ensureClientOnboarding()
}

func ensureClientOnboarding() {
	clientName := os.Getenv("INSTANCE_CLIENT_NAME")
	if clientName == "" {
		clientName = "aiVoice"
	}

	ctx := context.Background()
	
	// 1. Garante que o cliente existe
	var clientID int
	err := db.QueryRow(ctx, "INSERT INTO aiVoice_clients (name, status) VALUES ($1, 'active') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id", clientName).Scan(&clientID)
	if err != nil {
		log.Printf("⚠️ Auto-Onboarding: Falha ao garantir cliente %s: %v", clientName, err)
		return
	}

	// 2. Garante que a configuração existe
	queryConfig := `
		INSERT INTO aiVoice_config (
			client_id, voice_name, language_code, temperature, 
			enable_affective_dialog, proactive_audio, system_prompt, 
			docstring_tool_knowledge, docstring_tool_terminate, docstring_tool_send_link
		) VALUES ($1, 'Aoede', 'pt-BR', 0.7, true, true, $2, $3, $4, $5)
		ON CONFLICT (client_id) DO NOTHING
	`
	systemPrompt := fmt.Sprintf("Você é o %s, um assistente de voz avançado criado pelo estúdio TkzM.", clientName)
	knowledgeDoc := "Invoque esta ferramenta sempre que o usuário tiver dúvidas que não estejam no seu System Prompt."
	terminateDoc := "Use esta ferramenta para finalizar o atendimento educadamente."
	sendLinkDoc := "Use esta ferramenta para enviar um link ao usuário. Você deve obrigatoriamente fornecer a 'url' (completa com http/https) e o 'alias' (texto curto que descreve o link)."

	_, err = db.Exec(ctx, queryConfig, clientID, systemPrompt, knowledgeDoc, terminateDoc, sendLinkDoc)
	if err != nil {
		log.Printf("⚠️ Auto-Onboarding: Falha ao criar configuração para %s: %v", clientName, err)
	} else {
		log.Printf("✅ Auto-Onboarding concluído para o cliente: %s", clientName)
	}
}

// --- Middlewares ---

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			tokenString = authHeader
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}

// --- Handlers ---

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var user DashboardUser
	var passwordHash string

	err := db.QueryRow(context.Background(), "SELECT id, email, password_hash, name, role FROM dashboard_users WHERE email=$1", req.Email).Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.Role)
	if err != nil {
		log.Printf("Login falhou para %s: %v", req.Email, err)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		log.Printf("Senha incorreta para %s", req.Email)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		log.Printf("Erro gerando token: %v", err)
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(LoginResponse{
		Token: tokenString,
		Name:  user.Name,
		Email: user.Email,
	})
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		rows, err := db.Query(context.Background(), "SELECT id, email, name, role, created_at FROM dashboard_users ORDER BY created_at DESC")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var users []DashboardUser
		for rows.Next() {
			var u DashboardUser
			if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
				continue
			}
			users = append(users, u)
		}
		if users == nil {
			users = []DashboardUser{}
		}
		json.NewEncoder(w).Encode(users)
	} else if r.Method == "POST" {
		var req CreateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Error hashing password", http.StatusInternalServerError)
			return
		}

		_, err = db.Exec(context.Background(), "INSERT INTO dashboard_users (email, password_hash, name) VALUES ($1, $2, $3)", req.Email, string(hash), req.Name)
		if err != nil {
			log.Printf("Erro criando usuário: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	} else if r.Method == "DELETE" {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "ID required", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(context.Background(), "DELETE FROM dashboard_users WHERE id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	} else if r.Method == "PUT" {
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "ID required", http.StatusBadRequest)
			return
		}

		var req CreateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if req.Password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				http.Error(w, "Error hashing password", http.StatusInternalServerError)
				return
			}
			_, err = db.Exec(context.Background(), "UPDATE dashboard_users SET email=$1, name=$2, password_hash=$3 WHERE id=$4", req.Email, req.Name, string(hash), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		} else {
			_, err := db.Exec(context.Background(), "UPDATE dashboard_users SET email=$1, name=$2 WHERE id=$3", req.Email, req.Name, id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	}
}

func handleCalls(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		rows, err := db.Query(context.Background(), `
			SELECT c.id, c.call_id, cl.name as client_name, c.transcript, c.duration_seconds, c.input_tokens, c.output_tokens, c.status, c.created_at 
			FROM aiVoice_calls c
			JOIN aiVoice_clients cl ON c.client_id = cl.id
			ORDER BY c.created_at DESC
			LIMIT 50
		`)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var calls []CallRecord
		for rows.Next() {
			var c CallRecord
			if err := rows.Scan(&c.ID, &c.CallID, &c.ClientName, &c.Transcript, &c.DurationSeconds, &c.InputTokens, &c.OutputTokens, &c.Status, &c.CreatedAt); err != nil {
				continue
			}
			calls = append(calls, c)
		}
		if calls == nil {
			calls = []CallRecord{}
		}
		json.NewEncoder(w).Encode(calls)
	}
}

func handleSync(w http.ResponseWriter, r *http.Request) {
	log.Printf("[SYNC] Requisição recebida: %s %s", r.Method, r.URL.Path)

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CallSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[SYNC ERROR] Erro ao decodificar JSON: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[SYNC DEBUG] CallID: %s, Client: %s, Messages: %d, InputTokens: %d, OutputTokens: %d", 
		req.CallID, req.ClientName, len(req.NewTranscript), req.InputTokens, req.OutputTokens)

	if req.CallID == "" {
		log.Printf("[SYNC ERROR] CallID vazio")
		http.Error(w, "callId is required", http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO aiVoice_calls (call_id, client_id, transcript, duration_seconds, input_tokens, output_tokens, status)
		VALUES (
			$1, 
			(SELECT id FROM aiVoice_clients WHERE name = $2), 
			$3, 
			$4, 
			$5, 
			$6, 
			$7
		)
		ON CONFLICT (call_id) DO UPDATE SET
			transcript = EXCLUDED.transcript,
			duration_seconds = EXCLUDED.duration_seconds,
			input_tokens = EXCLUDED.input_tokens,
			output_tokens = EXCLUDED.output_tokens,
			status = EXCLUDED.status,
			updated_at = NOW();
	`

	res, err := db.Exec(context.Background(), query, 
		req.CallID, 
		req.ClientName, 
		req.NewTranscript, 
		req.DurationSecond, 
		req.InputTokens, 
		req.OutputTokens, 
		req.Status,
	)

	if err != nil {
		log.Printf("[SYNC ERROR] Erro no UPSERT SQL para Call %s: %v", req.CallID, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	affected := res.RowsAffected()
	log.Printf("[SYNC SUCCESS] Call %s processada. Rows affected: %d", req.CallID, affected)

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Synced")
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		clientName := os.Getenv("INSTANCE_CLIENT_NAME")
		if clientName == "" {
			clientName = "aiVoice"
		}
		cfg, err := fetchConfig(clientName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Injeta Categorias dinamicamente na Docstring para visualização no Dashboard
		cats, _ := fetchAllCategories()
		catList := "all"
		for _, c := range cats {
			catList += ", " + c
		}

		dynamicInstruction := fmt.Sprintf("\n\n---\n⚠️ INJEÇÃO DINÂMICA (Categorias Ativas): [%s]\nUse o parâmetro 'category' com uma das opções acima para filtrar a busca, ou 'all' para busca global.", catList)
		cfg.DocstringToolKnowledge += dynamicInstruction

		json.NewEncoder(w).Encode(cfg)
	} else if r.Method == "PUT" {
		var cfg AIConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		query := `
			UPDATE aiVoice_config SET
				voice_name = $1,
				language_code = $2,
				temperature = $3,
				thinking_budget = $4,
				enable_affective_dialog = $5,
				proactive_audio = $6,
				system_prompt = $7,
				docstring_tool_knowledge = $8,
				duration_limit = $9,
				termination_alert_time = $10,
				docstring_tool_terminate = $11,
				proactive_alert_instruction = $12,
				docstring_tool_send_link = $13,
				updated_at = NOW()
			WHERE client_id = (SELECT id FROM aiVoice_clients WHERE name = $14)
		`

		// Remove a parte injetada dinamicamente antes de salvar para não poluir o banco
		re := regexp.MustCompile(`(?s)\n\n---\n⚠️ INJEÇÃO DINÂMICA.*`)
		cfg.DocstringToolKnowledge = re.ReplaceAllString(cfg.DocstringToolKnowledge, "")

		clientName := os.Getenv("INSTANCE_CLIENT_NAME")
		if clientName == "" {
			clientName = "aiVoice"
		}

		_, err := db.Exec(context.Background(), query, cfg.VoiceName, cfg.LanguageCode, cfg.Temperature, cfg.ThinkingBudget, cfg.EnableAffectiveDialog, cfg.ProactiveAudio, cfg.SystemPrompt, cfg.DocstringToolKnowledge, cfg.DurationLimit, cfg.TerminationAlertTime, cfg.DocstringToolTerminate, cfg.ProactiveAlertInstruction, cfg.DocstringToolSendLink, clientName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func fetchConfig(clientName string) (*AIConfig, error) {
	if db == nil {
		return nil, nil
	}
	var cfg AIConfig
	query := `
		SELECT c.voice_name, c.language_code, c.temperature, c.thinking_budget, COALESCE(c.enable_affective_dialog, false), COALESCE(c.proactive_audio, false), COALESCE(c.system_prompt, ''), COALESCE(c.docstring_tool_knowledge, ''), c.duration_limit, c.termination_alert_time, COALESCE(c.docstring_tool_terminate, ''), COALESCE(c.proactive_alert_instruction, ''), COALESCE(c.docstring_tool_send_link, '')
		FROM aiVoice_config c
		JOIN aiVoice_clients cl ON c.client_id = cl.id
		WHERE cl.name = $1 AND cl.status = 'active'
		LIMIT 1
	`
	err := db.QueryRow(context.Background(), query, clientName).Scan(
		&cfg.VoiceName, &cfg.LanguageCode, &cfg.Temperature, &cfg.ThinkingBudget, &cfg.EnableAffectiveDialog, &cfg.ProactiveAudio, &cfg.SystemPrompt, &cfg.DocstringToolKnowledge, &cfg.DurationLimit, &cfg.TerminationAlertTime, &cfg.DocstringToolTerminate, &cfg.ProactiveAlertInstruction, &cfg.DocstringToolSendLink,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func fetchAllCategories() ([]string, error) {
	rows, err := db.Query(context.Background(), "SELECT name FROM knowledge_categories ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cats []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			cats = append(cats, name)
		}
	}
	return cats, nil
}


