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

    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => console.log('Gateway sunucusuna WebSocket ile bağlandı.');
    ws.onclose = () => updateStatus('hata', 'Bağlantı kesildi.');
    ws.onerror = () => updateStatus('hata', 'Bağlantı hatası.');
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_audio') {
            audioQueue.push({ 
                text: data.payload.text, 
                audio: data.payload.audio,
                audio_format: data.payload.audio_format 
            });
            if (!isPlaying) {
                playNextInQueue();
            }
        }
         if (data.type === 'error') {
            addMessage(data.payload.message, 'error');
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
        const { text, audio, audio_format } = audioQueue.shift(); 
        addMessage(marked.parse(text), 'ai', true);
        
        const format = audio_format || 'mp3';
        const audioBlob = new Audio(`data:audio/${format};base64,${audio}`);
        
        audioBlob.play();
        audioBlob.onended = playNextInQueue;
    };


    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;

    const addMessage = (text, sender, isHTML = false) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        const contentDiv = document.createElement('div');
        if (isHTML) contentDiv.innerHTML = text;
        else contentDiv.textContent = text;
        messageDiv.appendChild(contentDiv);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const updateStatus = (status, text) => {
        durumMesaji.className = `durum-${status}`;
        durumMesaji.textContent = text;
    };

    const sendTranscript = (userText) => {
        updateStatus('dusunuyor', 'Yapay zeka düşünüyor...');
        addMessage(userText, 'user');
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'user_transcript',
                payload: { sessionId, text: userText }
            }));
        } else {
            addMessage('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.', 'error');
        }
    };
    
    recognition.onstart = () => updateStatus('dinliyor', 'Sizi dinliyorum...');

    recognition.onresult = (event) => {
        const userTranscript = event.results[0][0].transcript.trim();
        sendTranscript(userTranscript);
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            updateStatus('hata', `Hata: ${event.error}`);
        }
    };

    recognition.onend = () => {
        if (isListening && !isPlaying) {
            try { recognition.start(); } catch (e) { console.error("Yeniden başlatma hatası:", e); if(isListening) toggleListening(); }
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
        chatBox.innerHTML = '';
        addMessage('Oturum sıfırlandı. Yeni bir konuşma başlatabilirsiniz.', 'system', true);
    });
    
    toggleButton.addEventListener('click', toggleListening);

} else {
    document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor.</h1>';
}