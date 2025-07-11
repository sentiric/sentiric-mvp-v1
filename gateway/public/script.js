window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (window.SpeechRecognition) {
    const recognition = new SpeechRecognition();
    const toggleButton = document.getElementById('toggleButton');
    const resetButton = document.getElementById('resetButton');
    const chatBox = document.getElementById('chatBox');
    const durumMesaji = document.getElementById('durum');
    let isListening = false;
    let sessionId = `session_${Date.now()}`;
    let audioQueue = [];
    let isPlaying = false;
    let userSaidSomething = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    
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

    ws.onopen = () => console.log('Gateway sunucusuna WebSocket ile bağlandı.');
    ws.onclose = () => updateStatus('hata', 'Bağlantı kesildi.');
    ws.onerror = (err) => updateStatus('hata', 'Bağlantı hatası.');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_response') {
            processVisualResponse(data.payload.display);
            audioQueue.push({ 
                audio: data.payload.audio,
                audio_format: data.payload.audio_format 
            });
            if (!isPlaying) {
                playNextInQueue();
            }
        } else if (data.type === 'error') {
            addMessage(`<p>${data.payload.message}</p>`, 'error-card');
            updateStatus('hazir', 'Hazır');
        }
    };

    const playNextInQueue = () => {
        if (audioQueue.length === 0) {
            isPlaying = false;
            if (isListening) {
                updateStatus('dinliyor', 'Sizi dinliyorum...');
                try { recognition.start(); } catch(e){}
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
        } else if (display.type === 'info_request') {
            addMessage(`<p>${display.text}</p>`, 'ai-card');
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
    }
    recognition.onresult = (event) => {
        userSaidSomething = true;
        const userTranscript = event.results[0][0].transcript.trim();
        sendTranscript(userTranscript);
    };
    recognition.onend = () => {
        if (isListening && !userSaidSomething) {
            try { recognition.start(); } catch (e) {}
        }
    };

    const toggleListening = () => {
        isListening = !isListening;
        if (isListening) {
            recognition.start();
            toggleButton.textContent = 'Dinlemeyi Durdur';
            toggleButton.className = 'stop';
        } else {
            recognition.stop();
            updateStatus('hazir', 'Sohbet durduruldu.');
            toggleButton.textContent = 'Dinlemeyi Başlat';
            toggleButton.className = 'start';
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
    });
    
    toggleButton.addEventListener('click', toggleListening);
} else {
    document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor.</h1>';
}