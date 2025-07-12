// public/script.js (Gelişmiş ve Akıcı Hali)

document.addEventListener('DOMContentLoaded', () => {
    // Tarayıcı uyumluluk kontrolü
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor. Lütfen Chrome veya Edge tarayıcı kullanın.</h1>';
        return;
    }

    // UI elemanlarını seçme
    const recognition = new SpeechRecognition();
    const toggleButton = document.getElementById('toggleButton');
    const resetButton = document.getElementById('resetButton');
    const chatBox = document.getElementById('chatBox');
    const durumMesaji = document.getElementById('durum');
    const ttsStatusMesaji = document.getElementById('ttsStatus');
    const sessionInfoDiv = document.getElementById('sessionInfo');
    
    // Gerekli elemanlar yoksa kritik hata ver
    if (!toggleButton || !resetButton || !chatBox || !durumMesaji || !ttsStatusMesaji || !sessionInfoDiv) {
        document.body.innerHTML = '<h1>UI elemanları bulunamadı! Lütfen index.html dosyasını kontrol edin.</h1>';
        return;
    }

    // Oturum ve durum değişkenleri
    let isListening = false;
    let sessionId = `session_${Date.now()}`;
    let audioQueue = [];
    let isPlaying = false;
    let currentSessionParams = {};
    let currentScenarioId = null;

    // --- WebSocket Bağlantısı ---
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Gateway sunucusuna WebSocket ile bağlandı.');
        updateStatus('hazir', 'Hazır');
    };
    ws.onclose = () => updateStatus('hata', 'Bağlantı kesildi.');
    ws.onerror = () => updateStatus('hata', 'Bağlantı hatası.');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'ai_response':
                handleAiResponse(data.payload);
                break;
            case 'tts_status_update':
                updateTtsStatus(data.payload.healthy, data.payload.message);
                break;
            case 'error':
                addMessage(`<p>${data.payload.message}</p>`, 'error-card');
                updateStatus('hata', 'Bir hata oluştu.');
                break;
        }
    };

    // --- Mesaj ve Durum Güncelleme Fonksiyonları ---
    const addMessage = (content, type) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = content; // marked.parse(content) Markdown için
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const updateStatus = (status, text) => {
        durumMesaji.className = `durum-${status}`;
        durumMesaji.textContent = text;
    };

    const updateTtsStatus = (isHealthy, message) => {
        ttsStatusMesaji.className = `tts-status tts-status-${isHealthy ? 'healthy' : 'unhealthy'}`;
        ttsStatusMesaji.textContent = `TTS Durumu: ${message}`;
    };
    
    const updateSessionInfo = () => {
        let paramsHtml = Object.keys(currentSessionParams).length > 0
            ? Object.entries(currentSessionParams).map(([key, value]) => `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`).join('')
            : '<li>Henüz bir parametre toplanmadı.</li>';

        sessionInfoDiv.innerHTML = `
            <h4>Aktif Oturum Bilgisi</h4>
            <p><strong>Oturum ID:</strong> ${sessionId}</p>
            <p><strong>Aktif Senaryo:</strong> ${currentScenarioId || 'Yok'}</p>
            <h5>Toplanan Parametreler:</h5>
            <ul>${paramsHtml}</ul>
        `;
        updateSessionInfo(); // İlk açılışta da çalıştır
    };


    // --- AI Yanıtını ve Ses Kuyruğunu Yönetme ---
    function handleAiResponse(payload) {
        console.log("AI Yanıtı Alındı:", payload);

        // Oturum bilgilerini güncelle
        if (payload.display && payload.display.type === 'confirmation_card') {
            currentSessionParams = payload.display.data.params || {};
            currentScenarioId = payload.display.data.type || null;
        } else {
            // Parametreler gelmeye devam ediyorsa, senaryo devam ediyor demektir
            currentScenarioId = 'otel_rezervasyonu'; 
        }
        updateSessionInfo();

        processVisualResponse(payload.display);

        if (payload.audio) {
            audioQueue.push({ audio: payload.audio, format: payload.audio_format || 'wav' });
            if (!isPlaying) playNextInQueue();
        } else {
            // Ses yoksa, dinlemeye geri dön
            if (isListening) {
                updateStatus('dinliyor', 'Sizi dinliyorum...');
                try { recognition.start(); } catch (e) { console.error("Recognition start error:", e); }
            } else {
                updateStatus('hazir', 'Hazır');
            }
        }
    }
    
    const playNextInQueue = () => {
        if (audioQueue.length === 0) {
            isPlaying = false;
            // Konuşma bittikten sonra tekrar dinlemeye başla
            if (isListening) {
                updateStatus('dinliyor', 'Sizi dinliyorum...');
                try { recognition.start(); } catch (e) { console.error("Recognition restart error:", e); }
            } else {
                 updateStatus('hazir', 'Hazır');
            }
            return;
        }
        isPlaying = true;
        updateStatus('konusuyor', 'Yapay zeka konuşuyor...');
        const { audio, format } = audioQueue.shift();
        const audioBlob = new Audio(`data:audio/${format};base64,${audio}`);
        audioBlob.play();
        audioBlob.onended = playNextInQueue;
    };
    
    function processVisualResponse(display) {
        if (!display || !display.type) return;

        // ⭐️ Önceki AI cevabını arayüzden kaldırma (daha temiz bir görünüm için)
        const existingAiCard = chatBox.querySelector('.ai-card');
        if(existingAiCard && display.type !== 'confirmation_card') {
            // Sadece soru-cevap kartlarını kaldır, onay kartı kalsın
            existingAiCard.remove();
        }

        let cardHtml = '';
        if (display.type === 'confirmation_card') {
            const res = display.data;
            cardHtml = `<h3>✅ Rezervasyon Onaylandı!</h3><p><strong>Rezervasyon ID:</strong> ${res.id}</p><p><strong>Yer:</strong> ${res.params.location}</p><p><strong>Tarih:</strong> ${res.params.checkin_date}</p><p><strong>Kişi Sayısı:</strong> ${res.params.people_count}</p><img src="${res.imageUrl}" alt="Görsel">`;
        } else { // info_request ve error
             cardHtml = `<p>${display.text || display.message}</p>`;
        }
        addMessage(cardHtml, display.type === 'error' ? 'error-card' : 'ai-card');
    }

    // --- Konuşma Tanıma (Speech Recognition) Ayarları ---
    recognition.lang = 'tr-TR';
    recognition.continuous = false; // Her seferinde tek bir sonuç al
    recognition.interimResults = false;

    recognition.onstart = () => {
        console.log("SpeechRecognition başladı.");
        updateStatus('dinliyor', 'Sizi dinliyorum...');
    };
    
    // ⭐️ KULLANICI KONUŞUR KONUŞMAZ İŞLEM YAP ⭐️
    recognition.onresult = (event) => {
        const userTranscript = event.results[0][0].transcript.trim();
        console.log("SpeechRecognition sonuç:", userTranscript);
        addMessage(`<p>${userTranscript}</p>`, 'user-card'); // Anında UI'a ekle
        sendTranscriptToServer(userTranscript); // Sunucuya gönder
    };

    recognition.onend = () => {
        console.log("SpeechRecognition bitti.");
        // `onresult` tetiklenmediyse ve hala dinliyorsak, muhtemelen `no-speech` oldu.
        // `onerror` bu durumu zaten yönetecek.
        if (!isListening) {
            updateStatus('hazir', 'Sohbet durduruldu.');
        }
    };
    
    recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
            console.warn("SpeechRecognition: Konuşma algılanmadı.");
            // Kullanıcıya bir hata göstermek yerine, sessizce tekrar dinlemeye devam edebiliriz.
            if(isListening) {
                try { recognition.start(); } catch(e) {}
            }
            return; 
        }
        console.error("SpeechRecognition hatası:", event.error);
        addMessage(`<p>Ses tanıma sırasında bir hata oluştu: ${event.error}. Mikrofonunuzu kontrol edin.</p>`, 'error-card');
        stopListening();
    };

    const sendTranscriptToServer = (text) => {
        updateStatus('dusunuyor', 'Yapay zeka düşünüyor...');
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'user_transcript',
                payload: { sessionId, text }
            }));
        }
    };

    // --- Buton Kontrolleri ---
    function startListening() {
        if (isPlaying) return; // AI konuşurken başlatma
        isListening = true;
        toggleButton.textContent = 'Dinlemeyi Durdur';
        toggleButton.className = 'stop';
        try {
            recognition.start();
        } catch (e) {
            console.error("Recognition başlatılamadı:", e);
            addMessage('<p>Mikrofon erişimi reddedildi veya bir sorun oluştu. Tarayıcı izinlerini kontrol edin.</p>', 'error-card');
            stopListening();
        }
    }

    function stopListening() {
        isListening = false;
        recognition.stop();
        toggleButton.textContent = 'Dinlemeyi Başlat';
        toggleButton.className = 'start';
    }

    toggleButton.addEventListener('click', () => {
        isListening ? stopListening() : startListening();
    });

    resetButton.addEventListener('click', () => {
        stopListening();
        audioQueue = [];
        isPlaying = false;

        sessionId = `session_${Date.now()}`;
        currentSessionParams = {};
        currentScenarioId = null;
        updateSessionInfo();
        
        chatBox.innerHTML = '';
        addMessage('<p>Oturum sıfırlandı. Yeni bir konuşma başlatabilirsiniz.</p>', 'system-card');
        updateStatus('hazir', 'Hazır');
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reset_session', payload: { sessionId } }));
        }
    });
});