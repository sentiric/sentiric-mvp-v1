// src/core/tts-handler.js (TTS Orkestratörü)

const sentiricVoiceEngineAdapter = require('./tts-adapters/sentiric-voice-engine-adapter');

async function getXttsAudio(text, options = {}) {
    // Normal ses sentezleme isteği
    console.log("[TTS Handler] Sentiric Voice Engine Adaptörü üzerinden ses sentezleniyor...");
    return sentiricVoiceEngineAdapter.synthesize(text, options);
}

// YENİ: Sağlık kontrolü fonksiyonu
async function checkTtsHealth() {
    try {
        const healthResponse = await sentiricVoiceEngineAdapter.checkHealth();
        return healthResponse.status === 'healthy';
    } catch (error) {
        console.error("[TTS Handler] ❌ TTS Sağlık Kontrolü Başarısız:", error.message);
        return false;
    }
}

module.exports = { 
    getXttsAudio,
    checkTtsHealth // Yeni fonksiyonu dışa aktar
};