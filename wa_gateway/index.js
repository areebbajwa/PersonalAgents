import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import express from "express";
import "dotenv/config";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// --- Configuration ---
const MANUAL_APPROVAL_REQUIRED = true; // Hardcoded
const NTFY_TOPIC = 'areeb-agents-786'; // Hardcoded
const BASE_URL = 'https://whatsapp-web.ngrok.app/'; // Hardcoded - Remember to update if ngrok URL changes!

// Temporary store for pending messages (replace with DB for persistence if needed)
const pendingMessages = {};

console.log("Attempting to initialize WhatsApp client...");
const wa = new Client({
  authStrategy: new LocalAuth({ clientId: process.env.WA_SESSION_ID || "personal" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ],
    timeout: 60000 // 60 seconds
  },
});

wa.on("qr", qr => {
  console.log("QR Code received, please scan:");
  qrcode.generate(qr, { small: true });
});

wa.on("ready", () => console.log("✅ WhatsApp client is ready!"));

wa.on("auth_failure", msg => {
  console.error("Authentication failure:", msg);
});

wa.on("disconnected", reason => {
  console.log("Client was logged out:", reason);
});

app.post("/send", async (req, res) => {
  console.log("Received /send request");
  try {
    const { to, body } = req.body;
    console.log(`Attempting to send message to: ${to}, body: ${body}`);

    if (MANUAL_APPROVAL_REQUIRED) {
      const messageId = uuidv4();
      pendingMessages[messageId] = { to, body };
      console.log(`Manual approval required. Stored message ${messageId} pending approval.`);

      // Send ntfy notification for approval
      const approveUrl = `${BASE_URL}/approve/${messageId}`;
      const rejectUrl = `${BASE_URL}/reject/${messageId}`;

      await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`,
        `Approve WhatsApp to ${to}?
Body: ${body}`,
        {
          headers: {
            'Title': 'WhatsApp Approval Request',
            'Priority': 'high',
            'Tags': 'envelope',
            'Actions': `http, Approve, ${approveUrl}, method=POST; http, Reject, ${rejectUrl}, method=POST`
          }
        }
      );
      console.log(`Sent approval notification via ntfy.sh for message ${messageId}`);
      res.status(202).json({ message: "Message pending approval", id: messageId });

    } else {
      // Send directly if manual approval is not required
      const msg = await wa.sendMessage(to, body);
      console.log(`Message sent successfully, ID: ${msg.id.id}`);
      res.json({ id: msg.id.id });
    }
  } catch (err) {
    console.error("Error in /send endpoint:", err);
    // Clean up pending message if error occurred during notification sending
    if (err.config?.url?.includes('ntfy.sh') && pendingMessages[err.config?.url?.split('/').pop()]) {
         delete pendingMessages[err.config.url.split('/').pop()];
    }
    res.status(500).json({ error: err.message });
  }
});

// --- New Endpoints for Approval ---

app.post("/approve/:messageId", async (req, res) => {
  const { messageId } = req.params;
  console.log(`Received approval request for message ID: ${messageId}`);
  const messageData = pendingMessages[messageId];

  if (!messageData) {
    console.warn(`Approval request for unknown or already processed message ID: ${messageId}`);
    return res.status(404).json({ error: "Message not found or already processed." });
  }

  try {
    const { to, body } = messageData;
    console.log(`Approving and sending message to: ${to}, body: ${body}`);
    const msg = await wa.sendMessage(to, body);
    console.log(`Approved message sent successfully, ID: ${msg.id.id}`);
    delete pendingMessages[messageId]; // Remove from pending
    res.json({ message: "Message approved and sent.", id: msg.id.id });
  } catch (err) {
    console.error(`Error sending approved message ${messageId}:`, err);
    // Optionally, keep the message in pendingMessages to retry or notify failure
    res.status(500).json({ error: `Failed to send approved message: ${err.message}` });
  }
});

app.post("/reject/:messageId", (req, res) => {
  const { messageId } = req.params;
  console.log(`Received rejection request for message ID: ${messageId}`);
  if (pendingMessages[messageId]) {
    delete pendingMessages[messageId];
    console.log(`Rejected and removed message ID: ${messageId}`);
    res.json({ message: "Message rejected." });
  } else {
    console.warn(`Rejection request for unknown or already processed message ID: ${messageId}`);
    res.status(404).json({ error: "Message not found or already processed." });
  }
});

console.log("Calling wa.initialize()...");
wa.initialize();
app.listen(3000, () => console.log("🚀 waGateway up on :3000")); 