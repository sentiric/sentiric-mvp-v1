// src/services/worker.js (Ana Worker Orkestratörü)
const { WebSocketServer } = require('ws');
const config = require('../config');
const ttsHandler = require('../core/tts-handler'); 
const CallContextManager = require('../managers/call_context_manager'); 
const DialogOrchestrator = require('../dialog_flow/dialog_orchestrator'); 

const wss = new WebSocketServer({ port: config.workerPort });

let ttsStatus = { healthy: false, message: "TTS servisi kontrol ediliyor..." }; 

console.log(`[Worker] ✅ Profesyonel Worker ${config.workerPort} portunda dinliyor...`);

setInterval(() => {
    CallContextManager.cleanupOldContexts(10); 
}, 5 * 60 * 1000);

async function checkAndSetTtsHealth() {
    try {
        const healthy = await ttsHandler.checkTtsHealth();
        if (healthy) {
            ttsStatus = { healthy: true, message: "TTS Servisi şu anda sağlıklı." };
            console.log("[Worker] ✅ TTS Servisi şu anda sağlıklı.");
        } else {
            ttsStatus = { healthy: false, message: "TTS Servisi erişilemiyor veya yanıt vermiyor." };
            console.error(`[Worker] ❌ TTS Servisi erişilemiyor.`);
        }
    } catch (ttsHealthError) {
        ttsStatus = { healthy: false, message: `TTS Servisi kontrol hatası: ${ttsHealthError.message}` };
        console.error(`[Worker] ❌ TTS Servisi kontrol hatası: ${ttsHealthError.message}`);
    }
}

// YENİ: Worker'ın başlamasını TTS sağlık kontrolünün bitmesini bekle
(async () => {
    await checkAndSetTtsHealth();
    // Periyodik sağlık kontrolünü başlat
    setInterval(checkAndSetTtsHealth, 15 * 1000); 

    // WebSocket sunucusu dinlemeye başla
    wss.on('connection', ws => {
        console.log("[Worker] ✅ Gateway bağlandı.");
        ws.on('message', async (rawMessage) => {
            let sourceClientId = null;
            let sessionId = 'unknown_session'; 
            let text = '';
            let messageType = 'unknown'; 

            try {
                const messageData = JSON.parse(rawMessage);
                sourceClientId = messageData.sourceClientId;
                const payload = messageData.payload;
                
                sessionId = payload?.payload?.sessionId || 'unknown_session';
                text = payload?.payload?.text || '';
                messageType = payload?.type || 'unknown'; 

                if (messageType === 'reset_session') {
                    CallContextManager.deleteContext(sessionId); 
                    console.log(`[Worker] ✅ Tarayıcıdan sıfırlama isteği alındı, oturum silindi: ${sessionId}`);
                    return; 
                }

                // YENİ: Tarayıcıya TTS sağlık durumunu her mesajda gönder (UI için)
                // Bu sayede UI'da anlık TTS durumunu görebiliriz
                ws.send(JSON.stringify({
                    targetClientId: sourceClientId,
                    payload: {
                        type: 'tts_status_update',
                        payload: ttsStatus
                    }
                }));

                if (!sourceClientId || messageType !== 'user_transcript') { 
                    console.warn("[Worker] Geçersiz veya tanımsız mesaj tipi alındı:", messageType);
                    return;
                }

                const session = CallContextManager.getOrCreateContext(sessionId, sourceClientId);
                
                let spokenResponse;
                let displayData;

                const { spokenResponse: orchSpokenResponse, displayData: orchDisplayData, resetSessionScenario } = await DialogOrchestrator.processUserMessage(session, text);
                spokenResponse = orchSpokenResponse;
                displayData = orchDisplayData;

                let audioContent = null;
                if (ttsStatus.healthy) { // Sadece TTS sağlıklıysa ses üretmeye çalış
                    try {
                        audioContent = await ttsHandler.getXttsAudio(spokenResponse); 
                    } catch (ttsError) {
                        // Ses üretiminde runtime hatası oluşursa, TTS'i sağlıksız olarak işaretle
                        ttsStatus = { healthy: false, message: `Konuşma üretilirken TTS hatası: ${ttsError.message}` };
                        console.error("[Worker] ❌ Konuşma sırasında TTS hatası:", ttsError);
                        spokenResponse = "Üzgünüm, sesli yanıt servisimizde bir sorun oluştu. Metin tabanlı devam edelim."; // Sesli yanıt veremezsek metinle bildir
                        displayData = { type: 'error', message: spokenResponse };
                    }
                } else {
                     console.log("[Worker] ℹ️ TTS servisi sağlıksız, sesli yanıt üretilmiyor.");
                     // TTS sağlıksızken metin tabanlı devam etsin diye displayData ve spokenResponse zaten güncellenmeliydi.
                     // Buraya ek bir mesaj atmaya gerek yok, DialogOrchestrator'dan gelen yanıtı direkt kullanacağız.
                }

                const responsePacket = {
                    targetClientId: sourceClientId,
                    payload: {
                        type: 'ai_response',
                        payload: { sessionId: session.sessionId, spokenText: spokenResponse, audio: audioContent, audio_format: 'wav', display: displayData }
                    }
                };
                ws.send(JSON.stringify(responsePacket));

                if (resetSessionScenario) {
                    CallContextManager.resetScenarioContext(session.sessionId); 
                }

            } catch (error) {
                console.error(`[Worker] ❌ [Client: ${sourceClientId || 'unknown'}] [Session: ${sessionId}] İşleme sırasında kritik hata:`, error);
                const errorResponse = "Üzgünüm, bir sorun oluştu ve isteğinizi işleyemedim. Lütfen daha sonra tekrar deneyin veya bana başka bir şey söyleyin.";
                
                let audioContent = null;
                if (ttsStatus.healthy) { 
                    try {
                        audioContent = await ttsHandler.getXttsAudio(errorResponse);
                    } catch (ttsError) {
                        console.error("[Worker] ❌ Kritik hata sonrası TTS yanıtı üretilemedi (TTS hatası da oluştu):", ttsError);
                    }
                } else {
                     console.log("[Worker] ℹ️ TTS servisi zaten sağlıksız, kritik hata sonrası sesli yanıt üretilemiyor.");
                }

                ws.send(JSON.stringify({
                    targetClientId: sourceClientId,
                    payload: {
                        type: 'ai_response',
                        payload: { 
                            sessionId: sessionId, 
                            spokenText: errorResponse, 
                            audio: audioContent, 
                            audio_format: 'wav', 
                            display: { type: 'error', message: errorResponse } 
                        }
                    }
                }));
                if (CallContextManager.getContext(sessionId)) { 
                    CallContextManager.resetScenarioContext(sessionId);
                }
            }
        });
    });
})(); // Self-invoking function