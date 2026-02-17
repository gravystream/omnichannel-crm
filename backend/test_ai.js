// Direct test of AIResponseHandler
const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'omnichannel_crm',
    user: 'crm',
    password: 'CrmSecure2024!'
});

const { AIResponseHandler } = require('/root/omnichannel-crm/backend/dist/services/AIResponseHandler');

// Simple logger
const logger = {
    info: function(msg, data) { console.log('[INFO]', msg, data || ''); },
    warn: function(msg, data) { console.log('[WARN]', msg, data || ''); },
    error: function(msg, data) { console.log('[ERROR]', msg, data || ''); }
};

// Simple event bus
const eventBus = {
    publish: async function(event, data) { console.log('[EVENT]', event, JSON.stringify(data).substring(0, 200)); }
};

async function test() {
    console.log('=== AI Response Handler Direct Test ===\n');

    // Step 1: Get the latest customer message
    var msgResult = await pool.query(
        "SELECT id, conversation_id, content, sender_type FROM messages WHERE sender_type = 'customer' ORDER BY created_at DESC LIMIT 1"
    );
    var latestMsg = msgResult.rows[0];
    console.log('Latest customer message:', latestMsg);

    // Step 2: Create handler
    var handler = new AIResponseHandler(pool, eventBus, logger);
    console.log('\nHandler created. Testing with message ID:', latestMsg.id);

    // Step 3: Simulate the event payload (matching WebChatAdapter format)
    var eventPayload = {
        messageId: latestMsg.id,
        conversationId: latestMsg.conversation_id,
        channel: 'webchat',
        senderType: 'customer'
    };

    console.log('\nCalling handleMessageReceived...');
    var startTime = Date.now();
    await handler.handleMessageReceived(eventPayload, eventPayload.conversationId);
    var elapsed = Date.now() - startTime;
    console.log('\nHandler completed in ' + elapsed + 'ms');

    // Step 4: Check if AI response was saved
    var responseResult = await pool.query(
        "SELECT id, content, sender_type, created_at FROM messages WHERE conversation_id = $1 AND sender_type = 'system' ORDER BY created_at DESC LIMIT 1",
        [latestMsg.conversation_id]
    );

    if (responseResult.rows.length > 0) {
        console.log('\n=== SUCCESS! AI Response saved to DB ===');
        console.log('Response:', responseResult.rows[0].content.substring(0, 200));
    } else {
        console.log('\n=== FAILED: No AI response found in DB ===');
    }

    await pool.end();
}

test().catch(function(err) {
    console.error('Test failed:', err);
    pool.end();
});
