// src/core/ai-handler.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.googleApiKey);
const model = genAI.getGenerativeModel({ model: config.llmModelName });

async function extractParameters(text, question) {
    const prompt = `Kullanıcının şu cevabından: "${text}", sorulan şu soruya karşılık gelen değeri çıkar: "${question}". Sadece değeri JSON formatında ver. Örnek: {"value": "Antalya"}`;
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const extracted = JSON.parse(responseText.match(/{.*}/s)[0]);
        return extracted.value || null;
    } catch (error) {
        console.error("[AI] ❌ Bilgi çıkarımı sırasında hata:", error.message);
        return null;
    }
}

async function getImageUrl(query) {
    if (!config.pexelsApiKey) {
        return `https://source.unsplash.com/random/400x200/?${query}`;
    }
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { 'Authorization': config.pexelsApiKey }
        });
        if (!response.ok) throw new Error(`Pexels API'den hata: ${response.statusText}`);
        const data = await response.json();
        return data.photos?.[0]?.src.medium || `https://source.unsplash.com/random/400x200/?${query}`;
    } catch (error) {
        console.error("[AI] Pexels API hatası:", error.message);
        return `https://source.unsplash.com/random/400x200/?${query}`;
    }
}

module.exports = { extractParameters, getImageUrl };