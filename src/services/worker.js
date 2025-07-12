// src/services/worker.js (Ana Worker Orkestratörü - Tam ve Dayanıklı Hali)
const { WebSocketServer } = require('ws');
const config = require('../config');
const ttsHandler = require('../core/tts-handler');
const CallContextManager = require('../managers/call_context_manager');
const DialogOrchestrator = require('../dialog_flow/dialog_orchestrator');

const wss = new WebSocketServer({ port: config.workerPort });

let ttsStatus = { healthy: false, message: "Kontrol ediliyor..." };

console.log(`[Worker] ✅ Profesyonel Worker ${config.workerPort} portunda dinliyor...`);

// --- Periyodik Görevler ---

// Eski oturumları temizleme
setInterval(() => CallContextManager.cleanupOldContexts(10), 5 * 60 * 1000);

// TTS sağlık durumunu periyodik olarak kontrol etme
async function checkAndSetTtsHealth() {
    try {
        const healthResponse = await ttsHandler.checkTtsHealth();
        if (healthResponse.status === 'healthy') {
            if (!ttsStatus.healthy) console.log("[Worker] ✅ TTS Servisi sağlığına kavuştu.");
            ttsStatus = { healthy: true, message: "Sağlıklı" };
        } else {
            throw new Error(healthResponse.reason || "Bilinmeyen bir nedenle sağlıksız.");
        }
    } catch (ttsHealthError) {
        if (ttsStatus.healthy) console.error(`[Worker] ❌ TTS Servisi bağlantısı koptu.`);
        ttsStatus = { healthy: false, message: `Erişilemiyor` };
    }
}
// Bu interval'ı worker başladığında bir kere çalıştıracağız.
const ttsHealthCheckInterval = setInterval(checkAndSetTtsHealth, 20000); // 20 saniyede bir kontrol et

// --- Konuşma Zenginleştirme ---
function enrichWithSSML(text, displayContext) {
    if (!text) return "";

    if (text.includes('<speak>')) return text;

    let enrichedText = text;
    if (displayContext && displayContext.type === 'confirmation_card') {
        enrichedText = `Harika! <break time="300ms"/> Rezervasyonunuz <emphasis level="strong">onaylanmıştır</emphasis>. <break time="500ms"/> Detayları ekranda görebilirsiniz.`;
    } else if (text.toLowerCase().includes("üzgünüm") || text.toLowerCase().includes("anlayamadım")) {
        enrichedText = `<prosody rate="slow">${text}</prosody>`;
    } else if (text.toLowerCase().includes("nasıl yardımcı olabilirim")) {
        enrichedText = `${text} <break time="400ms"/>`;
    }
    return `<speak>${enrichedText}</speak>`;
}


// --- Ana Çalışma Mantığı ---
// Worker başladığında bir kere ilk sağlık kontrolünü yap
(async () => {
    await checkAndSetTtsHealth();

    wss.on('connection', ws => {
        console.log("[Worker] ✅ Gateway bağlandı.");

        ws.on('message', async (rawMessage) => {
            let sourceClientId = null;
            let sessionId = 'unknown_session';
            
            try {
                const messageData = JSON.parse(rawMessage);
                sourceClientId = messageData.sourceClientId;
                const payload = messageData.payload;
                sessionId = payload?.payload?.sessionId || 'unknown_session';
                const messageType = payload?.type || 'unknown';

                // ⭐️ YENİ: UI'dan gelen 'session_init' mesajını işle
                // Bu, UI'ın doğru bir şekilde başlamasını sağlar.
                if (messageType === 'session_init') {
                    console.log(`[Worker] UI'dan oturum başlatma isteği alındı: ${sessionId}`);
                    ws.send(JSON.stringify({
                        targetClientId: sourceClientId,
                        payload: { type: 'tts_status_update', payload: ttsStatus }
                    }));
                    return;
                }

                if (messageType === 'reset_session') {
                    CallContextManager.deleteContext(sessionId);
                    console.log(`[Worker] Oturum sıfırlandı: ${sessionId}`);
                    return;
                }

                if (messageType !== 'user_transcript' || !payload?.payload?.text) {
                    // Diğer mesaj tiplerini görmezden gel
                    return;
                }

                const userText = payload.payload.text;
                const session = CallContextManager.getOrCreateContext(sessionId, sourceClientId);

                const { spokenResponse, displayData, resetSessionScenario } = await DialogOrchestrator.processUserMessage(session, userText);
                
                const ssmlResponse = enrichWithSSML(spokenResponse, displayData || {});
                const cleanSpokenResponseForTTS = ssmlResponse.replace(/<[^>]*>/g, '').trim();

                let audioContent = null;
                if (ttsStatus.healthy && cleanSpokenResponseForTTS) {
                    try {
                        audioContent = await ttsHandler.getXttsAudio(cleanSpokenResponseForTTS);
                    } catch (ttsError) {
                        console.error("[Worker] ❌ Konuşma sırasında TTS hatası:", ttsError.message);
                        await checkAndSetTtsHealth();
                        ws.send(JSON.stringify({
                            targetClientId: sourceClientId,
                            payload: { type: 'tts_status_update', payload: ttsStatus }
                        }));
                    }
                }
                
                const responsePacket = {
                    targetClientId: sourceClientId,
                    payload: {
                        type: 'ai_response',
                        payload: {
                            sessionId: session.sessionId,
                            spokenText: cleanSpokenResponseForTTS,
                            audio: audioContent,
                            audio_format: 'wav',
                            display: displayData
                        }
                    }
                };
                ws.send(JSON.stringify(responsePacket));

                if (resetSessionScenario) {
                    CallContextManager.resetScenarioContext(session.sessionId);
                }

            } catch (error) {
                console.error(`[Worker] ❌ [Session: ${sessionId}] İşleme sırasında kritik hata:`, error);
                const errorResponse = "Çok üzgünüm, sistemde beklenmedik bir hata oluştu.";
                // Hata durumunda bile UI'a bir yanıt göndererek kilitlenmesini önle
                if(sourceClientId) {
                    ws.send(JSON.stringify({
                        targetClientId: sourceClientId,
                        payload: { type: 'ai_response', payload: { spokenText: errorResponse, audio: null, display: { type: 'error', message: errorResponse } } }
                    }));
                }
                if (CallContextManager.getContext(sessionId)) CallContextManager.resetScenarioContext(sessionId);
            }
        });

        ws.on('close', () => {
            console.log("[Worker] Gateway bağlantısı kapandı.");
        });
    });
})();