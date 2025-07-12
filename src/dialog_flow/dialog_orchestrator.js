// src/dialog_flow/dialog_orchestrator.js (YENİ VE AKILLI HALİ)

const aiHandler = require('../core/ai-handler');
const dbHandler = require('../core/db-handler');
const knowledgeBase = require('../../data/knowledge_base.json');
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request');

class DialogOrchestrator {
    constructor() {
        console.log("[DialogOrchestrator] ✅ Function-Calling tabanlı Dialog Orchestrator başlatıldı.");
    }

    async processUserMessage(session, userText) {
        let spokenResponse;
        let displayData;
        let resetSessionScenario = false;

        // 1. Niyet Belirleme: Kullanıcı ne istiyor? Bilgi mi, işlem mi?
        // Bu basit belirlemeyi hala yapabiliriz.
        const isInfoRequest = informationRequestScenario.trigger_keywords.some(k => userText.toLowerCase().includes(k));

        if (isInfoRequest) {
            // RAG senaryosu
            spokenResponse = await aiHandler.answerQuestionWithContext(userText, knowledgeBase);
            displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
            resetSessionScenario = true;
        } else {
            // İşlem Senaryosu (Otel Rezervasyonu)
            // LLM'e kullanabileceği araçları sun
            const availableTools = [ hotelScenario.tool_definition ];
            
            // AI'dan bir eylem talep et
            const action = await aiHandler.getAiAction(userText, availableTools);

            if (action.type === 'function_call' && action.name === 'otel_rezervasyonu_yap') {
                // LLM, rezervasyon yapmak için yeterli bilgiye sahip olduğuna karar verdi!
                console.log("[DialogOrchestrator] Eylem yürütülüyor: otel_rezervasyonu_yap");
                const reservationParams = action.arguments;
                
                // Veritabanına kaydet ve görsel bul
                const reservationData = { type: hotelScenario.id, params: reservationParams, status: 'confirmed' };
                const imageUrl = await aiHandler.getImageUrl(reservationParams.location);
                reservationData.imageUrl = imageUrl;
                const newReservation = await dbHandler.saveReservation(reservationData);
                
                // Kullanıcıya onay mesajı
                spokenResponse = `Harika! Rezervasyonunuzu oluşturdum. ${reservationParams.location} şehrinde, ${reservationParams.checkin_date} tarihinde, ${reservationParams.people_count} kişi için yeriniz ayrıldı. Onay detayları ekranda gösteriliyor.`;
                displayData = { type: 'confirmation_card', data: newReservation };
                resetSessionScenario = true;

            } else if (action.type === 'text_response') {
                // LLM, fonksiyonu çağıramadı, çünkü bilgi eksik. Bu yüzden kullanıcıya soru soruyor.
                spokenResponse = action.content;
                displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
            } else {
                // Beklenmedik bir durum
                spokenResponse = "Üzgünüm, şu anda ne yapacağımdan emin değilim. Lütfen tekrar dener misiniz?";
                displayData = { type: 'error', message: spokenResponse };
            }
        }

        return { spokenResponse, displayData, resetSessionScenario };
    }
}

module.exports = new DialogOrchestrator();