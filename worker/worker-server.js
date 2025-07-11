const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const fetch = require('node-fetch');

// --- Konfigürasyon ---
const WORKER_PORT = process.env.WORKER_PORT || 8081;
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || "gemini-1.5-flash-latest";
const XTTS_HOST = '127.0.0.1';
const XTTS_PORT = 5002;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// --- Senaryo ve Veritabanı ---
const hotelScenario = require('./scenarios/hotel_booking.js');
const scenarios = { 'otel_rezervasyonu': hotelScenario };
const DB_PATH = path.resolve(__dirname, '../data/veritabani.json');

// --- API İstemcisi ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Sunucu ve Oturum ---
const userSessions = {};
const wss = new WebSocketServer({ port: WORKER_PORT });
console.log(`[Worker] ✅ Profesyonel Worker ${WORKER_PORT} portunda dinliyor...`);

// --- ANA İŞLEM DÖNGÜSÜ ---
wss.on('connection', ws => {
    console.log("[Worker] ✅ Gateway bağlandı.");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type !== 'user_transcript') return;

            const { sessionId, text } = data.payload;
            if (!userSessions[sessionId]) {
                userSessions[sessionId] = { 
                    scenario: null,
                    collected_params: {},
                    last_question: null
                };
            }
            const session = userSessions[sessionId];
            
            console.log(`[Worker] Gelen metin: "${text}" | Oturum: ${sessionId}`);
            
            if (!session.scenario) {
                if (text.toLowerCase().includes('otel') || text.toLowerCase().includes('rezervasyon')) {
                    session.scenario = scenarios['otel_rezervasyonu'];
                    console.log(`[Worker] Senaryo bulundu: ${session.scenario.id}`);
                }
            }
            
            let spokenResponse, displayData;

            if (session.scenario) {
                if (session.last_question) {
                    const extractionPrompt = `Kullanıcının şu cevabından: "${text}", sorulan şu soruya karşılık gelen değeri çıkar: "${session.last_question}". Sadece değeri JSON formatında ver. Örnek: {"value": "Antalya"}`;
                    const model = genAI.getGenerativeModel({ model: LLM_MODEL_NAME });
                    
                    try {
                        const result = await model.generateContent(extractionPrompt);
                        const responseText = result.response.text();
                        const extracted = JSON.parse(responseText.match(/{.*}/s)[0]);
                        if (extracted.value) {
                            session.collected_params[session.last_question] = extracted.value;
                            console.log(`[Worker] Bilgi çıkarıldı: {${session.last_question}: "${extracted.value}"}`);
                        }
                    } catch (e) {
                        console.error("[Worker] ❌ Bilgi çıkarımı sırasında JSON parse hatası:", e.message);
                    }
                }
                
                let nextParamToAsk = null;
                for (const param of session.scenario.required_params) {
                    if (!session.collected_params[param.name]) {
                        nextParamToAsk = param;
                        break;
                    }
                }

                if (nextParamToAsk) {
                    spokenResponse = nextParamToAsk.question;
                    session.last_question = nextParamToAsk.name;
                    displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                } else {
                    const db = await readDB();
                    const newReservation = { id: `res_${Date.now()}`, type: session.scenario.id, params: session.collected_params, status: 'confirmed' };
                    
                    const imageUrl = await getImageUrl(newReservation.params.location);
                    newReservation.imageUrl = imageUrl;

                    db.reservations.push(newReservation);
                    await writeDB(db);

                    spokenResponse = "Harika! Tüm bilgileri aldım. Rezervasyonunuzu oluşturdum.";
                    displayData = { type: 'confirmation_card', data: newReservation };
                    console.log(`[Worker] ✅ Rezervasyon tamamlandı ve kaydedildi.`);
                    delete userSessions[sessionId];
                }
            } else {
                spokenResponse = "Size nasıl yardımcı olabilirim? Örneğin, 'otel rezervasyonu yapmak istiyorum' diyebilirsiniz.";
                displayData = { type: 'info_request', text: spokenResponse };
            }

            const audioContent = await getXttsAudio(spokenResponse);
            
            wss.clients.forEach(client => {
                if(client.readyState === require('ws').OPEN) {
                     client.send(JSON.stringify({
                        type: 'ai_response',
                        payload: { sessionId, spokenText: spokenResponse, audio: audioContent, audio_format: 'wav', display: displayData }
                    }));
                }
            });
            
        } catch (error) {
            console.error("[Worker] ❌ Ana işlem döngüsünde kritik hata:", error);
            wss.clients.forEach(client => {
                if(client.readyState === require('ws').OPEN) {
                   client.send(JSON.stringify({ type: 'error', payload: { message: "İç sunucuda kritik bir hata oluştu." }}));
                }
           });
        }
    });

    ws.on('close', () => console.log('[Worker] Gateway bağlantısı kapandı.'));
});

// --- YARDIMCI FONKSİYONLAR ---
async function readDB() {
    try {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { reservations: [] };
        }
        throw error;
    }
}

async function writeDB(data) {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function getImageUrl(query) {
    if (!PEXELS_API_KEY) {
        console.warn("[Worker] Pexels API anahtarı bulunamadı. Rastgele resim kullanılacak.");
        return `https://source.unsplash.com/random/400x200/?${query}`;
    }
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        if (!response.ok) throw new Error(`Pexels API'den hata: ${response.statusText}`);
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            console.log(`[Worker] Pexels'ten resim bulundu: ${data.photos[0].src.medium}`);
            return data.photos[0].src.medium;
        }
        return `https://source.unsplash.com/random/400x200/?${query}`;
    } catch (error) {
        console.error("[Worker] Pexels API hatası:", error.message);
        return `https://source.unsplash.com/random/400x200/?${query}`;
    }
}

function getXttsAudio(text) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === "") {
            console.warn("[Worker] XTTS'e boş metin gönderilmesi engellendi.");
            return resolve(""); 
        }

        const params = new URLSearchParams({ text: text, language: "tr" });
        const url = `http://${XTTS_HOST}:${XTTS_PORT}/api/tts?${params.toString()}`;

        http.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`XTTS sunucusundan hata kodu ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const audioBuffer = Buffer.concat(chunks);
                resolve(audioBuffer.toString('base64'));
            });
        }).on('error', (e) => {
            reject(`XTTS isteği başarısız: ${e.message}.`);
        });
    });
}