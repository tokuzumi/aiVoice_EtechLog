package orchestrator

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"aivoice-v3/internal/protocol"
)

// AIConfig defines the configuration for the AI agent
type AIConfig struct {
	VoiceName                 string  `json:"voiceName"`
	LanguageCode              string  `json:"languageCode"`
	Temperature               float64 `json:"temperature"`
	ThinkingBudget            int     `json:"thinkingBudget"`
	EnableAffectiveDialog     bool    `json:"enableAffectiveDialog"`
	ProactiveAudio            bool    `json:"proactiveAudio"`
	SystemPrompt              string  `json:"systemPrompt,omitempty"`
	DocstringToolKnowledge    string  `json:"docstringToolKnowledge"`
	DocstringToolTerminate    string  `json:"docstringToolTerminate"`
	DocstringToolSendLink     string  `json:"docstringToolSendLink"`
	DurationLimit             int     `json:"durationLimit"`
	TerminationAlertTime      int     `json:"terminationAlertTime"`
	ProactiveAlertInstruction string  `json:"proactiveAlertInstruction"`
}

// GetInitialSetup orchestrates the fetching of configuration and construction of the setup payload
func GetInitialSetup(ctx context.Context, db *pgxpool.Pool, clientName string) (*protocol.Setup, error) {
	cfg, err := fetchConfig(ctx, db, clientName)
	if err != nil {
		// Fallback safe defaults if config fetch fails, or handle error upstack
		// For robustness, if DB fails, we might want to return default or error.
		// Returning error allows the caller to decide.
		// However, given the "Robustez" rule, let's try to proceed with default if just not found, 
        // but if DB is down `fetchConfig` returns error.
        // Let's assume we return defaults if we can't find specific config but DB is up?
        // Actually, main.go had a fallback: if cfg == nil { default }
        // Let's keep that logic here.
        if cfg == nil {
             cfg = &AIConfig{
				VoiceName: "Aoede", 
				LanguageCode: "pt-BR", 
				Temperature: 0.7,
				SystemPrompt: fmt.Sprintf("Você é o %s, um assistente de voz avançado criado pelo estúdio TkzM.", clientName),
				DocstringToolKnowledge: fmt.Sprintf("Invoque esta ferramenta sempre que o usuário tiver dúvidas sobre o %s.", clientName),
			 }
        } else {
             return nil, err
        }
	}
    
    // Double check if cfg is nil (e.g. valid query but no rows found)
    if cfg == nil {
        cfg = &AIConfig{
			VoiceName: "Aoede", 
			LanguageCode: "pt-BR", 
			Temperature: 0.7,
			SystemPrompt: fmt.Sprintf("Você é o %s, um assistente de voz avançado criado pelo estúdio TkzM.", clientName),
			DocstringToolKnowledge: fmt.Sprintf("Invoque esta ferramenta sempre que o usuário tiver dúvidas sobre o %s.", clientName),
		}
    }

	cats, err := fetchAllCategories(ctx, db)
	// If categories fail, we can just use "all" or empty. Non-critical.
	if err != nil {
		cats = []string{}
	}

	catList := "all"
	for _, c := range cats {
		catList += ", " + c
	}
	dynamicKnowledgeDoc := fmt.Sprintf("%s\n\n---\n⚠️ INJEÇÃO DINÂMICA (Categorias Ativas): [%s]\nUse o parâmetro 'category' com uma das opções acima para filtrar a busca, ou 'all' para busca global.", cfg.DocstringToolKnowledge, catList)

	finalPrompt := cfg.SystemPrompt
	if cfg.EnableAffectiveDialog {
		finalPrompt = "MODO AFETIVO ATIVADO: Use um tom de voz empático, expressivo e humano. Adapte sua entonação e prosódia às emoções detectadas na conversa.\n\n" + finalPrompt
	}
	if cfg.ProactiveAudio {
		finalPrompt = "MODO PROATIVO ATIVADO: Seja proativa. Não hesite em tomar a iniciativa, sugerir caminhos ou fazer perguntas para manter a fluidez, especialmente se o usuário parecer em dúvida.\n\n" + finalPrompt
	}

	setupBody := &protocol.Setup{
		Model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
		GenerationConfig: &protocol.GenerationConfig{
			ResponseModalities: []string{"AUDIO"},
			SpeechConfig: &protocol.SpeechConfig{
				VoiceConfig: &protocol.VoiceConfig{
					PrebuiltVoiceConfig: &protocol.PrebuiltVoiceConfig{VoiceName: cfg.VoiceName},
				},
				LanguageCode: cfg.LanguageCode,
			},
			Temperature: cfg.Temperature,
			ThinkingConfig: &protocol.ThinkingConfig{
				IncludeThoughts: false,
			},
		},
		// Explicitly enable transcriptions (Required by Gemini Live API)
		InputAudioTranscription:  map[string]interface{}{},
		OutputAudioTranscription: map[string]interface{}{},
		SystemInstruction: &protocol.SystemInstruction{
			Parts: []protocol.Part{{Text: finalPrompt}},
		},
		Tools: []protocol.Tool{
			{
				FunctionDeclarations: []protocol.FunctionDeclaration{
					{
						Name:        "consultar_base_conhecimento",
						Description: dynamicKnowledgeDoc,
						Parameters: map[string]interface{}{
							"type": "OBJECT",
							"properties": map[string]interface{}{
								"query":    map[string]interface{}{"type": "STRING", "description": "Termos de busca"},
								"category": map[string]interface{}{"type": "STRING", "description": "Categoria específica ou 'all'"},
							},
							"required": []string{"query", "category"},
						},
					},
					{
						Name:        "finalizar_atendimento",
						Description: cfg.DocstringToolTerminate,
						Parameters: map[string]interface{}{
							"type":       "OBJECT",
							"properties": map[string]interface{}{},
						},
					},
					{
						Name:        "sendLink",
						Description: cfg.DocstringToolSendLink,
						Behavior:    "NON_BLOCKING",
						Parameters: map[string]interface{}{
							"type": "OBJECT",
							"properties": map[string]interface{}{
								"url":   map[string]interface{}{"type": "STRING", "description": "A URL completa do link"},
								"alias": map[string]interface{}{"type": "STRING", "description": "O texto amigável que será exibido para o link"},
							},
							"required": []string{"url", "alias"},
						},
					},
				},
			},
		},
	}

	return setupBody, nil
}

