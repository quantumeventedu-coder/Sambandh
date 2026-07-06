// sockets-chat.js — real-time chat over Socket.io
//
// Events (per build reference):
//   client → server: join_chat { chatId } · send_message { chatId, text }
//                    message_read { chatId, messageId } · typing { chatId }
//   server → client: new_message · message_read · typing
//                    reveal_request · reveal_accepted · karma_update · user_online

const jwt = require('jsonwebtoken');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const User = require('./models/User');
const { checkDailyLimits } = require('./routes-chat');

module.exports = function setupChatSockets(io) {
  // Authenticate every socket with the same JWT the REST API uses
  // (auth payload token, or the sb_token HttpOnly cookie)
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers.cookie) {
        for (const part of socket.handshake.headers.cookie.split(';')) {
          const [k, ...v] = part.trim().split('=');
          if (k === 'sb_token') token = decodeURIComponent(v.join('='));
        }
      }
      if (!token) return next(new Error('Missing token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('user:' + socket.userId);
    socket.broadcast.emit('user_online', { userId: socket.userId });

    socket.on('join_chat', async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (chat && chat.participants.some(p => p.toString() === socket.userId)) {
          socket.join('chat:' + chatId);
        }
      } catch { /* ignore malformed ids */ }
    });

    socket.on('send_message', async ({ chatId, text }, ack) => {
      try {
        text = (text || '').trim();
        if (!text || text.length > 5000) return ack?.({ error: 'Invalid message' });

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some(p => p.toString() === socket.userId)) {
          return ack?.({ error: 'Chat not found' });
        }
        if (chat.status !== 'active') return ack?.({ error: 'Chat not active' });

        // Same free-tier daily limits as the REST path — the socket is the
        // primary send path, so skipping this here would bypass limits entirely.
        const sender = await User.findById(socket.userId);
        const limitError = await checkDailyLimits(sender, 'message');
        if (limitError) return ack?.({ error: limitError });

        const to = chat.participants.find(p => p.toString() !== socket.userId);
        const msg = await Message.create({
          chatId: chat._id, from: socket.userId, to, text,
          type: 'text', createdAt: new Date(), deleted: false
        });
        const updated = await Chat.findByIdAndUpdate(chat._id, {
          lastMessageAt: new Date(), $inc: { messageCount: 1 }
        }, { new: true });

        io.to('chat:' + chatId).emit('new_message', {
          chatId, message: msg, from: socket.userId, createdAt: msg.createdAt
        });
        io.to('user:' + to.toString()).emit('new_message', {
          chatId, message: msg, from: socket.userId, createdAt: msg.createdAt
        });

        if (process.env.ANTHROPIC_API_KEY && updated.messageCount % 30 === 0) {
          const { processChatBatch } = require('./karma-book');
          const { analyzeChat } = require('./reputation-engine');
          processChatBatch(chat._id).catch(e => console.error('[KARMA]', e.message));
          analyzeChat(chat._id).catch(e => console.error('[REPUTATION]', e.message));
        }

        ack?.({ ok: true, messageId: msg._id });
      } catch {
        ack?.({ error: 'Failed to send' });
      }
    });

    socket.on('message_read', async ({ chatId, messageId }) => {
      try {
        const msg = await Message.findOneAndUpdate(
          { _id: messageId, to: socket.userId },
          { readAt: new Date() }, { new: true });
        if (msg) io.to('chat:' + chatId).emit('message_read', { chatId, messageId, readAt: msg.readAt });
      } catch { /* ignore */ }
    });

    socket.on('typing', ({ chatId }) => {
      socket.to('chat:' + chatId).emit('typing', { chatId, userId: socket.userId });
    });

    socket.on('disconnect', async () => {
      try { await User.findByIdAndUpdate(socket.userId, { lastActiveAt: new Date() }); } catch { /* ignore */ }
    });
  });
};
