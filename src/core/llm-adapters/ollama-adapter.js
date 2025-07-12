// src/core/llm-adapters/ollama-adapter.js

const fetch = require('node-fetch');
const config = require('../../config');

async function generateText(prompt) {
    const ollamaUrl = `http://${config.ollamaHost}:${config.ollamaPort}/api/generate`;
    
    const body = {
        model: config.ollamaModelName,
        prompt: prompt,
        stream: false,
        format: "json" // ⭐️ OLLAMA'DAN KESİNLİKLE JSON ÇIKTISI İSTİYORUZ. BU ÇOK KRİTİK.
    };

    try {
        console.log(`[OllamaAdapter] Generate (JSON format) isteği gönderiliyor. Model: ${config.ollamaModelName}`);
        const response = await fetch(ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[OllamaAdapter] ❌ Ollama API'den gelen ham hata yanıtı:", errorText);
            throw new Error(`Ollama API'den hata kodu ${response.status}`);
        }

        const data = await response.json();
        
        // Gelen yanıtın stringified bir JSON olduğunu varsayıp parse ediyoruz.
        console.log("[OllamaAdapter] LLM'den gelen Ham Yanıt (Stringified JSON):", data.response);
        return JSON.parse(data.response);

    } catch (error) {
        console.error("[OllamaAdapter] ❌ Metin üretimi sırasında hata:", error.message);
        // Hata durumunda, orkestratörün başa çıkabilmesi için null döndürelim.
        return null; 
    }
}

module.exports = {
    generateText,
};