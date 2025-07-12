// src/core/llm-adapters/gemini-adapter.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config'); // config'i doğru yoldan çağır

// Eğer config.geminiApiKey tanımlı değilse, bu adaptörü yüklemeyeceğiz veya uyarı vereceğiz.
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: config.geminiModelName }) : null;

async function generateText(prompt) {
    if (!model) {
        console.error("[GeminiAdapter] ❌ Gemini API Anahtarı tanımlı değil veya model yüklenemedi.");
        throw new Error("Gemini API Anahtarı tanımlı değil.");
    }
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return responseText;
    } catch (error) {
        console.error("[GeminiAdapter] ❌ Metin üretimi sırasında hata:", error.message);
        throw error;
    }
}

module.exports = {
    generateText,
};