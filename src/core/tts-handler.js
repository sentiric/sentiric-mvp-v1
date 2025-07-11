// src/core/tts-handler.js (TAM VE EKSİKSİZ KOD)

const http = require('http');
const config = require('../config');

// --- Varsayılan Ayarlar ---
const DEFAULT_TTS_OPTIONS = {
    language: "tr",
    speed: 1.15,
    speaker_ref: "C:\\TTS\\speaker_ref.wav" 
};

function getXttsAudio(text, options = {}) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === "") {
            console.warn("[TTS Handler] Boş metin gönderilmesi engellendi.");
            return resolve(""); 
        }

        const finalOptions = { ...DEFAULT_TTS_OPTIONS, ...options };
        const params = new URLSearchParams(finalOptions);
        params.append('text', text);

        const url = `http://${config.xttsHost}:${config.xttsPort}/api/tts?${params.toString()}`;
        console.log(`[TTS Handler] İstek gönderiliyor: ${url}`);

        http.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => {
                    console.error(`[TTS Handler] XTTS Hata Detayı: ${errorData}`);
                    reject(new Error(`XTTS sunucusundan hata kodu ${res.statusCode}`));
                });
                return;
            }

            // --- CIZIRTIYI GİDEREN DÜZELTME BURADA ---
            // Gelen ham ses verisini (binary) bir Buffer dizisi olarak topluyoruz.
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                // Tüm parçaları tek bir Buffer nesnesinde birleştiriyoruz.
                const audioBuffer = Buffer.concat(chunks);
                // Bu Buffer'ı doğrudan Base64 formatına çeviriyoruz.
                // Veri kaybı veya bozulma olmuyor.
                const base64Audio = audioBuffer.toString('base64');
                
                resolve(base64Audio);
                console.log(`[TTS Handler] ✅ Ses verisi başarıyla alındı ve Base64'e çevrildi.`);
            });
            // --- DÜZELTME SONU ---

        }).on('error', (e) => {
            reject(`[TTS Handler] XTTS isteği başarısız: ${e.message}.`);
        });
    });
}

module.exports = { getXttsAudio };