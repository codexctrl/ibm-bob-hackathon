/**
 * Thin wrapper around the IBM watsonx.ai text-generation REST API.
 *
 * Required environment variables (all optional — feature degrades gracefully):
 *   WATSONX_API_KEY        IBM Cloud IAM API key
 *   WATSONX_URL            watsonx.ai endpoint, e.g. https://us-south.ml.cloud.ibm.com
 *   WATSONX_PROJECT_ID     watsonx.ai project ID
 *   WATSONX_MODEL_ID       model to use (default: ibm/granite-13b-instruct-v2)
 *
 * If any required variable is missing, `isConfigured()` returns false and the
 * caller should return an advisory-unavailable response rather than erroring.
 */

const WATSONX_MODEL_DEFAULT = 'ibm/granite-13b-instruct-v2';

/** Returns true when all required env vars are present. */
function isConfigured() {
  return !!(
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_URL &&
    process.env.WATSONX_PROJECT_ID
  );
}

/**
 * Fetches a short-lived IAM bearer token using the provided API key.
 * IBM Cloud IAM tokens expire in ~1 hour; for the demo we fetch one
 * per request rather than caching (keeps the code simple).
 */
async function getIamToken(apiKey) {
  const res = await fetch(
    'https://iam.cloud.ibm.com/identity/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IAM token fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Calls the watsonx.ai text generation endpoint with the supplied prompt.
 * Returns the trimmed generated text, or throws on network / API errors.
 *
 * @param {string} prompt
 * @param {{ maxNewTokens?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<string>}
 */
async function generate(prompt, { maxNewTokens = 200, timeoutMs = 15000 } = {}) {
  if (!isConfigured()) {
    throw new Error('watsonx.ai is not configured (missing env vars)');
  }

  const iamToken = await getIamToken(process.env.WATSONX_API_KEY);
  const modelId = process.env.WATSONX_MODEL_ID || WATSONX_MODEL_DEFAULT;
  const url = `${process.env.WATSONX_URL.replace(/\/$/, '')}/ml/v1/text/generation?version=2023-05-29`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${iamToken}`
      },
      body: JSON.stringify({
        model_id: modelId,
        project_id: process.env.WATSONX_PROJECT_ID,
        input: prompt,
        parameters: {
          decoding_method: 'greedy',
          max_new_tokens: maxNewTokens,
          stop_sequences: ['\n\n', '---']
        }
      })
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`watsonx.ai generation failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const generated = data?.results?.[0]?.generated_text ?? '';
  return generated.trim();
}

module.exports = { isConfigured, generate };
