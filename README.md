# Sentiric MVP v1 - Yerel ve Esnek AI Motoru

Bu proje, Sentiric platformunun, harici bulut servislerine bağımlı olmadan **yerel kaynakları önceliklendiren** (ancak kolayca bulut servislerine geçiş yapabilen) bir prototipidir. Bu sürüm, maliyet endişelerini minimize eder, veri gizliliği sağlar ve Sentiric'in **"Tak-Çıkar Lego Seti"** ve **"Varsayılan Olarak Harici, Stratejik Olarak Dahili"** mimari felsefesini somut olarak gösterir.

## 🚀 Mimarisi

Proje, iki ana servis üzerine kurulmuştur ve tüm yapay zeka işlemleri, seçime bağlı olarak yerel veya bulut üzerinde çalışır:

1.  **Gateway (`/gateway`):** Dış dünya ile konuşan "kulaklar ve ağız". Web arayüzünü sunar ve tarayıcıdan gelen metin taleplerini WebSocket üzerinden Worker'a iletir.
2.  **Worker (`/worker`):** Sistemin "beyni". Bu servis, konfigürasyona göre dinamik olarak AI Adaptörlerini yükler:
    -   **LLM (Büyük Dil Modeli):**
        -   **Yerel Seçenek:** [Ollama](https://ollama.com/) aracılığıyla yerel olarak çalışan `phi3` gibi modelleri kullanarak düşünür ve cevap üretir.
        -   **Bulut Seçenek:** Google Gemini gibi harici LLM servislerini kullanabilir.
    -   **TTS (Metin Okuma):**
        -   **Yerel Seçenek (Sentiric Voice Engine):** Özelleştirilmiş [Coqui-TTS](https://github.com/azmisahin-forks/coqui-TTS/tree/sentiric) çatallanmanızdan gelen **Sentiric Voice Engine**'i (yerel bir sunucu olarak çalışır) kullanarak üretilen metinleri yüksek kaliteli, doğal bir sese dönüştürür. Bu, projenin kendi "in-house" ses motoru vizyonunun ilk adımıdır.

## 🛠️ Kurulum ve Çalıştırma

### Ön Gereksinimler

1.  **Ollama:** [ollama.com](https://ollama.com/) adresinden indirin ve kurun.
2.  **Ollama Modeli:** Terminalde şu komutu çalıştırın: `ollama pull phi3` (veya `.env` dosyasında belirlediğiniz diğer modeller)
3.  **Sentiric Voice Engine (Coqui-TTS Tabanlı TTS Sunucunuz):**
    -   Kendi özelleştirilmiş Coqui-TTS projenizi (örn: `https://github.com/azmisahin-forks/coqui-TTS/tree/sentiric`) klonlayın veya indirin.
    -   Bu sunucuyu talimatlarına göre çalıştırın (genellikle bir Python betiği veya Docker konteyneri olabilir). Sunucunuzun `http://localhost:5002` (veya `.env` dosyasında belirttiğiniz port) adresinde `api/tts` endpoint'ine POST istekleri alabiliyor olması gerekir.
    -   Ses referans dosyanızın (.wav) yolunu `XTTS_SPEAKER_REF_PATH` ortam değişkeninde doğru şekilde belirttiğinizden emin olun (örn: `C:/path/to/your/speaker_ref.wav`).
    
    *(Not: Eğer halihazırda Coqui-TTS sunucunuzu çalıştıran bir ortamınız yoksa, geçici olarak [Piper TTS](https://github.com/rhasspy/piper/releases) kullanmaya devam edebilirsiniz. Bu durumda Piper'ı yukarıdaki Coqui-TTS adımlarıyla aynı şekilde kurup, `.env` dosyanızdaki `XTTS_SPEAKER_REF_PATH`'i Piper ses modelinize yönlendirin.)*

### Projeyi Kurma

1.  **Repo'yu Klonlayın:**
    ```bash
    git clone https://github.com/sentiric/sentiric-mvp-v1.git
    cd sentiric-mvp-v1
    ```

2.  **Bağımlılıkları Kurun:**
    ```bash
    npm install
    ```

3.  **Ortam Değişkenlerini Ayarlayın (`.env`):**
    Projenin kök dizininde `.env` adında bir dosya oluşturun ve aşağıdaki değişkenleri kendi değerlerinizle doldurun:
    ```dotenv
    GATEWAY_PORT=3000
    WORKER_PORT=8081

    # LLM Seçimi: 'true' ise Ollama (Yerel), 'false' ise Gemini (Bulut) kullanılır
    USE_LOCAL_LLM=true 

    # Ollama Ayarları (USE_LOCAL_LLM=true ise)
    OLLAMA_HOST=127.0.0.1
    OLLAMA_PORT=11434
    OLLAMA_MODEL_NAME=phi3 # Veya indirdiğiniz başka bir model

    # Gemini Ayarları (USE_LOCAL_LLM=false ise)
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GEMINI_MODEL_NAME=gemini-1.5-flash-latest

    # Sentiric Voice Engine (Coqui-TTS Tabanlı) Ayarları
    # TTS sunucunuzun çalıştığı host ve port
    XTTS_SERVER_HOST=127.0.0.1
    XTTS_SERVER_PORT=5002
    # Özel ses referans dosyanızın yolu (örn: C:/path/to/your/speaker_ref.wav)
    XTTS_SPEAKER_REF_PATH=C:/piper-voices/tr_TR/tr_TR_ferhat_low/ferhat_low.wav 

    # Pexels API Anahtarı (Görsel çekmek için opsiyonel)
    PEXELS_API_KEY=YOUR_PEXELS_API_KEY
    ```
    *Unutmayın: `XTTS_SPEAKER_REF_PATH` değerini kendi sisteminizdeki gerçek .wav dosyası yolunuza göre güncelleyin.*

4.  **Sunucuları Başlatın:**
    Bu komut, hem Gateway hem de Worker sunucusunu aynı anda başlatır.
    ```bash
    npm start
    ```
    Ayrıca, Ollama sunucunuzun ve Coqui-TTS tabanlı Sentiric Voice Engine sunucunuzun da arka planda çalıştığından emin olun.

5.  **Uygulamayı Açın:**
    - Tarayıcınızdan `http://localhost:3000` adresine gidin.