// src/dialog_flow/dialog_orchestrator.js
const aiHandler = require('../core/ai-handler');
const CallContextManager = require('../managers/call_context_manager'); // Kullanılmıyor ama import'u kalsın şimdilik
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request');
const knowledgeBase = require('../../data/knowledge_base.json');
const dbHandler = require('../core/db-handler');

const scenarios = { 
    'otel_rezervasyonu': hotelScenario,
    'information_request': informationRequestScenario 
};

// Yardımcı Doğrulama Fonksiyonu (değişmedi)
function validateExtractedValue(paramName, value) {
    if (value === null || value === undefined || (typeof value === 'string' && String(value).trim() === '')) {
        return false;
    }

    const stringValue = String(value).toLowerCase();

    switch (paramName) {
        case 'location':
            const words = stringValue.split(' ').filter(w => w.length > 0);
            if (words.length > 3 || stringValue.length < 2) { 
                console.warn(`[DialogOrchestrator - Validation] ⚠️ Konum değeri şüpheli (çok uzun/kısa): '${value}'`);
                return false;
            }
            return true;
        case 'people_count':
            const numPeople = parseInt(stringValue, 10); 
            if (isNaN(numPeople) || numPeople <= 0 || numPeople > 99) { 
                console.warn(`[DialogOrchestrator - Validation] ⚠️ Kişi sayısı geçersiz: '${value}'`);
                return false;
            }
            return true;
        case 'budget':
            const numBudget = parseInt(stringValue.replace(/[^0-9]/g, ''), 10); 
            if (isNaN(numBudget) || numBudget <= 0) {
                console.warn(`[DialogOrchestrator - Validation] ⚠️ Bütçe geçersiz: '${value}'`);
                return false;
            }
            return true;
        case 'checkin_date':
            if (stringValue.length < 5) { 
                console.warn(`[DialogOrchestrator - Validation] ⚠️ Tarih değeri şüpheli: '${value}'`);
                return false;
            }
            return true;
        default:
            return true; 
    }
}

class DialogOrchestrator {
    constructor() {
        console.log("[DialogOrchestrator] ✅ Dialog Orchestrator başlatıldı.");
    }

    async processUserMessage(session, userText) {
        let spokenResponse;
        let displayData;
        let resetSessionScenario = false; // BAYRAK ADI DEĞİŞTİ: Oturumu tamamen silmek yerine senaryo bağlamını sıfırla

        const initialTrigger = !session.scenarioId; 

        // Not: Bu kısım, DialogOrchestrator'ın içindeki senaryo belirleme mantığı,
        // daha sonra CallContextManager'dan gelecek olan session objesindeki
        // senaryoId'yi kullanarak güncellenecek.
        // Şimdilik, sadece mevcut oturumun scenarioId'sine göre çalışacak.
        
        if (initialTrigger) { 
            if (informationRequestScenario.trigger_keywords.some(keyword => userText.toLowerCase().includes(keyword))) {
                session.scenarioId = informationRequestScenario.id;
                console.log(`[DialogOrchestrator] Senaryo bulundu: ${session.scenarioId} (Bilgi Talebi)`);
            } else {
                for (const scenario of Object.values(scenarios)) {
                    if (scenario.id !== 'information_request' && scenario.trigger_keywords.some(keyword => userText.toLowerCase().includes(keyword))) {
                        session.scenarioId = scenario.id;
                        console.log(`[DialogOrchestrator] Senaryo bulundu: ${session.scenarioId}`);
                        break;
                    }
                }
            }
        }
        
        const currentScenario = scenarios[session.scenarioId];

        if (currentScenario) {
            if (currentScenario.id === 'information_request') {
                spokenResponse = await aiHandler.answerQuestionWithContext(userText, knowledgeBase);
                displayData = { type: 'info_request', text: `💬 ${spokenResponse}` };
                resetSessionScenario = true; // Bilgi talebi bitince senaryo bağlamını sıfırla
            } else {
                const missingParams = currentScenario.required_params.filter(p => !session.params[p.name]);
                let anyParamExtractedSuccessfully = false;

                if (missingParams.length > 0) {
                    const extractedValues = await aiHandler.extractMultipleParameters(userText, missingParams);
                    
                    for (const paramDef of missingParams) {
                        const extractedValue = extractedValues[paramDef.name]; 
                        if (extractedValue && validateExtractedValue(paramDef.name, extractedValue)) {
                            session.params[paramDef.name] = extractedValue;
                            console.log(`[DialogOrchestrator] Bilgi çıkarıldı: {${paramDef.name}: "${extractedValue}"}`);
                            anyParamExtractedSuccessfully = true;
                        } else if (extractedValue === null) { 
                            console.log(`[DialogOrchestrator] ℹ️ LLM '${paramDef.name}' için null döndürdü.`);
                        } else if (extractedValue !== undefined) { 
                            console.warn(`[DialogOrchestrator] ⚠️ Parametre '${paramDef.name}' için çıkarılan değer geçersiz: '${extractedValue}'`);
                        }
                    }

                    if (!anyParamExtractedSuccessfully && !initialTrigger) {
                        session.misunderstandingCount++;
                        console.warn(`[DialogOrchestrator] ⚠️ Hiçbir beklenen parametre çıkarılamadı veya geçersiz. Anlayamama sayısı: ${session.misunderstandingCount}`);
                    } else if (!anyParamExtractedSuccessfully && initialTrigger) {
                        console.log(`[DialogOrchestrator] ℹ️ İlk tetikleyici mesajdan herhangi bir beklenen parametre çıkarılamadı.`);
                    } else { 
                        session.misunderstandingCount = 0;
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
                        resetSessionScenario = true; // Görev bitince senaryo bağlamını sıfırla
                    }
                }
            }
        } else {
            spokenResponse = "Size nasıl yardımcı olabilirim? Örneğin, 'otel rezervasyonu yapmak istiyorum' veya 'çalışma saatleriniz nedir?' diyebilirsiniz."; 
            displayData = { type: 'info_request', text: spokenResponse };
            session.lastQuestionParam = null;
        }

        return { spokenResponse, displayData, resetSessionScenario }; // Bayrak adı güncellendi
    }
}

module.exports = new DialogOrchestrator();