// src/managers/call_context_manager.js
const { v4: uuidv4 } = require('uuid');

const activeCallContexts = {};

class CallContextManager {
    constructor() {
        console.log("[CallContextManager] ✅ Call Context Manager başlatıldı.");
    }

    getOrCreateContext(sessionId, clientId) {
        if (!activeCallContexts[sessionId]) {
            activeCallContexts[sessionId] = {
                sessionId: sessionId,
                clientId: clientId,
                scenarioId: null, // Senaryo ID'si artık her görev sonrası sıfırlanabilir
                params: {}, // Parametreler her görev sonrası sıfırlanabilir
                misunderstandingCount: 0,
                
                call_sid: sessionId, 
                trace_id: uuidv4(), 
                tenant_id: 'mvp_tenant', 
                caller_id: 'anonymous_user', 
                task_stack: [], 
                interaction_history: [], 
                call_start_time: new Date(),
                last_interaction_time: new Date(),
            };
            console.log(`[CallContextManager] Yeni çağrı bağlamı oluşturuldu: ${sessionId}`);
        } else {
            // Mevcut bağlamın etkileşim zamanını güncelleyelim
            activeCallContexts[sessionId].last_interaction_time = new Date();
        }
        return activeCallContexts[sessionId];
    }

    getContext(sessionId) {
        return activeCallContexts[sessionId];
    }

    updateContext(sessionId, newContextData) {
        if (activeCallContexts[sessionId]) {
            Object.assign(activeCallContexts[sessionId], newContextData);
            activeCallContexts[sessionId].last_interaction_time = new Date();
        } else {
            console.warn(`[CallContextManager] Güncellenmek istenen bağlam bulunamadı: ${sessionId}`);
        }
    }

    deleteContext(sessionId) {
        if (activeCallContexts[sessionId]) {
            delete activeCallContexts[sessionId];
            console.log(`[CallContextManager] Çağrı bağlamı tamamen silindi: ${sessionId}`);
        }
    }

    // YENİ: Oturumun görevle ilgili verilerini sıfırlayan fonksiyon
    resetScenarioContext(sessionId) {
        if (activeCallContexts[sessionId]) {
            activeCallContexts[sessionId].scenarioId = null;
            activeCallContexts[sessionId].params = {};
            activeCallContexts[sessionId].misunderstandingCount = 0;
            // Diyalog geçmişini koruyabiliriz veya isteğe bağlı olarak temizleyebiliriz
            // activeCallContexts[sessionId].interaction_history = []; 
            console.log(`[CallContextManager] Oturum senaryo bağlamı sıfırlandı: ${sessionId}`);
        }
    }

    cleanupOldContexts(timeoutMinutes = 10) {
        const now = new Date().getTime(); // getTime() kullanarak sayısal değer al
        for (const sessionId in activeCallContexts) {
            // last_interaction_time bir Date objesi, bu yüzden getTime() kullanıyoruz
            if (activeCallContexts[sessionId].last_interaction_time.getTime() < now - (timeoutMinutes * 60 * 1000)) {
                this.deleteContext(sessionId);
                console.log(`[CallContextManager] Eski oturum temizlendi: ${sessionId}`);
            }
        }
    }
}

module.exports = new CallContextManager();