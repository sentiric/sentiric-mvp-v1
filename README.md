# Sentiric MVP v1

Bu proje, Sentiric platformunun temel yeteneklerini sergileyen ilk "Minimum Viable Product" (MVP) sürümüdür. Proje, sesli komutlarla çalışan, kullanıcının niyetini anlayan ve bu niyete göre farklı uzmanlık alanlarında cevaplar üreten bir yapay zeka asistanını içerir.

## 🚀 Temel Mimarisi

Bu MVP, ileride kurulacak olan kapsamlı mikroservis mimarisinin iki temel prensibini tek bir Node.js uygulamasında simüle eder:

1.  **Akıllı Yönlendirici (Smart Router / Orchestrator):** `server.js` içindeki mantık, kullanıcının ilk cümlesini analiz eder ("Otel arıyorum", "Masaj yaptırmak istiyorum" vb.) ve sohbetin geri kalanını doğru "uzman" senaryoya yönlendirir.
2.  **Genişletilmiş Üretimle Geri Çağırma (RAG - Retrieval-Augmented Generation):** Her uzman senaryo (`scenarios` klasöründeki dosyalar), kendine özel bir bilgi bankasına (`knowledgeBase`) sahiptir. Yapay zeka, cevaplarını bu bilgi bankasındaki gerçek verilere dayandırarak üretir. Bu, "halüsinasyon" görmesini engeller ve her işletmeye (tenant) özel bilgi sunmasını sağlar.

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
    - Projenin ana dizininde `.env` adında bir dosya oluşturun.
    - İçine Google Gemini API anahtarınızı aşağıdaki formatta ekleyin:
      ```
      GEMINI_API_KEY=AIzaSy...
      ```

4.  **Sunucuyu Başlatın:**
    ```bash
    node server.js
    ```

5.  **Uygulamayı Açın:**
    - Tarayıcınızdan `http://localhost:3000` adresine gidin.

## 🧪 Nasıl Test Edilir?

- "Dinlemeyi Başlat" butonuna tıklayın.
- Aşağıdaki gibi farklı senaryoları test edin:
  - "Antalya'da otel bakıyorum."
  - (Cevap sonrası) "Odalarda jakuzi var mı?"
  - (Oturumu sıfırlayın) "Sırt ağrım için randevu alabilir miyim?"
  - (Cevap sonrası) "Thai masajı ne kadar?"

Sistem, konuşmanızın başında niyetinizi anlayıp doğru asistana (otel veya masaj) geçiş yapmalı ve sonraki sorularınızı o asistana özel bilgi bankasından cevaplamalıdır.