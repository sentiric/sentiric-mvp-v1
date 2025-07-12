// src/dialog_flow/dialog_orchestrator.js

const aiHandler = require('../core/ai-handler');
const dbHandler = require('../core/db-handler');
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request');

class DialogOrchestrator {
    constructor() {
        console.log("[DialogOrchestrator] ✅ Yönlendirilmiş Düşünce tabanlı Orchestrator başlatıldı.");
    }

    async processUserMessage(session, userText) {
        let spokenResponse;
        let displayData;
        let resetSessionScenario = false;

        // Oturum parametrelerinin varlığından emin ol
        session.params = session.params || {};

        // 1. Niyet Belirleme: Kullanıcı bilgi mi istiyor, işlem mi?
        const isInfoRequest = informationRequestScenario.trigger_keywords.some(k => userText.toLowerCase().includes(k));
        const isHotelRequest = hotelScenario.trigger_keywords.some(k => userText.toLowerCase().includes(k));

        if (isInfoRequest && !isHotelRequest) {
            // Sadece bilgi talebi
            spokenResponse = await aiHandler.answerQuestionWithContext(userText);
            displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
            resetSessionScenario = true;

        } else {
            // Otel rezervasyon akışı (varsayılan)
            const action = await aiHandler.getGuidedHotelAction(userText, session.params);

            if (action.type === 'function_call' && action.name === 'otel_rezervasyonu_yap') {
                const reservationParams = action.arguments;
                const reservationData = { type: hotelScenario.id, params: reservationParams, status: 'confirmed' };
                const imageUrl = await aiHandler.getImageUrl(reservationParams.location);
                reservationData.imageUrl = imageUrl;
                const newReservation = await dbHandler.saveReservation(reservationData);
                
                spokenResponse = `Harika! Rezervasyonunuzu oluşturdum. ${reservationParams.location} için ${reservationParams.checkin_date} tarihinde, ${reservationParams.people_count} kişi için yeriniz ayrıldı.`;
                displayData = { type: 'confirmation_card', data: newReservation };
                resetSessionScenario = true;

            } else if (action.type === 'text_response') {
                spokenResponse = action.content;
                displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                
                // ⭐️ Oturum verisini güncelle: LLM'in bu turda çıkardığı yeni bilgileri kaydet.
                // Bu, bir sonraki turda AI'nın daha akıllı olmasını sağlar.
                if(action.extractedParams) {
                    for(const key in action.extractedParams) {
                        if(action.extractedParams[key] !== null && action.extractedParams[key] !== undefined) {
                            session.params[key] = action.extractedParams[key];
                        }
                    }
                }

            } else { // Hata durumu
                spokenResponse = action.content || "Üzgünüm, bir sorun oluştu ve isteğinizi işleyemedim.";
                displayData = { type: 'error', message: spokenResponse };
                resetSessionScenario = true;
            }
        }

        return { spokenResponse, displayData, resetSessionScenario };
    }
}

module.exports = new DialogOrchestrator();