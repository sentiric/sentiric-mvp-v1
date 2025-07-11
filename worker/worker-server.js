const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// --- Konfigürasyonu .env'den yükle (dotenv-cli sayesinde process.env dolu gelir) ---
const WORKER_PORT = process.env.WORKER_PORT || 8081;
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || "gemini-1.5-flash-latest";
const TTS_LANGUAGE_CODE = process.env.TTS_LANGUAGE_CODE || "tr-TR";
const TTS_VOICE_GENDER = process.env.TTS_VOICE_GENDER || "FEMALE";
const TTS_AUDIO_ENCODING = process.env.TTS_AUDIO_ENCODING || "MP3";
const DEFAULT_SYSTEM_INSTRUCTION = process.env.DEFAULT_SYSTEM_INSTRUCTION || "Sen yardımsever bir asistansın.";

// --- Senaryoları Yükle ---
const hotelScenario = require('./scenarios/hotel_booking.js');
const massageScenario = require('./scenarios/massage_salon.js');
const scenarios = { 'otel_rezervasyonu': hotelScenario, 'masaj_randevusu': massageScenario };

// --- API İstemcilerini Başlat ---
let genAI, ttsClient;
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    ttsClient = new TextToSpeechClient();
    console.log("✅ API istemcileri başarıyla başlatıldı.");
} catch(e) {
    console.error("❌ API istemcileri başlatılırken hata oluştu. .env ve kimlik doğrulama dosyalarınızı kontrol edin.", e);
    process.exit(1);
}

// --- Sunucu ve Oturum Yönetimi ---
const userSessions = {};
const wss = new WebSocketServer({ port: WORKER_PORT });
console.log(`✅ Worker sunucusu ${WORKER_PORT} portunda dinliyor...`);
console.log(`🤖 LLM Modeli: ${LLM_MODEL_NAME}, 🗣️ TTS Sesi: ${TTS_LANGUAGE_CODE} - ${TTS_VOICE_GENDER}`);

// --- WebSocket Bağlantı Mantığı ---
wss.on('connection', ws => {
  console.log('✅ Gateway bağlandı.');

  ws.on('message', async (message) => {
    try {
        const data = JSON.parse(message);
        if (data.type !== 'user_transcript') return;
        
        const { sessionId, text } = data.payload;
        console.log(`[Worker] Gelen metin: "${text}" | Oturum: ${sessionId}`);
        
        if (!userSessions[sessionId]) {
            userSessions[sessionId] = { history: [], activeScenario: null };
        }
        const session = userSessions[sessionId];
        session.history.push({ role: 'user', parts: [{ text }] });
        
        let systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
        let finalPrompt = text;

        if (!session.activeScenario) {
            const scenarioDescriptions = Object.keys(scenarios).map(key => `- ${key}: ${scenarios[key].description}`).join('\n');
            const routerPrompt = `Kullanıcının şu mesajını analiz et: "${text}". Bu mesajın niyeti aşağıdaki kategorilerden hangisine en uygun? Sadece kategori anahtarını JSON formatında dön. Örneğin: {"intent": "otel_rezervasyonu"}\n\nKategoriler:\n${scenarioDescriptions}\nEğer hiçbiri değilse {"intent": "none"} dön.`;
            const routerModel = genAI.getGenerativeModel({ model: LLM_MODEL_NAME });
            const result = await routerModel.generateContent(routerPrompt);
            const responseText = result.response.text();
            const intentJsonMatch = responseText.match(/{.*}/s);
            if (intentJsonMatch) {
                const intentJson = JSON.parse(intentJsonMatch[0]);
                if (scenarios[intentJson.intent]) {
                    session.activeScenario = intentJson.intent;
                    console.log(`[Oturum: ${sessionId}] Niyet anlaşıldı. Aktif senaryo: ${session.activeScenario}`);
                }
            }
        }

        if (session.activeScenario) {
            const currentScenario = scenarios[session.activeScenario];
            systemInstruction = currentScenario.systemInstruction;
            finalPrompt = `BAĞLAM:\n---\n${currentScenario.knowledgeBase}\n---\nYukarıdaki BAĞLAM'ı kullanarak ve bir diyalog asistanı gibi davranarak kullanıcının şu isteğini ele al: "${text}"`;
        }

        const chatModel = genAI.getGenerativeModel({ model: LLM_MODEL_NAME, systemInstruction });
        const chat = chatModel.startChat({ history: session.history.slice(0, -1) });
        const result = await chat.sendMessage(finalPrompt);
        const aiReplyText = result.response.text();

        session.history.push({ role: 'model', parts: [{ text: aiReplyText }] });
        console.log(`[Worker] AI Cevabı: "${aiReplyText}"`);

        const ttsRequest = {
            input: { text: aiReplyText },
            voice: { languageCode: TTS_LANGUAGE_CODE, ssmlGender: TTS_VOICE_GENDER },
            audioConfig: { audioEncoding: TTS_AUDIO_ENCODING },
        };
        const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
        const audioContent = ttsResponse.audioContent.toString('base64');

        ws.send(JSON.stringify({
            type: 'ai_audio',
            payload: { sessionId, text: aiReplyText, audio: audioContent }
        }));
        console.log('[Worker] Ses üretildi ve Gateway\'e gönderildi.');

    } catch (error) {
        console.error("❌ Worker'da mesaj işlenirken hata:", error.message);
        ws.send(JSON.stringify({ type: 'error', payload: { message: "AI servisinden cevap alınamadı. Lütfen daha sonra tekrar deneyin." }}));
    }
  });

  ws.on('close', () => console.log('Gateway bağlantısı kapandı.'));
});