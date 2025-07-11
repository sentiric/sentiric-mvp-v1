const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// Senaryolarımızı (Uzmanlarımızı) yüklüyoruz
const hotelScenario = require('./scenarios/hotel_booking.js');
const massageScenario = require('./scenarios/massage_salon.js');
const scenarios = {
    'otel_rezervasyonu': hotelScenario,
    'masaj_randevusu': massageScenario
};

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Bu global değişken oturumları basitçe saklamak için (MVP için yeterli)
// Gerçek bir uygulamada bunu bir veritabanında (Redis, MongoDB) tutmalısınız.
const userSessions = {};

app.post('/api/chat', async (req, res) => {
    try {
        const sessionId = req.body.sessionId || 'default_user';
        if (!userSessions[sessionId]) {
            userSessions[sessionId] = {
                history: [],
                activeScenario: null
            };
        }
        const session = userSessions[sessionId];
        const userMessage = req.body.message;

        session.history.push({ role: 'user', parts: [{ text: userMessage }] });

        let systemInstruction = "Sen genel amaçlı yardımsever bir asistansın.";
        let finalPrompt = userMessage;

        // 1. ADIM: Aktif bir senaryo yoksa, kullanıcının niyetini anla (ROUTER)
        if (!session.activeScenario) {
            const scenarioDescriptions = Object.keys(scenarios).map(key => 
                `- ${key}: ${scenarios[key].description}`
            ).join('\n');

            const routerModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const routerPrompt = `Kullanıcının şu mesajını analiz et: "${userMessage}". Bu mesajın niyeti aşağıdaki kategorilerden hangisine en uygun? Sadece kategori anahtarını JSON formatında dön. Örneğin: {"intent": "otel_rezervasyonu"}\n\nKategoriler:\n${scenarioDescriptions}\nEğer hiçbiri değilse {"intent": "none"} dön.`;
            
            const result = await routerModel.generateContent(routerPrompt);
            const responseText = result.response.text();
            
            try {
                const intentJsonMatch = responseText.match(/{.*}/s);
                if (intentJsonMatch) {
                    const intentJson = JSON.parse(intentJsonMatch[0]);
                    if (scenarios[intentJson.intent]) {
                        session.activeScenario = intentJson.intent;
                        console.log(`[Session: ${sessionId}] Niyet anlaşıldı. Aktif senaryo: ${session.activeScenario}`);
                    }
                }
            } catch (e) {
                console.log(`[Session: ${sessionId}] Niyet anlaşılamadı, genel modda devam ediliyor.`);
            }
        }

        // 2. ADIM: Aktif senaryoya göre doğru sistem talimatını ve bilgiyi kullan (EXPERT)
        if (session.activeScenario) {
            const scenario = scenarios[session.activeScenario];
            systemInstruction = scenario.systemInstruction;
            
            // RAG Mimarisi: Bilgi bankasını al ve prompt'u zenginleştir
            const context = scenario.knowledgeBase;
            finalPrompt = `
              BAĞLAM:
              ---
              ${context}
              ---
              Yukarıdaki BAĞLAM'ı kullanarak ve bir diyalog asistanı gibi davranarak kullanıcının şu isteğini ele al: "${userMessage}"
            `;
        }

        // 3. ADIM: Uzman model ile sohbeti gerçekleştir
        const chatModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstruction,
        });
        
        const chat = chatModel.startChat({ history: session.history.slice(0, -1) });
        const result = await chat.sendMessage(finalPrompt);
        const aiReply = result.response.text();

        session.history.push({ role: 'model', parts: [{ text: aiReply }] });

        res.json({ reply: aiReply });

    } catch (error) {
        console.error("Sohbet hatası:", error);
        res.status(500).json({ error: "Sohbet sırasında bir hata oluştu." });
    }
});

// Oturumu sıfırlamak için bir endpoint (test için kullanışlı)
app.post('/api/reset', (req, res) => {
    const sessionId = req.body.sessionId || 'default_user';
    if (userSessions[sessionId]) {
        delete userSessions[sessionId];
        console.log(`[Session: ${sessionId}] Oturum sıfırlandı.`);
        res.json({ message: 'Oturum sıfırlandı.' });
    } else {
        res.status(404).json({ message: 'Sıfırlanacak oturum bulunamadı.' });
    }
});


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Sentiric MVP sunucusu http://localhost:${port} adresinde çalışıyor.`);
    console.log("Senaryolar yüklendi:", Object.keys(scenarios).join(', '));
});