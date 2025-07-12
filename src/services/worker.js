// src/services/worker.js
const { WebSocketServer } = require('ws');
const config = require('../config');
const dbHandler = require('../core/db-handler');
const aiHandler = require('../core/ai-handler');
const ttsHandler = require('../core/tts-handler');
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request'); 
const knowledgeBase = require('../../data/knowledge_base.json'); 

const scenarios = { 
    'otel_rezervasyonu': hotelScenario,
    'information_request': informationRequestScenario 
};
const userSessions = {};
const wss = new WebSocketServer({ port: config.workerPort });

console.log(`[Worker] ✅ Profesyonel Worker ${config.workerPort} portunda dinliyor...`);

// validateExtractedValue fonksiyonu değişmedi

function validateExtractedValue(paramName, value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return false;
    }

    const stringValue = String(value).toLowerCase();

    switch (paramName) {
        case 'location':
            const words = stringValue.split(' ').filter(w => w.length > 0);
            if (words.length > 3 || stringValue.length < 2) { 
                console.warn(`[Worker - Validation] ⚠️ Konum değeri şüpheli (çok uzun/kısa): '${value}'`);
                return false;
            }
            return true;
        case 'people_count':
            const numPeople = parseInt(stringValue, 10); 
            if (isNaN(numPeople) || numPeople <= 0 || numPeople > 99) { 
                console.warn(`[Worker - Validation] ⚠️ Kişi sayısı geçersiz: '${value}'`);
                return false;
            }
            return true;
        case 'budget':
            const numBudget = parseInt(stringValue.replace(/[^0-9]/g, ''), 10); 
            if (isNaN(numBudget) || numBudget <= 0) {
                console.warn(`[Worker - Validation] ⚠️ Bütçe geçersiz: '${value}'`);
                return false;
            }
            return true;
        case 'checkin_date':
            if (stringValue.length < 5) { 
                console.warn(`[Worker - Validation] ⚠️ Tarih değeri şüpheli: '${value}'`);
                return false;
            }
            return true;
        default:
            return true; 
    }
}


