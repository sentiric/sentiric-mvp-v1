// src/core/tts-handler.js (TTS Orkestratörü)

// Adapör adını SentiricVoiceEngineAdapter olarak güncelledik
const sentiricVoiceEngineAdapter = require('./tts-adapters/sentiric-voice-engine-adapter');

async function getXttsAudio(text, options = {}) {
    // İçerideki synthesize metodunu çağırıyoruz
    console.log("[TTS Handler] Sentiric Voice Engine Adaptörü üzerinden ses sentezleniyor...");
    return sentiricVoiceEngineAdapter.synthesize(text, options);
}

module.exports = { getXttsAudio };