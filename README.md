# Sentiric MVP v1 - Multiservice Mimarisi

Bu proje, Sentiric platformunun "sağlam" bir temel üzerine oturtulmuş ilk prototipidir. Önceki tek sunuculu yapının aksine, bu sürüm, o kapsamlı plandaki **mikroservis mimarisini** taklit eder ve iki ana bileşenden oluşur:

1.  **Gateway (`/gateway`):** Dış dünya ile konuşan "kulaklar ve ağız". Web arayüzünü sunar, tarayıcıdan gelen ses verisini (gelecekte Twilio'dan) alır ve WebSocket üzerinden Worker'a iletir. Worker'dan gelen sesli cevabı da alıp tarayıcıya (veya telefona) geri gönderir.
2.  **Worker (`/worker`):** Sistemin "beyni". Gateway'den gelen metinleri alır, Akıllı Yönlendirici ve RAG mimarisini kullanarak düşünür, bir cevap üretir ve bu cevabı sese çevirerek (TTS) Gateway'e geri yollar.

Bu yapı, gerçek bir telefoni sisteminin çalışma mantığını simüle eder ve platformun ölçeklenebilir, dayanıklı ve esnek olmasını sağlar.

## 🛠️ Kurulum ve Çalıştırma

1.  **Repo'yu Klonlayın:**
    ```bash
    git clone https://github.com/sentiric/sentiric-mvp-v1.git
    cd sentiric-mvp-v1
    ```

2.  **Bağımlılıkları Kurun:**
    ```bash
    npm install
    ```

3.  **Ortam Değişkenlerini Ayarlayın:**
    - `.env.example` dosyasını kopyalayıp `.env` adında yeni bir dosya oluşturun.
    - `.env` dosyasını açıp kendi API anahtarlarınızı ve ayarlarınızı girin.
    - Google Cloud Text-to-Speech API'si için bir servis hesabı anahtarı (`.json`) oluşturup projenin kök dizinine yerleştirin ve adının `.env` dosyasındakiyle eşleştiğinden emin olun.

4.  **Sunucuları Başlatın:**
    Bu komut, hem Gateway hem de Worker sunucusunu aynı anda başlatır.
    ```bash
    npm start
    ```

5.  **Uygulamayı Açın:**
    - Tarayıcınızdan `http://localhost:3000` (veya `.env`'de belirttiğiniz `GATEWAY_PORT`) adresine gidin.