# Sentiric MVP v1 - Yerel AI Motoru

Bu proje, Sentiric platformunun, harici bulut servislerine bağımlı olmadan, **tamamen yerel kaynaklarla** çalışan bir prototipidir. Bu sürüm, maliyet endişelerini ortadan kaldırır ve tam veri gizliliği sağlar.

## 🚀 Mimarisi

Proje, iki ana servis üzerine kurulmuştur ve tüm yapay zeka işlemleri yerel olarak çalışır:

1.  **Gateway (`/gateway`):** Dış dünya ile konuşan "kulaklar ve ağız". Web arayüzünü sunar ve tarayıcıdan gelen metin taleplerini WebSocket üzerinden Worker'a iletir.
2.  **Worker (`/worker`):** Sistemin "beyni".
    -   **LLM (Dil Modeli):** [Ollama](https://ollama.com/) aracılığıyla yerel olarak çalışan `phi3` gibi modelleri kullanarak düşünür ve cevap üretir.
    -   **TTS (Metin Okuma):** [Piper TTS](https://github.com/rhasspy/piper) motorunu kullanarak üretilen metinleri yüksek kaliteli, doğal bir sese dönüştürür.

## 🛠️ Kurulum ve Çalıştırma

### Ön Gereksinimler

1.  **Ollama:** [ollama.com](https://ollama.com/) adresinden indirin ve kurun.
2.  **Ollama Modeli:** Terminalde şu komutu çalıştırın: `ollama pull phi3`
3.  **Piper TTS:**
    - `C:\piper` adında bir klasör oluşturun.
    - [Piper GitHub Sürümleri](https://github.com/rhasspy/piper/releases) sayfasından Windows sürümünü indirin ve dosyalarını `C:\piper` içine çıkartın.
4.  **Piper Ses Modelleri:**
    - `C:\piper-voices` adında bir klasör oluşturun.
    - Terminalde `C:\` dizinindeyken şu komutu çalıştırın: `git clone https://huggingface.co/rhasspy/piper-voices`

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

3.  **Sunucuları Başlatın:**
    Bu komut, hem Gateway hem de Worker sunucusunu aynı anda başlatır.
    ```bash
    npm start
    ```

4.  **Uygulamayı Açın:**
    - Tarayıcınızdan `http://localhost:3000` adresine gidin.