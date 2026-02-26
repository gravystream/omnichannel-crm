(function() {
  'use strict';

  var BACKEND = 'https://desk.gravystream.io';
  var SESSION_KEY = 'gravy_widget_session';

  // ─── Inject CSS ───────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = '\
#gravy-chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\
#gravy-chat-btn { width: 60px; height: 60px; border-radius: 50%; background: #1a73e8; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }\
#gravy-chat-btn:hover { transform: scale(1.1); }\
#gravy-chat-btn svg { width: 28px; height: 28px; fill: white; }\
#gravy-chat-win { display: none; position: fixed; bottom: 90px; right: 20px; width: 370px; height: 520px; background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); flex-direction: column; overflow: hidden; z-index: 99999; }\
#gravy-chat-win.open { display: flex; }\
#gravy-chat-header { background: #1a73e8; color: #fff; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }\
#gravy-chat-header h3 { margin: 0; font-size: 16px; font-weight: 600; }\
#gravy-chat-close { background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; padding: 0 4px; }\
#gravy-chat-welcome { padding: 30px 20px; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }\
#gravy-chat-welcome h4 { font-size: 18px; margin: 0 0 10px; color: #333; }\
#gravy-chat-welcome p { font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.5; }\
#gravy-start-btn { background: #1a73e8; color: #fff; border: none; padding: 12px 32px; border-radius: 24px; font-size: 15px; cursor: pointer; transition: background 0.2s; }\
#gravy-start-btn:hover { background: #1557b0; }\
#gravy-chat-body { display: none; flex-direction: column; flex: 1; overflow: hidden; }\
#gravy-chat-body.active { display: flex; }\
#gravy-chat-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }\
.gravy-msg { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }\
.gravy-msg.customer { align-self: flex-end; background: #1a73e8; color: #fff; border-bottom-right-radius: 4px; }\
.gravy-msg.agent, .gravy-msg.ai, .gravy-msg.bot { align-self: flex-start; background: #f1f3f4; color: #333; border-bottom-left-radius: 4px; }\
.gravy-msg.system { align-self: center; background: #fff3cd; color: #856404; font-size: 12px; border-radius: 8px; text-align: center; }\
#gravy-chat-input-area { display: flex; padding: 12px; border-top: 1px solid #e0e0e0; gap: 8px; }\
#gravy-chat-input { flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 8px 16px; font-size: 14px; outline: none; }\
#gravy-chat-input:focus { border-color: #1a73e8; }\
#gravy-send-btn { background: #1a73e8; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }\
#gravy-send-btn:hover { background: #1557b0; }\
#gravy-send-btn svg { width: 18px; height: 18px; fill: white; }\
.gravy-typing { align-self: flex-start; padding: 10px 14px; background: #f1f3f4; border-radius: 16px; border-bottom-left-radius: 4px; font-size: 14px; color: #999; }\
';
  document.head.appendChild(style);

  // ─── Build HTML ───────────────────────────────────────────
  var widget = document.createElement('div');
  widget.id = 'gravy-chat-widget';
  widget.innerHTML = '\
<button id="gravy-chat-btn" aria-label="Open chat">\
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>\
</button>\
<div id="gravy-chat-win">\
  <div id="gravy-chat-header">\
    <h3>Gravy Support</h3>\
    <button id="gravy-chat-close">&times;</button>\
  </div>\
  <div id="gravy-chat-welcome">\
    <h4>Welcome to Gravy!</h4>\
    <p>Hi there! How can we help you today? Start a conversation and our AI assistant will help you out.</p>\
    <button id="gravy-start-btn">Start Conversation</button>\
  </div>\
  <div id="gravy-chat-body">\
    <div id="gravy-chat-msgs"></div>\
    <div id="gravy-chat-input-area">\
      <input id="gravy-chat-input" type="text" placeholder="Type a message..." autocomplete="off" />\
      <button id="gravy-send-btn" aria-label="Send">\
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\
      </button>\
    </div>\
  </div>\
</div>';
  document.body.appendChild(widget);

  // ─── DOM References ───────────────────────────────────────
  var btn      = document.getElementById('gravy-chat-btn');
  var win      = document.getElementById('gravy-chat-win');
  var welcome  = document.getElementById('gravy-chat-welcome');
  var body     = document.getElementById('gravy-chat-body');
  var msgs     = document.getElementById('gravy-chat-msgs');
  var input    = document.getElementById('gravy-chat-input');
  var sendBtn  = document.getElementById('gravy-send-btn');
  var startBtn = document.getElementById('gravy-start-btn');
  var closeBtn = document.getElementById('gravy-chat-close');

  // ─── State ────────────────────────────────────────────────
  var chatStarted = false;
  var socket      = null;
  var sessionId   = null;
  var typingEl    = null;

  // Try to restore session from localStorage
  try { sessionId = localStorage.getItem(SESSION_KEY); } catch(e) {}

  // ─── Socket Connection ────────────────────────────────────
  function connectSocket() {
    if (socket && socket.connected) return;

    socket = io(BACKEND, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', function() {
      console.log('[GravyWidget] Connected to server');

      if (sessionId) {
        // Resume existing session
        socket.emit('chat:resume', { sessionId: sessionId });
      } else {
        // Initialize new chat session (matching working widget)
        socket.emit('chat:init', {
          name: 'Website Visitor',
          email: null
        });
      }
    });

    socket.on('chat:session', function(data) {
      if (data && data.sessionId) {
        sessionId = data.sessionId;
        try { localStorage.setItem(SESSION_KEY, sessionId); } catch(e) {}
        console.log('[GravyWidget] Session:', sessionId);
      }
    });

    socket.on('chat:message', function(data) {
      if (!data) return;
      // Support both 'message' and 'content' fields for compatibility
      var text = data.message || data.content;
      if (!text) return;
      var sender = data.senderType || 'bot';
      appendMessage(text, sender);
      hideTyping();
    });

    socket.on('chat:typing', function() {
      showTyping();
    });

    socket.on('chat:ended', function() {
      appendMessage('This conversation has ended. Start a new one anytime!', 'system');
      sessionId = null;
      try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
    });

    socket.on('disconnect', function() {
      console.log('[GravyWidget] Disconnected');
    });

    socket.on('connect_error', function(err) {
      console.log('[GravyWidget] Connection error:', err.message);
    });

    socket.on('error', function(err) {
      console.log('[GravyWidget] Error:', err);
    });
  }

  // ─── UI Helpers ───────────────────────────────────────────
  function appendMessage(text, type) {
    var div = document.createElement('div');
    div.className = 'gravy-msg ' + type;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'gravy-typing';
    typingEl.textContent = 'Typing...';
    msgs.appendChild(typingEl);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  // ─── Chat Actions ────────────────────────────────────────
  function toggleChat() {
    win.classList.toggle('open');
    if (win.classList.contains('open') && chatStarted) {
      input.focus();
    }
  }

  function startChat() {
    chatStarted = true;
    welcome.style.display = 'none';
    body.classList.add('active');
    connectSocket();
    input.focus();
  }

  function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    // If socket isn't connected, try to reconnect
    if (!socket || !socket.connected) {
      connectSocket();
      var pendingText = text;
      input.value = '';
      appendMessage(pendingText, 'customer');
      if (socket) {
        socket.once('connect', function() {
          socket.emit('chat:message', {
            sessionId: sessionId,
            message: pendingText,
            timestamp: new Date().toISOString()
          });
        });
      }
      return;
    }

    appendMessage(text, 'customer');
    socket.emit('chat:message', {
      sessionId: sessionId,
      message: text,
      timestamp: new Date().toISOString()
    });
    input.value = '';
  }

  // ─── Event Listeners ─────────────────────────────────────
  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);
  startBtn.addEventListener('click', startChat);
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });
  input.addEventListener('input', function() {
    if (socket && socket.connected && input.value.trim()) {
      socket.emit('chat:typing', { sessionId: sessionId });
    }
  });

  // ─── Restore Session ─────────────────────────────────────
  if (sessionId) {
    chatStarted = true;
    welcome.style.display = 'none';
    body.classList.add('active');
    connectSocket();
  }

})();
