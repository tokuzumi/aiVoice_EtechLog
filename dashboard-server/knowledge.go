package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

// -- Structs --

type KnowledgeItem struct {
	ID           int       `json:"id"`
	Question     string    `json:"question"`
	Answer       string    `json:"answer"`
	CategoryID   *int      `json:"categoryId"`
	CategoryName string    `json:"categoryName"`
	CreatedAt    time.Time `json:"createdAt"`
}

type KnowledgeCategory struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type MeiliSettings struct {
	Embedders map[string]MeiliEmbedder `json:"embedders"`
}

type MeiliEmbedder struct {
	Source     string `json:"source"`
	ApiKey     string `json:"apiKey"`
	Model      string `json:"model"`
	Dimensions int    `json:"dimensions"`
}

// -- Globals for Meili --
var (
	meiliHost      = os.Getenv("MEILI_HOST")
	meiliMasterKey = os.Getenv("MEILI_MASTER_KEY")
	openAiApiKey   = os.Getenv("OPENAI_API_KEY")
	meiliIndex     = "knowledge_base"
)

// -- Initialization --

func initMeiliSearch() {
	if meiliHost == "" {
		meiliHost = "http://meilisearch:7700"
	}

    // Esperar Meili ficar UP
    for i := 0; i < 10; i++ {
        _, err := http.Get(meiliHost + "/health")
        if err == nil {
            break
        }
        log.Println("⏳ Aguardando MeiliSearch...")
        time.Sleep(2 * time.Second)
    }

    // 0. Enable Experimental Features (Vector Store)
    enableExperimental()

	// 1. Create Index if not exists
	createIndexURL := fmt.Sprintf("%s/indexes", meiliHost)
	body, _ := json.Marshal(map[string]string{"uid": meiliIndex, "primaryKey": "id"})
	req, _ := http.NewRequest("POST", createIndexURL, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+meiliMasterKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️ Erro conectando ao MeiliSearch: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 202 || resp.StatusCode == 201 || resp.StatusCode == 400 { // 400 usually means already exists
		log.Println("✅ Índice MeiliSearch verificado/criado.")
	}
	// 2. Configure Settings (Embedders & Searchable Attributes)
	configureSettings()
}

func configureSettings() {
	if openAiApiKey == "" {
		log.Println("⚠️ OPENAI_API_KEY não configurada. Embeddings não funcionarão.")
		return
	}

	url := fmt.Sprintf("%s/indexes/%s/settings", meiliHost, meiliIndex)
	
	settings := struct {
		Embedders           map[string]MeiliEmbedder `json:"embedders"`
		SearchableAttributes []string                `json:"searchableAttributes"`
		FilterableAttributes []string                `json:"filterableAttributes"`
	}{
		Embedders: map[string]MeiliEmbedder{
			"default": {
				Source:     "openAi",
				ApiKey:     openAiApiKey,
				Model:      "text-embedding-3-small",
				Dimensions: 1536,
			},
		},
		SearchableAttributes: []string{"question", "answer"},
		FilterableAttributes: []string{"category"},
	}

	body, _ := json.Marshal(settings)
	req, _ := http.NewRequest("PATCH", url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+meiliMasterKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️ Erro configurando Settings: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Println("✅ MeiliSearch Settings (Embedders + Searchable) configurados.")
	} else {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("⚠️ Falha ao configurar Settings: %s", string(bodyBytes))
	}
}

func enableExperimental() {
	// Em versões recentes (v1.13+), a busca vetorial pode ser ativada configurando os embedders diretamente.
	// Outras features experimentais podem ser ativadas aqui se o campo existir no v1.35.0.
}


// -- Meili Helpers --

func syncToMeili(item KnowledgeItem) {
	url := fmt.Sprintf("%s/indexes/%s/documents", meiliHost, meiliIndex)
	
	// Format for Meili
	doc := map[string]interface{}{
		"id":       item.ID,
		"question": item.Question,
		"answer":   item.Answer,
        "category": item.CategoryName,
	}
	
	body, _ := json.Marshal([]interface{}{doc}) // Must be an array
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+meiliMasterKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 2 * time.Second}
	client.Do(req)
}

func deleteFromMeili(id int) {
	url := fmt.Sprintf("%s/indexes/%s/documents/%d", meiliHost, meiliIndex, id)
	req, _ := http.NewRequest("DELETE", url, nil)
	req.Header.Set("Authorization", "Bearer "+meiliMasterKey)

	client := &http.Client{Timeout: 2 * time.Second}
	client.Do(req)
}

// -- Category Handlers --

func handleCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		listCategories(w, r)
	} else if r.Method == "POST" {
		createCategory(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func listCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(context.Background(), "SELECT id, name, created_at FROM knowledge_categories ORDER BY name ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cats []KnowledgeCategory
	for rows.Next() {
		var c KnowledgeCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			continue
		}
		cats = append(cats, c)
	}
	if cats == nil {
		cats = []KnowledgeCategory{}
	}
	json.NewEncoder(w).Encode(cats)
}

func createCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var c KnowledgeCategory
	err := db.QueryRow(context.Background(), "INSERT INTO knowledge_categories (name) VALUES ($1) RETURNING id, name, created_at", req.Name).Scan(&c.ID, &c.Name, &c.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(c)
}

// -- Handlers --

func handleKnowledge(w http.ResponseWriter, r *http.Request) {
	// Methods: GET, POST
	if r.Method == "GET" {
		listKnowledge(w, r)
	} else if r.Method == "POST" {
		createKnowledge(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleKnowledgeItem(w http.ResponseWriter, r *http.Request) {
    // Basic extraction from URL since we are using stdlib http.HandleFunc in main. 
    // Wait, main.go uses http.HandleFunc which doesn't parse params easily.
    // I'll assume we pass ID via query param or simple path logic in main if I don't use Chi.
    // However, looking at main.go, it uses standard lib. I will parse ID from URL path manually or query param.
    // Let's stick to query param `?id=` for DELETE/PUT for simplicity with stdlib or parse path suffix.
    
    // Better strategy for stdlib: 
    // If routing is /api/dashboard/knowledge/
    // We can parse the ID from the end.

    idStr := r.URL.Query().Get("id")
    if idStr == "" {
        http.Error(w, "ID required", http.StatusBadRequest)
        return
    }
    id, err := strconv.Atoi(idStr)
    if err != nil {
        http.Error(w, "Invalid ID", http.StatusBadRequest)
        return
    }

	if r.Method == "DELETE" {
		deleteKnowledge(w, r, id)
	} else if r.Method == "PUT" {
        updateKnowledge(w, r, id)
    } else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func listKnowledge(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(context.Background(), `
        SELECT k.id, k.question, k.answer, k.category_id, c.name, k.created_at 
        FROM knowledge_base k 
        LEFT JOIN knowledge_categories c ON k.category_id = c.id 
        ORDER BY k.created_at DESC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []KnowledgeItem
	for rows.Next() {
		var k KnowledgeItem
		if err := rows.Scan(&k.ID, &k.Question, &k.Answer, &k.CategoryID, &k.CategoryName, &k.CreatedAt); err != nil {
			continue
		}
		items = append(items, k)
	}
	if items == nil {
		items = []KnowledgeItem{}
	}
	json.NewEncoder(w).Encode(items)
}

func createKnowledge(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Question   string `json:"question"`
		Answer     string `json:"answer"`
		CategoryID *int   `json:"categoryId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var id int
    var createdAt time.Time
	err := db.QueryRow(context.Background(), 
		"INSERT INTO knowledge_base (question, answer, category_id) VALUES ($1, $2, $3) RETURNING id, created_at", 
		req.Question, req.Answer, req.CategoryID).Scan(&id, &createdAt)
	
	if err != nil {
		log.Printf("Erro salvando conhecimento: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch category name for Meili sync
	categoryName := "Sem Categoria"
	if req.CategoryID != nil {
		db.QueryRow(context.Background(), "SELECT name FROM knowledge_categories WHERE id=$1", *req.CategoryID).Scan(&categoryName)
	}

	item := KnowledgeItem{
		ID:           id,
		Question:     req.Question,
		Answer:       req.Answer,
		CategoryName: categoryName,
		CreatedAt:    createdAt,
	}

	// Async sync to Meili
	go syncToMeili(item)

	w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(item)
}

func updateKnowledge(w http.ResponseWriter, r *http.Request, id int) {
    var req struct {
		Question string `json:"question"`
		Answer   string `json:"answer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

    _, err := db.Exec(context.Background(), 
        "UPDATE knowledge_base SET question=$1, answer=$2 WHERE id=$3", 
        req.Question, req.Answer, id)
    
    
    // Fetch updated item for Meili sync (including category name)
    var item KnowledgeItem
    err = db.QueryRow(context.Background(), `
        SELECT k.id, k.question, k.answer, c.name 
        FROM knowledge_base k 
        LEFT JOIN knowledge_categories c ON k.category_id = c.id 
        WHERE k.id = $1`, id).Scan(&item.ID, &item.Question, &item.Answer, &item.CategoryName)

    if err == nil {
        go syncToMeili(item) // Updates existing doc
    }
    
    w.WriteHeader(http.StatusOK)
}


func deleteKnowledge(w http.ResponseWriter, r *http.Request, id int) {
	_, err := db.Exec(context.Background(), "DELETE FROM knowledge_base WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	go deleteFromMeili(id)

	w.WriteHeader(http.StatusOK)
}

// handleSearch performs a semantic search on MeiliSearch and returns results
func handleSearch(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

    if r.Method == "OPTIONS" {
        w.WriteHeader(http.StatusOK)
        return
    }

	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	searchURL := fmt.Sprintf("%s/indexes/%s/search", meiliHost, meiliIndex)
	
	
	// Prepare search request
	searchParams := map[string]interface{}{
		"q": query,
		"limit": 5,
        "hybrid": map[string]interface{}{
            "semanticRatio": 0.5,
            "embedder": "default",
        },
	}

    // Add Scope Filter
    category := r.URL.Query().Get("category")
    if category != "" && category != "all" {
        searchParams["filter"] = fmt.Sprintf("category = '%s'", category)
    }
	
	body, _ := json.Marshal(searchParams)
	req, _ := http.NewRequest("POST", searchURL, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+meiliMasterKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error querying MeiliSearch: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("MeiliSearch error: %s", string(bodyBytes)), resp.StatusCode)
		return
	}

    w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}
