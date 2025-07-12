// src/core/llm-adapters/ollama-adapter.js

const fetch = require('node-fetch');
const config = require('../../config');

// Fonksiyonun adını daha genel hale getiriyoruz.
async function generateContent(prompt, tools = []) {
    const ollamaUrl = `http://${config.ollamaHost}:${config.ollamaPort}/api/chat`; // Chat endpoint'ini kullanmak daha iyi sonuç verir
    
    // Ollama'nın beklediği mesaj formatını oluştur
    const messages = [{ role: 'user', content: prompt }];
    
    const body = {
        model: config.ollamaModelName,
        messages: messages,
        stream: false,
    };

    // ⭐️ YENİ: Eğer 'tools' varsa, isteğe ekle ⭐️
    if (tools && tools.length > 0) {
        body.tools = tools;
        // Not: Ollama'ya modelin bu araçları kullanması için ek bir talimat vermek faydalı olabilir.
        // Bu, sistem prompt'u ile daha da geliştirilebilir.
    }

    try {
        console.log(`[OllamaAdapter] Chat isteği gönderiliyor. Model: ${config.ollamaModelName}`);
        const response = await fetch(ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API'den hata kodu ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        // Ollama chat cevabı 'message' objesi içinde gelir
        return data.message; 
    } catch (error) {
        console.error("[OllamaAdapter] ❌ Metin üretimi sırasında hata:", error.message);
        console.error("[OllamaAdapter] ℹ️ Ollama sunucusunun çalıştığından ve modelin (`" + config.ollamaModelName + "`) yüklü olduğundan emin olun.");
        throw error;
    }
}

module.exports = {
    generateContent, // Dışa aktarılan fonksiyonun adını güncelledik
};