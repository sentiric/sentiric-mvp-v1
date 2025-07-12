// src/core/llm-adapters/ollama-adapter.js

const fetch = require('node-fetch');
const config = require('../../config');

async function generateText(prompt) {
    const ollamaUrl = `http://${config.ollamaHost}:${config.ollamaPort}/api/generate`;
    try {
        console.log(`[OllamaAdapter] İstek gönderiliyor: Model: ${config.ollamaModelName}, Host: ${config.ollamaHost}, Port: ${config.ollamaPort}`); // YENİ LOG
        const response = await fetch(ollamaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.ollamaModelName,
                prompt: prompt,
                stream: false, 
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API'den hata kodu ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        console.error("[OllamaAdapter] ❌ Metin üretimi sırasında hata:", error.message);
        console.error("[OllamaAdapter] ℹ️ Ollama sunucusunun çalıştığından ve belirtilen modelin (`ollama pull YOUR_MODEL_NAME`) yüklü olduğundan emin olun."); // Hata mesajı düzeltildi
        throw error;
    }
}

module.exports = {
    generateText,
};