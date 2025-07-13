// ========== TikTok Live + Gift Tracker + Saweria ========== //
// Menyimpan semua komentar & gift ke file JSON + total donasi + daftar pemberi gift (TikTok & Saweria)

const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const fs = require('fs');

const wss = new WebSocket.Server({ port: 8080 });
const tiktokUsername = 'username_tiktok_anda';

const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);
let allComments = [];
let totalDonations = 0;
let giftSenders = {}; // { nickname: { giftName: count } }
let saweriaDonors = [];

function saveToFile() {
  fs.writeFileSync('data.json', JSON.stringify({
    comments: allComments,
    total: totalDonations,
    giftSenders,
    saweriaDonors
  }, null, 2));
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'history', data: allComments }));
  ws.send(JSON.stringify({ type: 'donation-total', data: totalDonations }));
  ws.send(JSON.stringify({ type: 'gift-senders', data: giftSenders }));
  ws.send(JSON.stringify({ type: 'saweria-donors', data: saweriaDonors }));
});

(async () => {
  try {
    await tiktokLiveConnection.connect();
    console.log(`Terhubung ke LIVE @${tiktokUsername}`);
  } catch (err) {
    console.error('Gagal terhubung:', err);
    return;
  }
})();

function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// Komentar

tiktokLiveConnection.on('chat', (data) => {
  const message = {
    nickname: data.nickname,
    comment: data.comment,
    timestamp: Date.now()
  };
  allComments.push(message);
  broadcast({ type: 'new', data: message });
  saveToFile();
});

// Follow

tiktokLiveConnection.on('follow', (data) => {
  const message = {
    nickname: data.nickname,
    event: 'follow',
    timestamp: Date.now()
  };
  allComments.push(message);
  broadcast({ type: 'follow', data: message });
  saveToFile();
});

// Gift / Donasi

tiktokLiveConnection.on('gift', (data) => {
  const message = {
    nickname: data.nickname,
    giftName: data.giftName,
    repeatCount: data.repeatCount,
    event: 'gift',
    timestamp: Date.now()
  };
  totalDonations += data.repeatCount;

  // Simpan daftar pemberi gift
  if (!giftSenders[data.nickname]) giftSenders[data.nickname] = {};
  giftSenders[data.nickname][data.giftName] =
    (giftSenders[data.nickname][data.giftName] || 0) + data.repeatCount;

  broadcast({ type: 'gift', data: message });
  broadcast({ type: 'donation-total', data: totalDonations });
  broadcast({ type: 'gift-senders', data: giftSenders });

  allComments.push(message);
  saveToFile();
});

// (Optional) Saweria Webhook Endpoint - Simulasi via manual POST
// Anda bisa pasang webhook ke Vercel / Railway jika ingin otomatis
// Contoh payload: { name: "Donatur 1", amount: 10000 }

const express = require('express');
const app = express();
app.use(express.json());

app.post('/saweria-webhook', (req, res) => {
  const donor = {
    nickname: req.body.name || 'Anonim',
    amount: req.body.amount || 0,
    event: 'saweria',
    timestamp: Date.now()
  };
  saweriaDonors.push(donor);
  totalDonations += 1;

  broadcast({ type: 'saweria', data: donor });
  broadcast({ type: 'saweria-donors', data: saweriaDonors });
  broadcast({ type: 'donation-total', data: totalDonations });

  saveToFile();
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Webhook listening on port 3000'));

// Frontend update silakan saya bantu jika Anda ingin menampilkan daftar donatur langsung di web.
