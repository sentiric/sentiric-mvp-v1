// src/core/tts-adapters/sentiric-voice-engine-adapter.js

const http = require('http'); // Node.js'in dahili http modülü
const fs = require('fs'); // Node.js'in dahili dosya sistemi modülü
const FormData = require('form-data'); // Form verisi göndermek için
const config = require('../../config'); // Merkezi konfigürasyon dosyamız

async function synthesize(text, options = {}) {
    return new Promise((resolve, reject) => {
        const { language, speed } = { // speaker_ref artık burada kullanılmıyor, kaldırıldı
            language: "tr",
            speed: 1.0, // Varsayılan hızı 1.0'a çekmek daha doğal olabilir, deneme yapın.
            ...options
        };

        if (!text || text.trim() === "") {
            console.warn("[SentiricVoiceEngineAdapter] Boş metin gönderilmesi engellendi.");
            // Eğer metin boşsa, boş bir base64 stringi dön (boş ses verisi)
            return resolve(""); 
        }

        // speaker_ref kontrolünü kaldırdık, çünkü bu dosya artık sunucuda sabit olacak
        // if (!speaker_ref || !fs.existsSync(speaker_ref)) {
        //     console.error(`[SentiricVoiceEngineAdapter] ❌ Referans ses dosyası bulunamadı: ${speaker_ref}`);
        //     console.error("[SentiricVoiceEngineAdapter] ℹ️ Lütfen .env dosyasındaki XTTS_SPEAKER_REF_PATH'in doğru ve erişilebilir bir yola işaret ettiğinden emin olun.");
        //     return reject(new Error(`Referans ses dosyası bulunamadı: ${speaker_ref}`));
        // }
        
        const form = new FormData();
        form.append('text', text);
        form.append('language', language);
        form.append('speed', String(speed));
        // BURAYI KALDIRDIK: Artık referans ses dosyasını her istekte göndermiyoruz!
        // form.append('speaker_ref_wav', fs.createReadStream(speaker_ref));

        const requestOptions = {
            hostname: config.xttsHost,
            port: config.xttsPort,
            path: '/api/tts',
            method: 'POST',
            headers: form.getHeaders(),
        };

        console.log(`[SentiricVoiceEngineAdapter] POST isteği gönderiliyor: http://${config.xttsHost}:${config.xttsPort}/api/tts`);

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
                console.log(`[SentiricVoiceEngineAdapter] ✅ Ses verisi POST ile başarıyla alındı.`);
            });
        });
        
        req.on('error', (e) => reject(`[SentiricVoiceEngineAdapter] XTTS POST isteği başarısız: ${e.message}. Sentiric Voice Engine sunucusunun çalıştığından emin olun.`));
        
        form.pipe(req); // Form verisini isteğe yaz
    });
}

// YENİ: Sağlık kontrolü metodu (Değişmedi)
async function checkHealth() {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            hostname: config.xttsHost,
            port: config.xttsPort,
            path: '/health', // Healthcheck endpoint'i
            method: 'GET',
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    resolve(status);
                } catch (e) {
                    reject(new Error(`[SentiricVoiceEngineAdapter] Sağlık yanıtı ayrıştırma hatası: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => reject(new Error(`[SentiricVoiceEngineAdapter] Sağlık kontrolü isteği başarısız: ${e.message}`)));
        req.end();
    });
}


module.exports = {
    synthesize,
    checkHealth // Yeni metodu dışa aktar
};