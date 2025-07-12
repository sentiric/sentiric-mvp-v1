// src/core/tts-handler.js (TAM VE EKSİKSİZ KOD - DOSYA YÜKLEMELİ)

const http = require('http');
const fs = require('fs'); // 'fs/promises' değil, senkron kontrol için 'fs'
const FormData = require('form-data');
const config = require('../config');

function getXttsAudio(text, options = {}) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === "") {
            console.warn("[TTS Handler] Boş metin gönderilmesi engellendi.");
            return resolve(""); 
        }

        const defaultOptions = {
            language: "tr",
            speed: 1.15,
            speaker_ref: config.xttsSpeakerRefPath 
        };
        const finalOptions = { ...defaultOptions, ...options };

        if (!finalOptions.speaker_ref || !fs.existsSync(finalOptions.speaker_ref)) {
            return reject(new Error(`[TTS Handler] Referans ses dosyası bulunamadı: ${finalOptions.speaker_ref}`));
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

        console.log(`[TTS Handler] POST isteği gönderiliyor: http://${config.xttsHost}:${config.xttsPort}/api/tts`);

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
                console.log(`[TTS Handler] ✅ Ses verisi POST ile başarıyla alındı.`);
            });
        });
        
        req.on('error', (e) => reject(`[TTS Handler] XTTS POST isteği başarısız: ${e.message}.`));
        
        form.pipe(req);
    });
}

module.exports = { getXttsAudio };