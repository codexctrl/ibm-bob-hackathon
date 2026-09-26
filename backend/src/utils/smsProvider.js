/**
 * Thin abstraction over an SMS gateway so the rest of the app never
 * talks to a specific provider directly. For the hackathon demo this
 * defaults to a "mock" mode that just logs the message and always
 * succeeds - swap in a real provider (Twilio, MSG91, etc.) by
 * implementing sendViaRealProvider and setting SMS_PROVIDER=real.
 */
async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (provider === 'mock') {
    // eslint-disable-next-line no-console
    console.log(`[MOCK SMS] to ${phone}: ${message}`);
    return { success: true, providerMessageId: `mock-${Date.now()}` };
  }

  return sendViaRealProvider(phone, message);
}

async function sendViaRealProvider(phone, message) {
  // TODO: integrate your chosen SMS gateway's SDK/HTTP API here.
  // Keep credentials in .env (SMS_API_KEY, SMS_SENDER_ID) - never hardcode them.
  throw new Error('Real SMS provider not configured yet. Set SMS_PROVIDER=mock for the demo.');
}

module.exports = { sendSms };
