const { WebSocketServer } = require('ws');
const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Konfigürasyon ---
const WORKER_PORT = 8081;
const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const OLLAMA_MODEL = 'phi3';

const PIPER_PATH = 'C:\\piper\\piper.exe';
const PIPER_VOICE_PATH = 'C:\\piper-voices\\tr\\tr_TR\\fettah\\medium\\tr_TR-fettah-medium.onnx';
const OUTPUT_WAV_PATH = path.resolve(__dirname, 'output.wav');

// --- Senaryoları Yükle ---
const hotelScenario = require('./scenarios/hotel_booking.js');
const massageScenario = require('./scenarios/massage_salon.js');
const scenarios = { 'otel_rezervasyonu': hotelScenario, 'masaj_randevusu': massageScenario };

// --- Sunucu ve Oturum Yönetimi ---
const userSessions = {};
const wss = new WebSocketServer({ port: WORKER_PORT });
console.log(`[Worker] ✅ Yerel Worker sunucusu ${WORKER_PORT} portunda dinliyor...`);
console.log(`[Worker] 🤖 LLM Modeli: ${OLLAMA_MODEL} (Ollama üzerinden)`);
console.log(`[Worker] 🗣️ TTS Motoru: Piper (Yerel)`);

// --- WebSocket Bağlantı Mantığı ---
wss.on('connection', ws => {
  console.log("[Worker] ✅ Gateway bağlandı.");

  ws.on('message', async (message) => {
    try {
        const data = JSON.parse(message);
        if (data.type !== 'user_transcript') return;
        
        const { sessionId, text } = data.payload;
        console.log(`[Worker] Gelen metin: "${text}" | Oturum: ${sessionId}`);
        
        const finalPrompt = `Kullanıcı diyor ki: "${text}". Kısa ve doğal bir dille cevap ver.`;

        const ollamaResponse = await getOllamaResponse(finalPrompt);
        const aiReplyText = ollamaResponse.response.trim();
        console.log(`[Worker] Ollama Cevabı: "${aiReplyText}"`);

        await generatePiperAudio(aiReplyText);
        
        const audioContent = fs.readFileSync(OUTPUT_WAV_PATH).toString('base64');

        ws.send(JSON.stringify({
            type: 'ai_audio',
            payload: { 
                sessionId, 
                text: aiReplyText, 
                audio: audioContent,
                audio_format: 'wav'
            }
        }));
        console.log('[Worker] Yerel ses üretildi ve Gateway\'e gönderildi.');

    } catch (error) {
        console.error("[Worker] ❌ Mesaj işlenirken hata:", error);
        ws.send(JSON.stringify({ type: 'error', payload: { message: "Yerel AI sunucusunda bir hata oluştu." }}));
    }
  });

  ws.on('close', () => console.log('[Worker] Gateway bağlantısı kapandı.'));
});

// --- Yardımcı Fonksiyonlar ---
function getOllamaResponse(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false
    });

    // *** DÜZELTME BURADA BAŞLIYOR ***
    // Karakter sayısı yerine Buffer kullanarak bayt uzunluğunu hesaplıyoruz.
    const postDataBytes = Buffer.byteLength(postData, 'utf-8');

    const options = {
      hostname: OLLAMA_HOST, 
      port: OLLAMA_PORT, 
      path: '/api/generate', 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': postDataBytes // Doğru bayt uzunluğunu kullanıyoruz.
      }
    };
    // *** DÜZELTME BURADA BİTİYOR ***

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
            reject(new Error(`Ollama'dan hata kodu ${res.statusCode}: ${responseBody}`));
        } else {
            try {
                resolve(JSON.parse(responseBody));
            } catch (e) {
                reject(new Error(`Ollama'dan gelen JSON parse edilemedi: ${responseBody}`));
            }
        }
      });
    });
    req.on('error', (e) => reject(`Ollama isteği başarısız: ${e.message}`));
    req.write(postData);
    req.end();
  });
}

function generatePiperAudio(text) {
    return new Promise((resolve, reject) => {
        const command = `echo "${text.replace(/"/g, '\\"')}" | "${PIPER_PATH}" --model "${PIPER_VOICE_PATH}" --output_file "${OUTPUT_WAV_PATH}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(`Piper hatası: ${error.message}`);
            resolve(stdout);
        });
    });
}