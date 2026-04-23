/**
 * RabbitMQ Publisher for Chat Events (Issue #15)
 * 
 *  Schema agreed on (Issue #19) — DO NOT CHANGE without coordination:
 * Exchange: 'chat.events' (type: topic, durable: true)
 * Routing Key: 'message.created'
 * Payload:
 * {
 *   roomId: string,      // MongoDB ObjectId as string
 *   userId: string,      // User ID from JWT
 *   messageId: string,   // Message ObjectId as string  
 *   timestamp: string    // ISO 8601 format (e.g., "2026-04-24T12:34:56.789Z")
 * }
 * 
 * If Issue #19 needs additional fields, extend payload here and notify Member C.
 */

const amqplib = require('amqplib');

const EXCHANGE = 'chat.events';
const ROUTING_KEY = 'message.created';

let channel = null;
let connection = null;  //  Store connection for proper cleanup

const connectWithRetry = async (retries = 5, delay = 1000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      connection = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');  // ✅ Store connection
      channel = await connection.createChannel();
      
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      console.log('[RabbitMQ] ✅ connected and exchange ready');

      connection.on('error', (err) => {  // ✅ Use stored connection for events
        console.error('[RabbitMQ] ❌ connection error:', err.message);
        channel = null;
      });

      connection.on('close', () => {  // ✅ Clear both channel AND connection on close
        console.warn('[RabbitMQ] ⚠️ connection closed, will reconnect...');
        channel = null;
        connection = null;  //  Clear connection reference
        setTimeout(() => connectWithRetry(), 2000);
      });

      return;
    } catch (err) {
      console.error(`[RabbitMQ] ⚠️ connect attempt ${i}/${retries} failed: ${err.message}`);
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay * i)); // exponential backoff
      }
    }
  }
  console.error('[RabbitMQ] ❌ all retries exhausted — publisher disabled');
};

exports.initRabbitMQ = connectWithRetry;

exports.publishMessageCreated = async (payload) => {
  // Validate required payload fields (defensive coding)
  const required = ['roomId', 'userId', 'messageId', 'timestamp'];
  const missing = required.filter(field => !payload[field]);
  if (missing.length > 0) {
    console.error(`[RabbitMQ] ❌ publish failed: missing fields: ${missing.join(', ')}`);
    return;
  }

  if (!channel) {
    console.warn('[RabbitMQ] ⚠️ no channel, skipping publish (graceful degradation)');
    return;  // graceful degradation — don't crash if RabbitMQ is down
  }

  try {
    const msg = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, ROUTING_KEY, msg, { persistent: true });
    console.log(`[RabbitMQ] ✅ published message.created: ${payload.messageId}`);
  } catch (err) {
    console.error(`[RabbitMQ] ❌ publish error: ${err.message}`);
  }
};

// Optional exports for testing/monitoring
exports.getChannel = () => channel;
exports.getExchange = () => EXCHANGE;
exports.getRoutingKey = () => ROUTING_KEY;