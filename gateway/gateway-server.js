const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const path = require('path');

const GATEWAY_PORT = 3000;
const WORKER_PORT = 8081;
const workerUrl = `ws://localhost:${WORKER_PORT}`;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let workerSocket;

function connectToWorker() {
    console.log(`[Gateway] Worker'a bağlanmaya çalışılıyor: ${workerUrl}`);
    workerSocket = new WebSocket(workerUrl);

    workerSocket.on('open', () => console.log(`[Gateway] ✅ Worker'a başarıyla bağlandı.`));
    
    workerSocket.on('message', (message) => {
        const data = JSON.parse(message);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });

    workerSocket.on('close', () => {
        console.error(`[Gateway] ❌ Worker bağlantısı kapandı. 5 saniye içinde yeniden denenecek.`);
        setTimeout(connectToWorker, 5000);
    });

    workerSocket.on('error', (err) => {
        // Yeniden bağlanma denemesi 'close' olayı tarafından zaten yönetildiği için burada sadece loglama yapıyoruz.
    });
}

connectToWorker();

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

wss.on('connection', ws => {
  console.log('[Gateway] ✅ Tarayıcı bağlandı.');
  
  ws.on('message', (message) => {
    if (workerSocket && workerSocket.readyState === WebSocket.OPEN) {
        workerSocket.send(message);
    } else {
        console.error('[Gateway] ❌ Worker bağlantısı aktif değil, mesaj worker\'a gönderilemedi.');
    }
  });

  ws.on('close', () => console.log('[Gateway] Tarayıcı bağlantısı kapandı.'));
});

server.listen(GATEWAY_PORT, () => {
  console.log(`[Gateway] ✅ Gateway sunucusu http://localhost:${GATEWAY_PORT} adresinde çalışıyor.`);
});