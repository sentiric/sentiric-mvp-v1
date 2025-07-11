window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (window.SpeechRecognition) {
    const recognition = new SpeechRecognition();
    const toggleButton = document.getElementById('toggleButton');
    const resetButton = document.getElementById('resetButton');
    const chatBox = document.getElementById('chatBox');
    const durumMesaji = document.getElementById('durum');
    let isListening = false;
    const sessionId = `user_${Date.now()}`; // Her sayfa yenilendiğinde yeni oturum

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

    const processAIResponse = (reply) => {
        addMessage(marked.parse(reply), 'ai', true);
    };

    const getAIResponse = async (userText) => {
        updateStatus('dusunuyor', 'Yapay zeka düşünüyor...');
        addMessage(userText, 'user');
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText, sessionId: sessionId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Sunucu yanıtı başarısız.');
            }
            const data = await response.json();
            processAIResponse(data.reply);
        } catch (error) {
            addMessage(`Yapay zekadan cevap alınamadı: ${error.message}`, 'error');
        } finally {
            if (isListening) updateStatus('dinliyor', 'Sizi dinliyorum...');
            else updateStatus('hazir', 'Hazır');
        }
    };
    
    recognition.onstart = () => updateStatus('dinliyor', 'Sizi dinliyorum...');

    recognition.onresult = (event) => {
        const userTranscript = event.results[0][0].transcript.trim();
        getAIResponse(userTranscript);
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            updateStatus('hata', `Hata: ${event.error}`);
        }
    };

    recognition.onend = () => {
        if (isListening) {
            try { recognition.start(); } catch (e) { 
                console.error("Yeniden başlatma hatası:", e); 
                if(isListening) toggleListening(); 
            }
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

    const resetSession = async () => {
        try {
            await fetch('/api/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionId })
            });
            addMessage('Oturum sıfırlandı. Yeni bir konu başlatabilirsiniz.', 'system', true);
        } catch (error) {
            addMessage('Oturum sıfırlanamadı.', 'error');
        }
    };
    
    toggleButton.addEventListener('click', toggleListening);
    resetButton.addEventListener('click', resetSession);
} else {
    document.body.innerHTML = '<h1>Üzgünüz, tarayıcınız Konuşma Tanıma API\'ını desteklemiyor.</h1>';
}