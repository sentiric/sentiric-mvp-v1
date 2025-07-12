// script.js (Son Hata Düzeltme)

document.addEventListener('DOMContentLoaded', () => {

    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Ana kodu sadece SpeechRecognition API varsa çalıştır
    // Burada "return" kullanmıyoruz, çünkü bu bir IIFE (Immediately Invoked Function Expression) değil.
    // Eğer SpeechRecognition yoksa, body içeriğini değiştirecek else bloğumuz var.
    if (!window.SpeechRecognition) {
        document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor.</h1>';
        return; // Bu return, DOMContentLoaded callback'inden çıkış yapar
    }

    // Aksi takdirde, SpeechRecognition mevcutsa devam et
    const recognition = new SpeechRecognition();
    const toggleButton = document.getElementById('toggleButton');
    const resetButton = document.getElementById('resetButton');
    const chatBox = document.getElementById('chatBox');
    const durumMesaji = document.getElementById('durum');
    const ttsStatusMesaji = document.getElementById('ttsStatus'); 
    const sessionInfoDiv = document.getElementById('sessionInfo'); 

    // ELEMAN KONTROLÜ EKLENDİ: Hata almamak için elemanların varlığını kontrol edelim.
    if (!toggleButton || !resetButton || !chatBox || !durumMesaji || !ttsStatusMesaji || !sessionInfoDiv) {
        document.body.innerHTML = '<h1>UI elemanları bulunamadı! Lütfen index.html dosyasını kontrol edin.</h1>';
        console.error("Critical UI elements are missing. Please check index.html.");
        return; 
    }


    let isListening = false;
    let sessionId = `session_${Date.now()}`;
    let audioQueue = [];
    let isPlaying = false;
    let userSaidSomething = false;
    let currentSessionParams = {}; 
    let currentScenarioId = null; 

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

    const updateTtsStatus = (status, message) => {
        ttsStatusMesaji.className = `tts-status tts-status-${status ? 'healthy' : 'unhealthy'}`;
        ttsStatusMesaji.textContent = `TTS Durumu: ${message}`;
    };

    const updateSessionInfo = () => {
        let paramsHtml = Object.keys(currentSessionParams).length > 0
            ? Object.entries(currentSessionParams)
                .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
                .join('')
            : '<li>Henüz bir parametre toplanmadı.</li>';

        sessionInfoDiv.innerHTML = `
            <h4>Aktif Oturum Bilgisi</h4>
            <p><strong>Oturum ID:</strong> ${sessionId}</p>
            <p><strong>Aktif Senaryo:</strong> ${currentScenarioId || 'Yok'}</p>
            <h5>Toplanan Parametreler:</h5>
            <ul>${paramsHtml}</ul>
        `;
    };
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Gateway sunucusuna WebSocket ile bağlandı.');
        updateStatus('hazir', 'Hazır');
        updateSessionInfo(); 
    };
    ws.onclose = () => updateStatus('hata', 'Bağlantı kesildi.');
    ws.onerror = () => updateStatus('hata', 'Bağlantı hatası.');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_response') {
            console.log("AI Spoken Text:", data.payload.spokenText);

            if (data.payload.display && data.payload.display.type === 'confirmation_card') {
                currentSessionParams = data.payload.display.data.params || {};
                currentScenarioId = data.payload.display.data.type || null; 
                updateSessionInfo();
            } else if (data.payload.display && data.payload.spokenText) {
                if (data.payload.spokenText.includes('otel rezervasyonu') || data.payload.spokenText.includes('Hangi şehirdesiniz?')) {
                    currentScenarioId = 'otel_rezervasyonu';
                } else if (data.payload.spokenText.includes('çalışma saatleriniz nedir') || data.payload.spokenText.includes('Üzgünüm, bu konuda bilgiye sahip değilim')) {
                    currentScenarioId = 'information_request';
                } else {
                    currentScenarioId = null;
                }
                updateSessionInfo(); 
            }
            
            processVisualResponse(data.payload.display);
            if (data.payload.audio) {
                audioQueue.push({ 
                    audio: data.payload.audio,
                    audio_format: data.payload.audio_format 
                });
                if (!isPlaying) {
                    playNextInQueue();
                }
            } else {
                isPlaying = false; 
                if (isListening) {
                    updateStatus('dinliyor', 'Sizi dinliyorum...');
                    try { recognition.start(); } catch(e){ console.error("Recognition start error on end:", e); }
                } else {
                    updateStatus('hazir', 'Hazır');
                }
            }
        } else if (data.type === 'tts_status_update') { 
            updateTtsStatus(data.payload.healthy, data.payload.message); 
        } else if (data.type === 'error') {
            addMessage(`<p>${data.payload.message}</p>`, 'error-card');
            updateStatus('hata', 'Bir hata oluştu.');
        }
    };

    const playNextInQueue = () => {
        if (audioQueue.length === 0) {
            isPlaying = false;
            if (isListening) {
                updateStatus('dinliyor', 'Sizi dinliyorum...');
                try { recognition.start(); } catch(e){ console.error("Recognition start error on end:", e); }
            } else {
                updateStatus('hazir', 'Hazır');
            }
            return;
        }
        isPlaying = true;
        updateStatus('konusuyor', 'Yapay zeka konuşuyor...');
        const { audio, audio_format } = audioQueue.shift();
        const format = audio_format || 'wav'; 
        const audioBlob = new Audio(`data:audio/${format};base64,${audio}`);
        audioBlob.play();
        audioBlob.onended = playNextInQueue;
    };

    function processVisualResponse(display) {
        if (!display || !display.type) return;
        let cardHtml = '';
        if (display.type === 'confirmation_card') {
            const res = display.data;
            const location = res.params.location || 'Belirtilmedi';
            const date = res.params.checkin_date || 'Belirtilmedi';
            const people = res.params.people_count || 'Belirtilmedi';
            const imageUrl = res.imageUrl || `https://source.unsplash.com/random/400x200/?abstract`;
            cardHtml = `<h3>✅ Rezervasyon Onaylandı!</h3><p><strong>Rezervasyon ID:</strong> ${res.id}</p><p><strong>Yer:</strong> ${location}</p><p><strong>Tarih:</strong> ${date}</p><p><strong>Kişi Sayısı:</strong> ${people}</p><img src="${imageUrl}" alt="${location} görseli">`;
            addMessage(cardHtml, 'ai-card');
        } else if (display.type === 'info_request' || display.type === 'error') { 
            addMessage(`<p>${display.text || display.message}</p>`, display.type === 'error' ? 'error-card' : 'ai-card');
        }
    }

    const sendTranscript = (userText) => {
        updateStatus('dusunuyor', 'Yapay zeka düşünüyor...');
        addMessage(`<p>${userText}</p>`, 'user-card');
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'user_transcript',
                payload: { sessionId, text: userText }
            }));
        } else {
            addMessage('<p>Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.</p>', 'error-card');
        }
    };
    
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
        userSaidSomething = false;
        updateStatus('dinliyor', 'Sizi dinliyorum...');
        console.log("SpeechRecognition started.");
    }
    recognition.onresult = (event) => {
        userSaidSomething = true;
        const userTranscript = event.results[0][0].transcript.trim();
        console.log("SpeechRecognition result:", userTranscript);
        sendTranscript(userTranscript);
    };
    recognition.onend = () => {
        console.log("SpeechRecognition ended.");
        if (isListening && !userSaidSomething) {
            console.log("SpeechRecognition ended without result, restarting...");
            try { recognition.start(); } catch (e) { console.error("Recognition restart error on end:", e); }
        } else if (isListening && userSaidSomething) {
            console.log("SpeechRecognition ended after user spoke. Awaiting AI response.");
        }
    };
    recognition.onerror = (event) => { 
        console.error("SpeechRecognition error:", event.error);
        updateStatus('hata', `Ses Tanıma Hatası: ${event.error}`);
        addMessage(`<p>Ses tanıma sırasında bir hata oluştu: ${event.error}. Mikrofonunuzu kontrol edin veya sayfayı yenileyin.</p>`, 'error-card');
        isListening = false;
        toggleButton.textContent = 'Dinlemeyi Başlat';
        toggleButton.className = 'start';
    };


    const toggleListening = () => {
        isListening = !isListening;
        if (isListening) {
            try { 
                recognition.start(); 
                console.log("Listening toggled ON, recognition started.");
            } catch(e){ 
                console.error("Recognition start error on toggle:", e); 
                updateStatus('hata', 'Ses Tanıma Başlatılamadı!');
                addMessage(`<p>Mikrofon erişimi reddedildi veya ses tanıma API'si başlatılamadı. Tarayıcı izinlerinizi kontrol edin.</p>`, 'error-card');
                isListening = false; 
            }
            toggleButton.textContent = 'Dinlemeyi Durdur';
            toggleButton.className = 'stop';
        } else {
            recognition.stop();
            updateStatus('hazir', 'Sohbet durduruldu.');
            toggleButton.textContent = 'Dinlemeyi Başlat';
            toggleButton.className = 'start';
            console.log("Listening toggled OFF, recognition stopped.");
        }
    };

    resetButton.addEventListener('click', () => {
        sessionId = `session_${Date.now()}`; 
        audioQueue = [];
        isPlaying = false;
        if (isListening) {
            isListening = false;
            recognition.stop();
            toggleButton.textContent = 'Dinlemeyi Başlat';
            toggleButton.className = 'start';
        }
        chatBox.innerHTML = '';
        addMessage('<p>Oturum sıfırlandı. Yeni bir konuşma başlatabilirsiniz.</p>', 'system-card');
        updateStatus('hazir', 'Hazır');
        currentSessionParams = {}; 
        currentScenarioId = null; 
        updateSessionInfo(); 
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'reset_session',
                payload: { sessionId } 
            }));
        }
    });
    
    toggleButton.addEventListener('click', toggleListening);

}); // DOMContentLoaded event listener'ın sonu