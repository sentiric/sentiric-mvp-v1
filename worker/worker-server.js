const { WebSocketServer } = require('ws');
const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');

// --- Konfigürasyon ---
// Artık dotenv-cli ile yüklendiği için .env dosyasını burada okumaya gerek yok.
const WORKER_PORT = process.env.WORKER_PORT || 8081;
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || "gemini-1.5-flash-latest";
const DEFAULT_SYSTEM_INSTRUCTION = process.env.DEFAULT_SYSTEM_INSTRUCTION || "Sen yardımsever bir asistansın.";

// YEREL XTTS SUNUCUSU AYARLARI
const XTTS_HOST = '127.0.0.1'; // 'localhost' yerine doğrudan IPv4 adresini kullanıyoruz.
const XTTS_PORT = 5002;

// --- Senaryoları Yükle ---
const hotelScenario = require('./scenarios/hotel_booking.js');
const massageScenario = require('./scenarios/massage_salon.js');
const scenarios = { 'otel_rezervasyonu': hotelScenario, 'masaj_randevusu': massageScenario };

// --- API İstemcilerini Başlat ---
let genAI;
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("✅ Google Gemini API istemcisi başarıyla başlatıldı.");
} catch(e) {
    console.error("❌ Gemini API istemcisi başlatılamadı. .env dosyasını kontrol edin.", e);
    process.exit(1);
}

const userSessions = {};
const wss = new WebSocketServer({ port: WORKER_PORT });
console.log(`[Worker] ✅ Hibrit Worker sunucusu ${WORKER_PORT} portunda dinliyor...`);
console.log(`[Worker] 🤖 LLM Modeli: ${LLM_MODEL_NAME} (Google Cloud)`);
console.log(`[Worker] 🗣️ TTS Motoru: XTTS v2 (Yerel @ ${XTTS_PORT})`);


wss.on('connection', ws => {
  console.log("[Worker] ✅ Gateway bağlandı.");
  ws.on('message', async (message) => {
    try {
        const data = JSON.parse(message);
        if (data.type !== 'user_transcript') return;
        
        const { sessionId, text } = data.payload;
        // Oturum ve Yönlendirici mantığı aynı...
        if (!userSessions[sessionId]) {
            userSessions[sessionId] = { history: [], activeScenario: null };
        }
        const session = userSessions[sessionId];
        
        // --- 1. DÜŞÜNME (Google Gemini ile) ---
        const chat = genAI.getGenerativeModel({ model: LLM_MODEL_NAME }).startChat({
            history: session.history,
            generationConfig: { maxOutputTokens: 100 }
        });
        const result = await chat.sendMessage(text);
        const aiReplyText = result.response.text();
        
        console.log(`[Worker] Gemini Cevabı: "${aiReplyText}"`);
        
        // Geçmişi güncelle
        session.history.push({ role: "user", parts: [{ text }] });
        session.history.push({ role: "model", parts: [{ text: aiReplyText }] });

        // --- 2. KONUŞMA (Yerel XTTS ile) ---
        const audioContent = await getXttsAudio(aiReplyText);

        // --- 3. CEVABI GÖNDERME ---
        ws.send(JSON.stringify({
            type: 'ai_audio',
            payload: { sessionId, text: aiReplyText, audio: audioContent, audio_format: 'wav' }
        }));
        console.log('[Worker] Hibrit cevap (Gemini+XTTS) üretildi ve gönderildi.');

    } catch (error) {
        console.error("[Worker] ❌ Mesaj işlenirken hata:", error);
        ws.send(JSON.stringify({ type: 'error', payload: { message: "AI sunucusunda bir hata oluştu." }}));
    }
  });
  ws.on('close', () => console.log('[Worker] Gateway bağlantısı kapandı.'));
});


// --- XTTS Yardımcı Fonksiyonu ---
function getXttsAudio(text) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            text: text,
            speaker_wav: "female_voice.wav", // Bu bir referans ses dosyası olmalı
            language: "tr"
        });
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
            reject(`XTTS isteği başarısız: ${e.message}. XTTS sunucusunun çalıştığından emin misin?`);
        });
    });
}