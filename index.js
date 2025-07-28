const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const { exec } = require("child_process");
require("dotenv").config();

// Configure WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth", // Persistent auth storage
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

// QR Code Generation
client.on("qr", (qr) => {
  console.log("📲 QR Code generated - Scan to login");
  qrcode.generate(qr, { small: true });
});

// Bot Ready Event
client.on("ready", () => {
  console.log("✅ WhatsApp bot is ready and authenticated");
  console.log(
    `🚀 Bot running in ${process.env.NODE_ENV || "development"} mode`,
  );
});

// Message Handling
client.on("message", async (message) => {
  // Ignore messages from status broadcasts and your own messages
  if (message.from === "status@broadcast" || message.fromMe) return;

  const prompt = message.body.trim();
  if (!prompt) return;

  console.log(`📨 Received from ${message.from}: ${prompt}`);

  try {
    // Get AI response
    const reply = await getAIResponse(prompt);

    // Send reply
    await message.reply(reply);
    console.log(`🤖 Replied to ${message.from}`);
  } catch (error) {
    console.error("❌ Error processing message:", error);
    await message.reply(
      "⚠️ Sorry, I encountered an error. Please try again later.",
    );
  }
});

// AI Response Function
async function getAIResponse(prompt) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      },
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ AI API Error:", error.response?.data || error.message);
    throw new Error("Failed to get AI response");
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("🛑 Shutting down gracefully...");
  client.destroy().then(() => process.exit());
});

// Initialize client with error handling
(async () => {
  try {
    await client.initialize();
    console.log("🔄 Initializing WhatsApp client...");
  } catch (err) {
    console.error("❌ Failed to initialize client:", err);
    process.exit(1);
  }
})();
