// src/core/tts-adapters/sentiric-voice-engine-adapter.js

const http = require('http');
const FormData = require('form-data');
const config = require('../../config');

async function synthesize(text, options = {}) {
    return new Promise((resolve, reject) => {
        const { language, speed } = {
            language: "tr",
            speed: 1.0,
            ...options
        };

        if (!text || text.trim() === "") {
            console.warn("[SentiricVoiceEngineAdapter] Boş metin gönderilmesi engellendi.");
            return resolve(""); 
        }
        
        const form = new FormData();
        form.append('text', text);
        form.append('language', language);
        form.append('speed', String(speed));

        // ⭐️ KRİTİK DEĞİŞİKLİK: REFERANS SES GÖNDERME KODU TAMAMEN KALDIRILDI! ⭐️
        // Python sunucusu artık kendi sabit referansını kullanıyor.
        
        const requestOptions = {
            hostname: config.xttsHost,
            port: config.xttsPort,
            path: '/api/tts',
            method: 'POST',
            headers: form.getHeaders(),
        };

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
            });
        });
        
        req.on('error', (e) => reject(`[SentiricVoiceEngineAdapter] XTTS isteği başarısız: ${e.message}.`));
        
        form.pipe(req);
    });
}

// Sağlık kontrolü metodu değişmedi, olduğu gibi kalıyor.
async function checkHealth() {
    return new Promise((resolve, reject) => {
        const requestOptions = { hostname: config.xttsHost, port: config.xttsPort, path: '/health', method: 'GET' };
        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Sağlık yanıtı ayrıştırma hatası: ${e.message}`));
                }
            });
        });
        req.on('error', (e) => reject(new Error(`Sağlık kontrolü isteği başarısız: ${e.message}`)));
        req.end();
    });
}

module.exports = {
    synthesize,
    checkHealth
};