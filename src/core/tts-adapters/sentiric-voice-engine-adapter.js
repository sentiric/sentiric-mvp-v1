// src/core/tts-adapters/sentiric-voice-engine-adapter.js (Önceden piper-tts-adapter.js idi)

const http = require('http');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../../config');

async function synthesize(text, options = {}) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === "") {
            console.warn("[SentiricVoiceEngineAdapter] Boş metin gönderilmesi engellendi."); // DEĞİŞİKLİK BURADA
            return resolve(""); 
        }

        const defaultOptions = {
            language: "tr",
            speed: 1.15,
            speaker_ref: config.xttsSpeakerRefPath 
        };
        const finalOptions = { ...defaultOptions, ...options };

        if (!finalOptions.speaker_ref || !fs.existsSync(finalOptions.speaker_ref)) {
            console.error(`[SentiricVoiceEngineAdapter] ❌ Referans ses dosyası bulunamadı: ${finalOptions.speaker_ref}`); // DEĞİŞİKLİK BURADA
            console.error("[SentiricVoiceEngineAdapter] ℹ️ Lütfen .env dosyasındaki XTTS_SPEAKER_REF_PATH'in doğru ve erişilebilir bir yola işaret ettiğinden emin olun."); // DEĞİŞİKLİK BURADA
            return reject(new Error(`Referans ses dosyası bulunamadı: ${finalOptions.speaker_ref}`));
        }
        
        const form = new FormData();
        form.append('text', text);
        form.append('language', finalOptions.language);
        form.append('speed', String(finalOptions.speed));
        form.append('speaker_ref_wav', fs.createReadStream(finalOptions.speaker_ref));

        const requestOptions = {
            hostname: config.xttsHost,
            port: config.xttsPort,
            path: '/api/tts',
            method: 'POST',
            headers: form.getHeaders(),
        };

        console.log(`[SentiricVoiceEngineAdapter] POST isteği gönderiliyor: http://${config.xttsHost}:${config.xttsPort}/api/tts`); // DEĞİŞİKLİK BURADA

        const req = http.request(requestOptions, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', chunk => errorData += chunk);
                res.on('end', () => reject(new Error(`XTTS sunucusundan hata kodu ${res.statusCode}: ${errorData}`)));
                return;
            }

            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const audioBuffer = Buffer.concat(chunks);
                resolve(audioBuffer.toString('base64'));
                console.log(`[SentiricVoiceEngineAdapter] ✅ Ses verisi POST ile başarıyla alındı.`); // DEĞİŞİKLİK BURADA
            });
        });
        
        req.on('error', (e) => reject(`[SentiricVoiceEngineAdapter] XTTS POST isteği başarısız: ${e.message}. Piper TTS sunucusunun çalıştığından emin olun.`)); // DEĞİŞİKLİK BURADA
        
        form.pipe(req);
    });
}

module.exports = {
    synthesize,
};