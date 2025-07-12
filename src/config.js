// src/config.js (TAM VE EKSİKSİZ KOD)

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
    gatewayPort: process.env.GATEWAY_PORT || 3000,
    workerPort: process.env.WORKER_PORT || 8081,
    llmModelName: process.env.LLM_MODEL_NAME || "gemini-1.5-flash-latest",
    
    xttsHost: process.env.XTTS_SERVER_HOST || '127.0.0.1',
    xttsPort: process.env.XTTS_SERVER_PORT || 5002,
    xttsSpeakerRefPath: process.env.XTTS_SPEAKER_REF_PATH,

    pexelsApiKey: process.env.PEXELS_API_KEY,
    dbPath: require('path').resolve(__dirname, '../data/veritabani.json'),
    googleApiKey: process.env.GEMINI_API_KEY,
};