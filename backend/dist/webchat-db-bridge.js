"use strict";
/**
 * WebChat-to-Database Bridge
 * Listens for channel.webhook events from WebChatAdapter and persists messages to the database.
 * Also creates/finds customers and conversations as needed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./utils/database");

// Find or create customer by email (for webchat visitors)
async function findOrCreateWebChatCustomer(pool, identity) {
    const email = identity?.email;
    const name = identity?.name || 'Web Visitor';
    const fingerprint = identity?.deviceFingerprint;

    if (email) {
        const existing = await pool.query('SELECT id FROM customers WHERE email = $1 LIMIT 1', [email]);
        if (existing.rows.length > 0) return existing.rows[0].id;
        const result = await pool.query(
            'INSERT INTO customers (name, email, channel, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, email, 'web_chat', JSON.stringify({ deviceFingerprint: fingerprint })]
        );
        return result.rows[0].id;
    }
    const identifier = fingerprint || `anon_${Date.now()}`;
    const existing = await pool.query('SELECT id FROM customers WHERE phone = $1 LIMIT 1', [identifier]);
    if (existing.rows.length > 0) return existing.rows[0].id;
    const result = await pool.query(
        'INSERT INTO customers (name, phone, channel, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, identifier, 'web_chat', JSON.stringify({ deviceFingerprint: fingerprint })]
    );
    return result.rows[0].id;
}
async function findOrCreateWebChatConversation(pool, customerId) {
    const existing = await pool.query(
        "SELECT id FROM conversations WHERE customer_id = $1 AND channel = 'web_chat' AND status = 'open' ORDER BY created_at DESC LIMIT 1",
        [customerId]
    );
    if (existing.rows.length > 0) {
        await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [existing.rows[0].id]);
        return existing.rows[0].id;
    }
    const result = await pool.query(
        "INSERT INTO conversations (customer_id, channel, status, subject, priority) VALUES ($1, 'web_chat', 'open', 'Web Chat Inquiry', 'medium') RETURNING id",
        [customerId]
    );
    return result.rows[0].id;
}