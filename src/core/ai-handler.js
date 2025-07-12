// src/core/ai-handler.js (YENİ VE SADELEŞMİŞ HALİ)

const config = require('../config');
const fetch = require('node-fetch');

// LLM Adaptörünü seç
const llmAdapter = config.useLocalLLM 
    ? require('./llm-adapters/ollama-adapter') 
    : require('./llm-adapters/gemini-adapter');

// RAG fonksiyonu (Bilgi bankası için) - Değişmedi
async function answerQuestionWithContext(userQuestion, knowledgeBase) {
    const prompt = `Aşağıdaki bilgilerden yola çıkarak kullanıcının "${userQuestion}" sorusuna kısa ve net bir cevap ver. Bilgilerde cevap yoksa 'Üzgünüm, bu konuda bilgiye sahip değilim.' de. Ekstra konuşma yapma. Bilgiler: ${JSON.stringify(knowledgeBase)}`;
    const llmResponse = await llmAdapter.generateContent(prompt);
    // Ollama'nın chat formatına göre response'u al
    return llmResponse.content.trim();
}

// Görsel bulma fonksiyonu - Değişmedi
async function getImageUrl(query) { /* ... mevcut kod ... */ }

// ANA FONKSİYON: Artık tek bir yerden AI ile konuşuyoruz.
async function getAiAction(userText, availableTools) {
    console.log(`[AI Handler] AI eylemi alınıyor. Araçlar: ${availableTools.map(t => t.name).join(', ')}`);
    const llmResponse = await llmAdapter.generateContent(userText, availableTools);

    console.log("[AI Handler] LLM Ham Yanıtı:", JSON.stringify(llmResponse, null, 2));

    // ⭐️ YENİ: LLM'in cevabını yorumlama ⭐️
    // Ollama, araç kullanımını 'tool_calls' dizisi içinde döndürür.
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        // Şimdilik sadece ilk aracı işleyelim
        const toolCall = llmResponse.tool_calls[0].function;
        console.log(`[AI Handler] ✅ Fonksiyon Çağrısı Algılandı: ${toolCall.name}`);
        return {
            type: 'function_call',
            name: toolCall.name,
            arguments: toolCall.arguments, // Argümanlar zaten parse edilmiş JSON objesi olarak gelir
        };
    } else {
        // Eğer fonksiyon çağrısı yoksa, bu bir metin cevabıdır (genellikle ek bilgi istemek için)
        console.log("[AI Handler] 💬 Metin Yanıtı Algılandı.");
        return {
            type: 'text_response',
            content: llmResponse.content,
        };
    }
}

module.exports = {
    answerQuestionWithContext,
    getImageUrl,
    getAiAction,
};