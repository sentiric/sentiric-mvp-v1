// public/script.js (Dayanıklı ve Senkronize Hali)

document.addEventListener('DOMContentLoaded', () => {
    // Tarayıcı uyumluluk kontrolü
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor. Lütfen Chrome veya Edge tarayıcı kullanın.</h1>';
        return;
    }

    // --- UI Elemanları ---
    const recognition = new SpeechRecognition();
    const toggleButton = document.getElementById('toggleButton');
    const resetButton = document.getElementById('resetButton');
    const chatBox = document.getElementById('chatBox');
    const durumMesaji = document.getElementById('durum');
    const ttsStatusMesaji = document.getElementById('ttsStatus');
    const sessionInfoDiv = document.getElementById('sessionInfo');

    if (!toggleButton || !resetButton || !chatBox || !durumMesaji || !ttsStatusMesaji || !sessionInfoDiv) {
        document.body.innerHTML = '<h1>UI elemanları bulunamadı! Lütfen index.html dosyasını kontrol edin.</h1>';
        return;
    }

    // --- Durum ve Oturum Değişkenleri ---
    let isListening = false;
    let sessionId = `session_${Date.now()}`;
    let audioQueue = [];
    let isPlaying = false;
    let currentSessionParams = {};
    let currentScenarioId = null;

    // --- WebSocket Bağlantısı ve Mantığı ---
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let ws;

    function connect() {
        ws = new WebSocket(wsUrl);
        updateStatus('bekleniyor', 'Sunucuya bağlanılıyor...');

        ws.onopen = () => {
            console.log('✅ Gateway sunucusuna WebSocket ile bağlandı.');
            updateStatus('hazir', 'Hazır');
            // Bağlantı kurulunca ilk oturum bilgilerini gönderelim.
            ws.send(JSON.stringify({ type: 'session_init', payload: { sessionId } }));
        };

        ws.onclose = () => {
            console.error('❌ Gateway bağlantısı koptu. 3 saniye içinde yeniden denenecek...');
            updateStatus('hata', 'Bağlantı kesildi. Yeniden deneniyor...');
            setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket hatası:', err);
            ws.close(); // Hata durumunda bağlantıyı kapatıp yeniden bağlanmayı tetikle
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'ai_response': handleAiResponse(data.payload); break;
                case 'tts_status_update': updateTtsStatus(data.payload.healthy, data.payload.message); break;
                case 'error':
                    addMessage(`<p>${data.payload.message}</p>`, 'error-card');
                    updateStatus('hata', 'Sunucu hatası.');
                    break;
            }
        };
    }
    connect(); // İlk bağlantıyı başlat

    // --- Mesaj, Durum ve Oturum Güncelleme Fonksiyonları ---
    const addMessage = (content, type) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = content;
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
    
    // ⭐️ KRİTİK DÜZELTME: Bu fonksiyon artık kendisini çağırmıyor! ⭐️
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
    };
    updateSessionInfo(); // Sayfa yüklendiğinde ilk haliyle göster


    // --- AI Yanıtını ve Ses Kuyruğunu Yönetme ---
    function handleAiResponse(payload) {
        console.log("AI Yanıtı Alındı:", payload);

        // Oturum bilgilerini güncelle
        if (payload.display && payload.display.type === 'confirmation_card') {
            currentSessionParams = payload.display.data.params || {};
            currentScenarioId = payload.display.data.type || null;
        } else {
            currentScenarioId = 'otel_rezervasyonu'; 
        }
        updateSessionInfo(); // Bilgileri güncelledikten sonra UI'ı tazele

        processVisualResponse(payload.display);

        if (payload.audio) {
            audioQueue.push({ audio: payload.audio, format: payload.audio_format || 'wav' });
            if (!isPlaying) playNextInQueue();
        } else {
            if (isListening) {
                try { recognition.start(); } catch (e) {}
            }
        }
    }

    const playNextInQueue = () => {
        if (audioQueue.length === 0) {
            isPlaying = false;
            if (isListening) {
                updateStatus('dinliyor', 'Sizi dinliyorum...');
                try { recognition.start(); } catch (e) {}
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
        const existingAiCard = chatBox.querySelector('.ai-card');
        if (existingAiCard && display.type !== 'confirmation_card') {
            existingAiCard.remove();
        }
        let cardHtml = (display.type === 'confirmation_card')
            ? `<h3>✅ Rezervasyon Onaylandı!</h3><p><strong>Rezervasyon ID:</strong> ${display.data.id}</p><p><strong>Yer:</strong> ${display.data.params.location}</p><p><strong>Tarih:</strong> ${display.data.params.checkin_date}</p><p><strong>Kişi Sayısı:</strong> ${display.data.params.people_count}</p><img src="${display.data.imageUrl}" alt="Görsel">`
            : `<p>${display.text || display.message}</p>`;
        addMessage(cardHtml, display.type === 'error' ? 'error-card' : 'ai-card');
    }

    // --- Konuşma Tanıma (Speech Recognition) Ayarları ---
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        updateStatus('dinliyor', 'Sizi dinliyorum...');
    };
    
    recognition.onresult = (event) => {
        const userTranscript = event.results[0][0].transcript.trim();
        addMessage(`<p>${userTranscript}</p>`, 'user-card');
        sendTranscriptToServer(userTranscript);
    };

    recognition.onend = () => {
        if (!isListening) updateStatus('hazir', 'Sohbet durduruldu.');
    };
    
    recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
            if (isListening) try { recognition.start(); } catch(e) {}
            return; 
        }
        console.error("SpeechRecognition hatası:", event.error);
        addMessage(`<p>Ses tanıma hatası: ${event.error}. Mikrofonu kontrol edin.</p>`, 'error-card');
        stopListening();
    };

    const sendTranscriptToServer = (text) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            updateStatus('dusunuyor', 'Yapay zeka düşünüyor...');
            ws.send(JSON.stringify({ type: 'user_transcript', payload: { sessionId, text } }));
        } else {
            updateStatus('hata', 'Sunucu bağlantısı yok.');
        }
    };

    // --- Buton Kontrolleri ---
    function startListening() {
        if (isPlaying || (ws && ws.readyState !== WebSocket.OPEN)) return;
        isListening = true;
        toggleButton.textContent = 'Dinlemeyi Durdur';
        toggleButton.className = 'stop';
        try { recognition.start(); } catch (e) { stopListening(); }
    }

    function stopListening() {
        isListening = false;
        try { recognition.stop(); } catch(e) {}
        toggleButton.textContent = 'Dinlemeyi Başlat';
        toggleButton.className = 'start';
    }

    toggleButton.addEventListener('click', () => isListening ? stopListening() : startListening());
    resetButton.addEventListener('click', () => {
        stopListening();
        audioQueue = [];
        isPlaying = false;
        sessionId = `session_${Date.now()}`;
        currentSessionParams = {};
        currentScenarioId = null;
        updateSessionInfo();
        chatBox.innerHTML = '<div class="message system-card"><p>Oturum sıfırlandı. Yeni bir konuşma başlatabilirsiniz.</p></div>';
        updateStatus('hazir', 'Hazır');
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reset_session', payload: { sessionId } }));
        }
    });
});