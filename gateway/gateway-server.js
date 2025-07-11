const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Benzersiz ID üretmek için

const GATEWAY_PORT = process.env.GATEWAY_PORT || 3000;
const WORKER_PORT = process.env.WORKER_PORT || 8081;
const workerUrl = `ws://localhost:${WORKER_PORT}`;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let workerSocket;

// Tarayıcı bağlantılarını saklamak için bir harita (Map)
const browserClients = new Map();

function connectToWorker() {
    console.log(`[Gateway] Worker'a bağlanmaya çalışılıyor: ${workerUrl}`);
    workerSocket = new WebSocket(workerUrl);

    workerSocket.on('open', () => console.log(`[Gateway] ✅ Worker'a başarıyla bağlandı.`));
    
    // Worker'dan gelen hedefli mesajları işle
    workerSocket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Gelen paketin yapısını kontrol et
            if (!data.targetClientId || !data.payload) {
                console.warn("[Gateway] Worker'dan hedefsiz veya bozuk formatta mesaj alındı.");
                return;
            }

            const { targetClientId, payload } = data;
            
            // Hedef tarayıcıyı bul
            const targetClient = browserClients.get(targetClientId);

            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                // Sadece ve sadece doğru hedefe gönder
                targetClient.send(JSON.stringify(payload));
            } else {
                // Bu bir hata değil, kullanıcı sayfayı kapatmış olabilir.
                // console.warn(`[Gateway] Hedef istemci ${targetClientId} bulunamadı veya bağlantısı kapalı.`);
            }
        } catch (error) {
            console.error("[Gateway] Worker'dan gelen mesaj işlenirken hata:", error);
        }
    });

    workerSocket.on('close', () => {
        console.error(`[Gateway] ❌ Worker bağlantısı kapandı. 5 saniye içinde yeniden denenecek.`);
        setTimeout(connectToWorker, 5000);
    });

    workerSocket.on('error', (err) => {});
}

connectToWorker();

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

wss.on('connection', ws => {
  // Her yeni tarayıcı bağlantısına benzersiz bir kimlik ver
  const clientId = uuidv4();
  ws.clientId = clientId; // Kimliği bağlantı nesnesine ekle
  browserClients.set(clientId, ws); // Kimliği ve bağlantıyı haritada sakla

  console.log(`[Gateway] ✅ Tarayıcı bağlandı. ID: ${clientId}`);
  
  // Tarayıcıdan gelen mesajı işle
  ws.on('message', (message) => {
    if (workerSocket && workerSocket.readyState === WebSocket.OPEN) {
        // Mesajı worker'a gönderirken, kimin gönderdiğini de ekle
        try {
            const data = JSON.parse(message);
            workerSocket.send(JSON.stringify({
                sourceClientId: ws.clientId, // Bu mesajın kaynağı kim?
                payload: data // Orijinal mesaj neydi?
            }));
        } catch (error) {
            console.error("[Gateway] Tarayıcıdan gelen mesaj parse edilemedi:", error);
        }
    } else {
        console.error('[Gateway] ❌ Worker bağlantısı aktif değil, mesaj worker\'a gönderilemedi.');
    }
  });

  ws.on('close', () => {
    // Tarayıcı kapandığında onu listeden sil
    browserClients.delete(ws.clientId);
    console.log(`[Gateway] Tarayıcı bağlantısı kapandı. ID: ${ws.clientId}`);
  });
});

server.listen(GATEWAY_PORT, () => {
  console.log(`[Gateway] ✅ Gateway sunucusu http://localhost:${GATEWAY_PORT} adresinde çalışıyor.`);
});