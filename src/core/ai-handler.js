// src/core/ai-handler.js (Yönlendirilmiş Düşünce Modeli)

const llmAdapter = require('./llm-adapters/ollama-adapter');
const hotelScenario = require('../scenarios/hotel_booking');
const informationRequestScenario = require('../scenarios/information_request'); // RAG için
const knowledgeBase = require('../../data/knowledge_base.json'); // RAG için
const fetch = require('node-fetch'); // getImageUrl için
const config = require('../config'); // getImageUrl için

// Bu fonksiyon tüm otel rezervasyon mantığını yönetecek.
async function getGuidedHotelAction(userText, currentParams) {

    // 1. Sistem Prompt'unu Oluştur: LLM'e rolünü ve kurallarını öğret.
    const systemPrompt = `
    Sen, Sentiric Çağrı Merkezi'nin AI asistanısın. Görevin, otel rezervasyonu yapmak için adım adım ilerlemektir.
    Cevabını SADECE ve SADECE aşağıda belirtilen JSON formatında ver. ASLA başka bir metin veya açıklama ekleme.

    Kullanabileceğin Araç:
    ${hotelScenario.tool_description}

    Uyman Gereken Katı Çıktı Formatı:
    ${JSON.stringify(hotelScenario.output_format, null, 2)}
    `;

    // 2. Kullanıcı İstemini Oluştur: Mevcut durumu ve görevi LLM'e bildir.
    const userPrompt = `
    Mevcut Konuşma Durumu:
    - Kullanıcının son söylediği cümle: "${userText}"
    - Şimdiye kadar topladığımız bilgiler: ${JSON.stringify(currentParams)}

    Senin Görevin:
    1. 'thought' alanına mevcut durumu ve bir sonraki adımını düşünerek yaz.
    2. Eğer 'otel_rezervasyonu_yap' aracı için GEREKLİ TÜM BİLGİLER (location, checkin_date, people_count) toplanmışsa, 'action' objesini doldur. 'tool_name' olarak "otel_rezervasyonu_yap" yaz ve 'parameters' altına TÜM toplanan bilgileri ekle. Bu durumda 'speak' alanını null olarak ayarla.
    3. Eğer BİR veya DAHA FAZLA ZORUNLU bilgi eksikse, 'action' objesini null olarak ayarla ve 'speak' alanına kullanıcıya sorman gereken bir sonraki EKSİK BİLGİ sorusunu kısa ve net bir şekilde yaz.
    `;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    console.log(`[AI Handler] Yönlendirilmiş Düşünce Prompt'u gönderiliyor...`);
    const llmResponse = await llmAdapter.generateText(fullPrompt);

    // Hata durumunda (null döndüğünde) orkestratörün anlayacağı bir formatta geri dön
    if (!llmResponse) {
        return { type: 'error', content: "Üzgünüm, yapay zeka modelinden bir yanıt alamadım. Lütfen tekrar deneyin." };
    }
    
    console.log("[AI Handler] LLM Yanıtı (JSON Objesi):", llmResponse);

    // 3. LLM'in JSON yanıtını yorumla ve eyleme dönüştür.
    if (llmResponse.action && llmResponse.action.tool_name === 'otel_rezervasyonu_yap') {
        return {
            type: 'function_call',
            name: llmResponse.action.tool_name,
            arguments: llmResponse.action.parameters,
        };
    } else if (llmResponse.speak) {
        return {
            type: 'text_response',
            content: llmResponse.speak,
            // Bir sonraki turda kullanmak üzere bu turda çıkarılan parametreleri de döndürelim.
            extractedParams: llmResponse.action ? llmResponse.action.parameters : {}
        };
    } else {
        console.error("[AI Handler] LLM'den beklenmeyen formatta yanıt alındı.", llmResponse);
        return {
            type: 'error',
            content: "Üzgünüm, bir karışıklık oldu. Lütfen tekrar dener misiniz?"
        };
    }
}

// RAG (Bilgi Bankası) fonksiyonu
async function answerQuestionWithContext(userQuestion) {
    const prompt = `Aşağıdaki JSON veritabanından faydalanarak kullanıcının sorusuna kısa ve net bir cevap ver: "${userQuestion}". Eğer cevap veritabanında yoksa, 'Üzgünüm, bu konuda bilgi sahibi değilim.' de. Cevabın dışına çıkma. Veritabanı: ${JSON.stringify(knowledgeBase)}`;
    // RAG için text-only bir LLM çağrısı daha uygun olabilir.
    const llmResponse = await llmAdapter.generateText(prompt.replace(/"/g, "'")); // Prompt'taki çift tırnakları tek tırnağa çevirelim.
    return llmResponse ? (llmResponse.speak || llmResponse.thought || "Anlayamadım.") : "Yapay zekadan yanıt alınamadı.";
}

// Görsel bulma fonksiyonu
async function getImageUrl(query) {
    if (!config.pexelsApiKey) return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, { headers: { 'Authorization': config.pexelsApiKey } });
        if (!response.ok) throw new Error(`Pexels API hatası`);
        const data = await response.json();
        return data.photos?.[0]?.src.medium || `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    } catch (error) {
        return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    }
}

module.exports = {
    getGuidedHotelAction,
    answerQuestionWithContext,
    getImageUrl
};