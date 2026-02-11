package protocol

// --- Client Messages (Client -> Gemini) ---

type ClientMessage struct {
	Setup          *Setup          `json:"setup,omitempty"`
	ClientContent  *ClientContent  `json:"clientContent,omitempty"`
	RealtimeInput  *RealtimeInput  `json:"realtimeInput,omitempty"`
	ToolResponse   *ToolResponse   `json:"toolResponse,omitempty"`
}

type Setup struct {
	Model                    string            `json:"model"`
	GenerationConfig         *GenerationConfig `json:"generationConfig,omitempty"`
	SystemInstruction        *SystemInstruction `json:"systemInstruction,omitempty"`
	Tools                    []Tool            `json:"tools,omitempty"`
	InputAudioTranscription  interface{}       `json:"inputAudioTranscription,omitempty"`
	OutputAudioTranscription interface{}       `json:"outputAudioTranscription,omitempty"`
}

type GenerationConfig struct {
	ResponseModalities []string        `json:"responseModalities,omitempty"`
	SpeechConfig       *SpeechConfig   `json:"speechConfig,omitempty"`
	Temperature        float64         `json:"temperature,omitempty"`
	ThinkingConfig     *ThinkingConfig `json:"thinkingConfig,omitempty"`
}

type SpeechConfig struct {
	VoiceConfig  *VoiceConfig `json:"voiceConfig,omitempty"`
	LanguageCode string       `json:"languageCode,omitempty"`
}

type VoiceConfig struct {
	PrebuiltVoiceConfig *PrebuiltVoiceConfig `json:"prebuiltVoiceConfig,omitempty"`
}

type PrebuiltVoiceConfig struct {
	VoiceName string `json:"voiceName"`
}

type ThinkingConfig struct {
	IncludeThoughts bool `json:"includeThoughts"`
}

type SystemInstruction struct {
	Parts []Part `json:"parts"`
}

type Tool struct {
	FunctionDeclarations []FunctionDeclaration `json:"functionDeclarations"`
}

type FunctionDeclaration struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
	Behavior    string      `json:"behavior,omitempty"`
}

type ClientContent struct {
	Turns         []Turn `json:"turns"`
	TurnComplete  bool   `json:"turnComplete"`
}

type Turn struct {
	Role  string `json:"role"`
	Parts []Part `json:"parts"`
}

type Part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *InlineData `json:"inlineData,omitempty"`
	Thought    bool        `json:"thought,omitempty"`
}

type InlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // Base64
}

type RealtimeInput struct {
	MediaChunks []InlineData `json:"mediaChunks"`
}

type ToolResponse struct {
	FunctionResponses []FunctionResponse `json:"functionResponses"`
}

type FunctionResponse struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Response   interface{} `json:"response"`
	Scheduling string      `json:"scheduling,omitempty"`
}

// --- Server Messages (Gemini -> Client) ---

type ServerMessage struct {
	ServerContent *ServerContent `json:"serverContent,omitempty"`
	ToolCall      *ToolCall      `json:"toolCall,omitempty"`
	SetupComplete *struct{}      `json:"setupComplete,omitempty"`
	UsageMetadata *UsageMetadata `json:"usageMetadata,omitempty"`
}

type ServerContent struct {
	ModelTurn           *Turn                `json:"modelTurn,omitempty"`
	InputTranscription  *Transcription       `json:"inputTranscription,omitempty"`
	OutputTranscription *Transcription       `json:"outputTranscription,omitempty"`
	TurnComplete        bool                 `json:"turnComplete,omitempty"`
	Interrupted         bool                 `json:"interrupted,omitempty"`
}

type Transcription struct {
	Text string `json:"text"`
}

type ToolCall struct {
	FunctionCalls []FunctionCall `json:"functionCalls"`
}

type FunctionCall struct {
	ID   string                 `json:"id"`
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type UsageMetadata struct {
	PromptTokenCount     int `json:"promptTokenCount"`
	CandidatesTokenCount int `json:"candidatesTokenCount"`
	TotalTokenCount      int `json:"totalTokenCount"`
}
