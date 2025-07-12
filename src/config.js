// src/config.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
    gatewayPort: process.env.GATEWAY_PORT || 3000,
    workerPort: process.env.WORKER_PORT || 8081,
    
    // Yeni Eklenen Ayarlar
    useLocalLLM: process.env.USE_LOCAL_LLM === 'true', // 'true' ise Ollama, 'false' ise Gemini kullanılır
    ollamaHost: process.env.OLLAMA_HOST || '127.0.0.1',
    ollamaPort: process.env.OLLAMA_PORT || 11434,
    ollamaModelName: process.env.OLLAMA_MODEL_NAME || 'phi3', // Yerel Ollama için kullanılacak model
    
    // Mevcut LLM ayarı (Gemini için)
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModelName: process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash-latest",
    
    // TTS ayarları
    xttsHost: process.env.XTTS_SERVER_HOST || '127.0.0.1',
    xttsPort: process.env.XTTS_SERVER_PORT || 5002,
    xttsSpeakerRefPath: process.env.XTTS_SPEAKER_REF_PATH,

    pexelsApiKey: process.env.PEXELS_API_KEY,
    dbPath: require('path').resolve(__dirname, '../data/veritabani.json'),
};