// src/services/worker.js
const { WebSocketServer } = require('ws');
const config = require('../config');
const dbHandler = require('../core/db-handler');
const aiHandler = require('../core/ai-handler');
const ttsHandler = require('../core/tts-handler');
const hotelScenario = require('../scenarios/hotel_booking');

const scenarios = { 'otel_rezervasyonu': hotelScenario };
const userSessions = {};
const wss = new WebSocketServer({ port: config.workerPort });

console.log(`[Worker] ✅ Profesyonel Worker ${config.workerPort} portunda dinliyor...`);

wss.on('connection', ws => {
    console.log("[Worker] ✅ Gateway bağlandı.");
    ws.on('message', async (rawMessage) => {
        let sourceClientId = null;
        try {
            const messageData = JSON.parse(rawMessage);
            sourceClientId = messageData.sourceClientId;
            const payload = messageData.payload;
            if (!sourceClientId || !payload || payload.type !== 'user_transcript') return;

            const { sessionId, text } = payload.payload;
            if (!userSessions[sessionId]) {
                userSessions[sessionId] = { 
                    scenarioId: null,
                    params: {},
                    lastQuestionParam: null
                };
            }
            const session = userSessions[sessionId];
            console.log(`[Worker] [Client: ${sourceClientId}] Gelen metin: "${text}"`);

            // 1. Senaryo Belirleme
            if (!session.scenarioId) {
                for (const scenario of Object.values(scenarios)) {
                    if (scenario.trigger_keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                        session.scenarioId = scenario.id;
                        console.log(`[Worker] Senaryo bulundu: ${session.scenarioId}`);
                        break;
                    }
                }
            }
            
            let spokenResponse, displayData;
            const currentScenario = scenarios[session.scenarioId];

            if (currentScenario) {
                // 2. Bilgi Çıkarımı
                if (session.lastQuestionParam) {
                    const extractedValue = await aiHandler.extractParameters(text, session.lastQuestionParam.question);
                    if (extractedValue) {
                        session.params[session.lastQuestionParam.name] = extractedValue;
                        console.log(`[Worker] Bilgi çıkarıldı: {${session.lastQuestionParam.name}: "${extractedValue}"}`);
                    }
                }

                // 3. Form Kontrolü ve Soru Sorma
                const nextParamToAsk = currentScenario.required_params.find(p => !session.params[p.name]);
                
                if (nextParamToAsk) {
                    spokenResponse = nextParamToAsk.question;
                    session.lastQuestionParam = nextParamToAsk;
                    displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                } else {
                    // 4. Eylem: Rezervasyon
                    const reservationData = { type: currentScenario.id, params: session.params, status: 'confirmed' };
                    const imageUrl = await aiHandler.getImageUrl(reservationData.params.location);
                    reservationData.imageUrl = imageUrl;
                    
                    const newReservation = await dbHandler.saveReservation(reservationData);
                    
                    spokenResponse = currentScenario.confirmation_message;
                    displayData = { type: 'confirmation_card', data: newReservation };
                    delete userSessions[sessionId]; // Oturumu temizle
                }
            } else {
                spokenResponse = "Size nasıl yardımcı olabilirim? Örneğin, 'otel rezervasyonu' diyebilirsiniz.";
                displayData = { type: 'info_request', text: spokenResponse };
            }

            const audioContent = await ttsHandler.getXttsAudio(spokenResponse);

            const responsePacket = {
                targetClientId: sourceClientId,
                payload: {
                    type: 'ai_response',
                    payload: { sessionId, spokenText: spokenResponse, audio: audioContent, audio_format: 'wav', display: displayData }
                }
            };
            ws.send(JSON.stringify(responsePacket));

        } catch (error) {
            console.error(`[Worker] ❌ [Client: ${sourceClientId}] Hata:`, error);
        }
    });
});