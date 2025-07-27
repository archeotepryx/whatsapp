const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const dotenv = require('dotenv');
dotenv.config();

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state,
    browser: ['Ubuntu', 'Chrome', '22.04'],
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`🔐 QR Code (open on your phone to scan): ${qr}`);
      // Optionally: send this QR to your WhatsApp number
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log(
        '🔌 Connection closed due to',
        lastDisconnect?.error,
        '\nReconnecting:',
        shouldReconnect
      );

      if (shouldReconnect) {
        startSock();
      } else {
        console.log('❌ Logged out. Please redeploy and rescan the QR.');
      }
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log(`📩 Message from ${sender}: ${text}`);

    if (text?.toLowerCase() === 'hi') {
      await sock.sendMessage(sender, { text: 'Hello! 👋 This is your WhatsApp bot.' });
    }
  });
}

startSock();
