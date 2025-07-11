// src/services/gateway.js (TAM VE EKSİKSİZ KOD)

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config'); // Yeni merkezi konfigürasyon dosyasını çağırıyoruz

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const workerUrl = `ws://localhost:${config.workerPort}`;
let workerSocket;
const browserClients = new Map();

function connectToWorker() {
    console.log(`[Gateway] Worker'a bağlanmaya çalışılıyor: ${workerUrl}`);
    workerSocket = new WebSocket(workerUrl);

    workerSocket.on('open', () => console.log(`[Gateway] ✅ Worker'a başarıyla bağlandı.`));
    
    workerSocket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!data.targetClientId || !data.payload) {
                console.warn("[Gateway] Worker'dan hedefsiz veya bozuk formatta mesaj alındı.");
                return;
            }

            const { targetClientId, payload } = data;
            const targetClient = browserClients.get(targetClientId);

            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                targetClient.send(JSON.stringify(payload));
            }
        } catch (error) {
            console.error("[Gateway] Worker'dan gelen mesaj işlenirken hata:", error);
        }
    });

    workerSocket.on('close', () => {
        console.error(`[Gateway] ❌ Worker bağlantısı kapandı. 5 saniye içinde yeniden denenecek.`);
        setTimeout(connectToWorker, 5000);
    });

    workerSocket.on('error', (err) => {
        // Hata loglaması yerine 'close' olayının yeniden bağlanmayı tetiklemesine izin veriyoruz.
    });
}

connectToWorker();

// DİKKAT: public klasörünün yeni yolu doğru bir şekilde belirtildi.
// __dirname -> src/services
// ../ -> src
// ../../ -> projenin kök dizini
const publicPath = path.resolve(__dirname, '../../public');
console.log(`[Gateway] Public klasörü şu yoldan sunuluyor: ${publicPath}`);
app.use(express.static(publicPath));
app.get('*', (req, res) => {
    res.sendFile(path.resolve(publicPath, 'index.html'));
});

wss.on('connection', ws => {
  const clientId = uuidv4();
  ws.clientId = clientId;
  browserClients.set(clientId, ws);

  console.log(`[Gateway] ✅ Tarayıcı bağlandı. ID: ${clientId}`);
  
  ws.on('message', (message) => {
    if (workerSocket && workerSocket.readyState === WebSocket.OPEN) {
        try {
            const data = JSON.parse(message);
            workerSocket.send(JSON.stringify({
                sourceClientId: ws.clientId,
                payload: data
            }));
        } catch (error) {
            console.error("[Gateway] Tarayıcıdan gelen mesaj parse edilemedi:", error);
        }
    } else {
        console.error('[Gateway] ❌ Worker bağlantısı aktif değil, mesaj worker\'a gönderilemedi.');
    }
  });

  ws.on('close', () => {
    browserClients.delete(ws.clientId);
    console.log(`[Gateway] Tarayıcı bağlantısı kapandı. ID: ${ws.clientId}`);
  });
});

server.listen(config.gatewayPort, () => {
  console.log(`[Gateway] ✅ Gateway sunucusu http://localhost:${config.gatewayPort} adresinde çalışıyor.`);
});