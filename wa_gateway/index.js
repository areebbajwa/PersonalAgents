import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import express from "express";
import "dotenv/config";

const app = express();
app.use(express.json());

const wa = new Client({
  authStrategy: new LocalAuth({ clientId: process.env.WA_SESSION_ID || "personal" }),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-gpu"] },
});

wa.on("qr", qr => qrcode.generate(qr, { small: true }));
wa.on("ready", () => console.log("✅ WhatsApp ready"));

app.post("/send", async (req, res) => {
  try {
    const { to, body } = req.body;
    const msg = await wa.sendMessage(to, body);
    res.json({ id: msg.id.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

wa.initialize();
app.listen(3000, () => console.log("🚀 waGateway up on :3000")); 