wss.on('connection', ws => {
    console.log("[Worker] ✅ Gateway bağlandı.");
    ws.on('message', async (rawMessage) => {
        let sourceClientId = null;
        let sessionIdForError = 'unknown'; 
        try {
            const messageData = JSON.parse(rawMessage);
            sourceClientId = messageData.sourceClientId;
            const payload = messageData.payload;
            
            sessionIdForError = payload?.payload?.sessionId || 'unknown';

            if (!sourceClientId || !payload || payload.type !== 'user_transcript') return;

            const { sessionId, text } = payload.payload;
            if (!userSessions[sessionId]) {
                userSessions[sessionId] = { 
                    scenarioId: null,
                    params: {},
                    misunderstandingCount: 0 
                };
            }
            const session = userSessions[sessionId];
            console.log(`[Worker] [Client: ${sourceClientId}] Gelen metin: "${text}"`);

            let spokenResponse, displayData;
            
            const initialTrigger = !session.scenarioId; 

            if (initialTrigger) { 
                if (informationRequestScenario.trigger_keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                    session.scenarioId = informationRequestScenario.id;
                    console.log(`[Worker] Senaryo bulundu: ${session.scenarioId} (Bilgi Talebi)`);
                } else {
                    for (const scenario of Object.values(scenarios)) {
                        if (scenario.id !== 'information_request' && scenario.trigger_keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                            session.scenarioId = scenario.id;
                            console.log(`[Worker] Senaryo bulundu: ${session.scenarioId}`);
                            break;
                        }
                    }
                }
            }
            
            const currentScenario = scenarios[session.scenarioId];

            if (currentScenario) {
                if (currentScenario.id === 'information_request') {
                    spokenResponse = await aiHandler.answerQuestionWithContext(text, knowledgeBase);
                    displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                    delete userSessions[sessionId]; 

                } else {
                    // YENİ: Çoklu parametre çıkarma mantığı
                    const missingParams = currentScenario.required_params.filter(p => !session.params[p.name]);
                    let anyParamExtractedSuccessfully = false;

                    // Sadece hala eksik olan parametreleri LLM'e soruyoruz
                    if (missingParams.length > 0) {
                        const extractedValues = await aiHandler.extractMultipleParameters(text, missingParams);
                        
                        // Çıkarılan her bir değeri kontrol edip session'a ekle
                        for (const paramDef of missingParams) {
                            const extractedValue = extractedValues[paramDef.name]; // LLM'den gelen değer
                            if (extractedValue && validateExtractedValue(paramDef.name, extractedValue)) {
                                session.params[paramDef.name] = extractedValue;
                                console.log(`[Worker] Bilgi çıkarıldı: {${paramDef.name}: "${extractedValue}"}`);
                                anyParamExtractedSuccessfully = true;
                            } else if (extractedValue === null) { // LLM açıkça null döndürdüyse
                                console.log(`[Worker] ℹ️ LLM '${paramDef.name}' için null döndürdü.`);
                            } else if (extractedValue !== undefined) { // LLM bir değer döndürdü ama validasyondan geçmedi
                                console.warn(`[Worker] ⚠️ Parametre '${paramDef.name}' için çıkarılan değer geçersiz: '${extractedValue}'`);
                            }
                        }

                        // Eğer hiçbir parametre başarılı bir şekilde çıkarılamadıysa veya geçerli değilse,
                        // ve bu ilk tetikleyici mesaj değilse (yani sistem bir soru sormuşsa),
                        // anlayamama sayacını artır.
                        if (!anyParamExtractedSuccessfully && !initialTrigger) {
                            session.misunderstandingCount++;
                            console.warn(`[Worker] ⚠️ Hiçbir beklenen parametre çıkarılamadı veya geçersiz. Anlayamama sayısı: ${session.misunderstandingCount}`);
                        } else if (!anyParamExtractedSuccessfully && initialTrigger) {
                            console.log(`[Worker] ℹ️ İlk tetikleyici mesajdan herhangi bir beklenen parametre çıkarılamadı.`);
                        } else { // En az bir parametre başarılı ise sayacı sıfırla
                            session.misunderstandingCount = 0;
                        }
                    }

                    // Artık lastQuestionParam'ı sadece sıradaki soruyu belirlemek için kullanacağız.
                    // session.lastQuestionParam = null; // Bu satırı kaldırabiliriz, zaten dinamik belirlenecek.

                    if (session.misunderstandingCount >= 2) { 
                        spokenResponse = "Üzgünüm, sizi tam olarak anlayamadım. Lütfen bilgiyi daha net bir şekilde tekrar edebilir misiniz?";
                        displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                        session.misunderstandingCount = 0; 
                    } else {
                        const nextParamToAsk = currentScenario.required_params.find(p => !session.params[p.name]);
                        
                        if (nextParamToAsk) {
                            spokenResponse = nextParamToAsk.question;
                            // session.lastQuestionParam'ı burada güncelliyoruz, ama artık tek bir parametreyi temsil etmiyor
                            // Sadece sıradaki soruyu tutmak için kullanıyoruz
                            session.lastQuestionParam = nextParamToAsk; 
                            displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                        } else {
                            const reservationData = { type: currentScenario.id, params: session.params, status: 'confirmed' };
                            const imageUrl = await aiHandler.getImageUrl(reservationData.params.location);
                            reservationData.imageUrl = imageUrl;
                            
                            const newReservation = await dbHandler.saveReservation(reservationData);
                            
                            spokenResponse = currentScenario.confirmation_message(session.params);
                            displayData = { type: 'confirmation_card', data: newReservation };
                            delete userSessions[sessionId]; 
                        }
                    }
                }
            } else {
                spokenResponse = "Size nasıl yardımcı olabilirim? Örneğin, 'otel rezervasyonu yapmak istiyorum' veya 'çalışma saatleriniz nedir?' diyebilirsiniz."; 
                displayData = { type: 'info_request', text: spokenResponse };
                // session.lastQuestionParam = null; // Bu satırı artık buraya gerek yok
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
            console.error(`[Worker] ❌ [Client: ${sourceClientId}] İşleme sırasında kritik hata:`, error);
            const errorResponse = "Üzgünüm, bir sorun oluştu ve isteğinizi işleyemedim. Lütfen daha sonra tekrar deneyin veya bana başka bir şey söyleyin.";
            
            let audioContent;
            try {
                audioContent = await ttsHandler.getXttsAudio(errorResponse);
            } catch (ttsError) {
                console.error("[Worker] ❌ TTS hatası sırasında hata oluştu, sesli yanıt verilemiyor:", ttsError);
                audioContent = null; 
            }

            ws.send(JSON.stringify({
                targetClientId: sourceClientId,
                payload: {
                    type: 'ai_response',
                    payload: { 
                        sessionId: sessionIdForError, 
                        spokenText: errorResponse, 
                        audio: audioContent, 
                        audio_format: 'wav', 
                        display: { type: 'error', message: errorResponse } 
                    }
                }
            }));
            if (userSessions[sessionIdForError]) { 
                delete userSessions[sessionIdForError];
            }
        }
    });
});