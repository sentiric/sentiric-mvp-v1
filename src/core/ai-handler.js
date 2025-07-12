// src/core/ai-handler.js (LLM Orkestratörü ve Ortak AI Fonksiyonları)

const fetch = require('node-fetch');
const config = require('../config');

let llmAdapter;
if (config.useLocalLLM) {
    llmAdapter = require('./llm-adapters/ollama-adapter');
    console.log("[AI Handler] LLM olarak Yerel Ollama Adaptörü kullanılıyor.");
} else {
    llmAdapter = require('./llm-adapters/gemini-adapter');
    console.log("[AI Handler] LLM olarak Google Gemini Adaptörü kullanılıyor.");
}

async function generateText(prompt) {
    return llmAdapter.generateText(prompt);
}

async function extractParameters(text, question) {
    // extractParameters, seçilen LLM adaptörünü kullanır
    const prompt = `Kullanıcının şu cevabından: "${text}", sorulan şu soruya karşılık gelen değeri çıkar: "${question}". Sadece değeri JSON formatında ver. Örnek: {"value": "Antalya"}`;
    try {
        const responseText = await generateText(prompt); // Dahili generateText'i kullan
        const extracted = JSON.parse(responseText.match(/{.*}/s)[0]);
        return extracted.value || null;
    } catch (error) {
        console.error("[AI Handler] ❌ Bilgi çıkarımı sırasında hata:", error.message);
        return null;
    }
}

async function getImageUrl(query) {
    if (!config.pexelsApiKey) {
        console.warn("[AI Handler] Pexels API Anahtarı tanımlı değil. Rastgele Unsplash görseli kullanılacak.");
        return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    }
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { 'Authorization': config.pexelsApiKey }
        });
        if (!response.ok) throw new Error(`Pexels API'den hata: ${response.statusText}`);
        const data = await response.json();
        return data.photos?.[0]?.src.medium || `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    } catch (error) {
        console.error("[AI Handler] Pexels API hatası:", error.message);
        return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    }
}

module.exports = { 
    generateText, // Artık doğrudan generateText'i dışarıya açıyoruz
    extractParameters, 
    getImageUrl 
};