func fetchConfig(ctx context.Context, db *pgxpool.Pool, clientName string) (*AIConfig, error) {
	if db == nil {
		return nil, nil
	}
	var cfg AIConfig
	query := `
		SELECT c.voice_name, c.language_code, c.temperature, c.thinking_budget, COALESCE(c.enable_affective_dialog, false), COALESCE(c.proactive_audio, false), COALESCE(c.system_prompt, ''), COALESCE(c.docstring_tool_knowledge, ''), COALESCE(c.docstring_tool_terminate, ''), c.duration_limit, c.termination_alert_time, COALESCE(c.proactive_alert_instruction, ''), COALESCE(c.docstring_tool_send_link, '')
		FROM aiVoice_config c
		JOIN aiVoice_clients cl ON c.client_id = cl.id
		WHERE cl.name = $1 AND cl.status = 'active'
		LIMIT 1
	`
	err := db.QueryRow(ctx, query, clientName).Scan(
		&cfg.VoiceName, &cfg.LanguageCode, &cfg.Temperature, &cfg.ThinkingBudget, &cfg.EnableAffectiveDialog, &cfg.ProactiveAudio, &cfg.SystemPrompt, &cfg.DocstringToolKnowledge, &cfg.DocstringToolTerminate, &cfg.DurationLimit, &cfg.TerminationAlertTime, &cfg.ProactiveAlertInstruction, &cfg.DocstringToolSendLink,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func fetchAllCategories(ctx context.Context, db *pgxpool.Pool) ([]string, error) {
    if db == nil {
        return nil, nil
    }
	rows, err := db.Query(ctx, "SELECT name FROM knowledge_categories ORDER BY name ASC")
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
