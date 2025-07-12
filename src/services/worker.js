// src/services/worker.js
const { WebSocketServer } = require('ws');
const config = require('../config');
const dbHandler = require('../core/db-handler');
const aiHandler = require('../core/ai-handler');
const ttsHandler = require('../core/tts-handler');
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request'); // Yeni senaryoyu import et
const knowledgeBase = require('../../data/knowledge_base.json'); // Bilgi bankasını import et

const scenarios = { 
    'otel_rezervasyonu': hotelScenario,
    'information_request': informationRequestScenario // Yeni senaryoyu ekle
};
const userSessions = {};
const wss = new WebSocketServer({ port: config.workerPort });

console.log(`[Worker] ✅ Profesyonel Worker ${config.workerPort} portunda dinliyor...`);

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
                    lastQuestionParam: null,
                    misunderstandingCount: 0 
                };
            }
            const session = userSessions[sessionId];
            console.log(`[Worker] [Client: ${sourceClientId}] Gelen metin: "${text}"`);

            let spokenResponse, displayData;
            
            const initialTrigger = !session.scenarioId; 

            if (initialTrigger) { 
                // Önce bilgi talebi senaryosunu kontrol et
                if (informationRequestScenario.trigger_keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                    session.scenarioId = informationRequestScenario.id;
                    console.log(`[Worker] Senaryo bulundu: ${session.scenarioId} (Bilgi Talebi)`);
                } else {
                    // Sonra diğer senaryoları kontrol et
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
                    // Bilgi Talebi Senaryosu için özel işlem
                    spokenResponse = await aiHandler.answerQuestionWithContext(text, knowledgeBase);
                    displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                    // Bilgi talebi senaryosunda oturumu sıfırla, çünkü tek seferlik bir yanıt beklenir
                    delete userSessions[sessionId]; 

                } else {
                    // Diğer Senaryolar (örn. Otel Rezervasyonu) için mevcut mantık
                    if (session.lastQuestionParam || initialTrigger) { 
                        let paramToExtractFor = null;
                        if(session.lastQuestionParam) {
                            paramToExtractFor = session.lastQuestionParam.name;
                        } else if (initialTrigger && currentScenario.required_params.length > 0) {
                            paramToExtractFor = currentScenario.required_params[0].name;
                        }

                        if (paramToExtractFor) { 
                            const extractedValue = await aiHandler.extractParameters(text, paramToExtractFor, session.lastQuestionParam ? session.lastQuestionParam.question : `Kullanıcının "${text}" cevabından bir ${paramToExtractFor} değeri çıkar.`);
                            
                            if (extractedValue && validateExtractedValue(paramToExtractFor, extractedValue)) {
                                session.params[paramToExtractFor] = extractedValue;
                                session.misunderstandingCount = 0; 
                                console.log(`[Worker] Bilgi çıkarıldı: {${paramToExtractFor}: "${extractedValue}"}`);
                            } else {
                                if (!initialTrigger) { 
                                    session.misunderstandingCount++;
                                    console.warn(`[Worker] ⚠️ Parametre çıkarılamadı veya geçersiz: '${text}'. Anlayamama sayısı: ${session.misunderstandingCount}`);
                                } else {
                                    console.log(`[Worker] ℹ️ İlk tetikleyici mesajdan beklenen parametre çıkarılamadı, normal akış devam edecek.`);
                                }
                            }
                        }
                    }

                    if (session.misunderstandingCount >= 2) { 
                        spokenResponse = "Üzgünüm, sizi tam olarak anlayamadım. Lütfen bilgiyi daha net bir şekilde tekrar edebilir misiniz?";
                        displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                        session.misunderstandingCount = 0; 
                    } else {
                        const nextParamToAsk = currentScenario.required_params.find(p => !session.params[p.name]);
                        
                        if (nextParamToAsk) {
                            spokenResponse = nextParamToAsk.question;
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
                spokenResponse = "Size nasıl yardımcı olabilirim? Örneğin, 'otel rezervasyonu yapmak istiyorum' veya 'çalışma saatleriniz nedir?' diyebilirsiniz."; // Yeni örnekler eklendi
                displayData = { type: 'info_request', text: spokenResponse };
                session.lastQuestionParam = null; 
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