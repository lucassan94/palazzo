// Serviço de integração com a API Asaas (v3)
import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

const BASE_URL = config.asaas.baseUrl;

// ──────── HEADERS ────────
function getHeaders() {
  if (!config.asaas.apiKey) {
    throw new AppError('ASAAS_API_KEY não configurada.', 500, 'ASAAS_MISCONFIG');
  }
  return {
    'Content-Type': 'application/json',
    'access_token': config.asaas.apiKey,
  };
}

// ──────── LOGGING ────────
function logRequest(method, path, status, durationMs, error) {
  const level = error ? 'error' : 'info';
  const msg = `[Asaas] ${method} ${path} → ${status} (${durationMs}ms)`;
  if (error) {
    console.error(msg, error.substring(0, 200));
  } else {
    console.log(msg);
  }
}

// ──────── RETRY HELPER ────────
async function withRetry(fn, retries = 3, baseDelay = 500) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err.name === 'TypeError'
        || err.message?.includes('fetch')
        || err.code === 'ABORT_ERR'
        || err.message?.includes('ECONNRESET');
      if (!isRetryable || attempt === retries) break;
      const delay = baseDelay * Math.pow(2, attempt - 1); // exponential backoff
      console.warn(`[Asaas] Tentativa ${attempt}/${retries} falhou, retry em ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Helper genérico para chamadas à API Asaas
async function call(method, path, body = null, idempotencyKey = null) {
  return withRetry(async () => {
    const headers = getHeaders();
    if (idempotencyKey) headers['idempotency_key'] = idempotencyKey;

    const start = Date.now();

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(config.asaas.requestTimeout),
    });

    const durationMs = Date.now() - start;
    const data = await response.json();

    if (!response.ok) {
      const msg = data.errors?.[0]?.description || 'Erro na comunicação com Asaas';
      const code = data.errors?.[0]?.code || 'ASAAS_ERROR';
      logRequest(method, path, response.status, durationMs, msg);
      throw new AppError(msg, 400, code);
    }

    logRequest(method, path, response.status, durationMs);
    return data;
  });
}

// ──────── CUSTOMER ────────

// Busca cliente existente por CPF e/ou externalReference
export async function findCustomer(cpfCnpj, externalRef) {
  return call('GET', `/v3/customers?cpfCnpj=${cpfCnpj}&externalReference=${externalRef}`);
}

// Cria novo cliente no Asaas
// Nota: mobilePhone só é enviado em produção, pois o sandbox rejeita
// qualquer valor neste campo (bug conhecido do sandbox Asaas)
export async function createCustomer({ name, cpfCnpj, email, phone, externalReference }) {
  const body = {
    name,
    cpfCnpj,
    email,
    externalReference: String(externalReference),
    notificationDisabled: true,
  };
  // Apenas em produção: enviar telefone
  // Sandbox rejeita qualquer valor em mobilePhone
  if (config.asaas.environment === 'production' && phone) {
    body.mobilePhone = phone;
  }
  return call('POST', '/v3/customers', body);
}

// Busca por CPF/externalRef; se não existir, cria
export async function findOrCreateCustomer(clienteData) {
  const { data } = await findCustomer(clienteData.cpfCnpj, String(clienteData.id));
  if (data?.length > 0) return data[0];
  return createCustomer(clienteData);
}

// ──────── PAYMENT ────────

// Cria cobrança (PIX ou Cartão de Crédito)
export async function createPayment({
  customer, billingType, value, dueDate,
  description, externalReference,
  creditCard, creditCardHolderInfo, remoteIp,
}, idempotencyKey) {
  const body = {
    customer,
    billingType,
    value,
    dueDate,
    description,
    externalReference: String(externalReference),
  };

  // Se for cartão de crédito, enviar dados do cartão + titular
  if (billingType === 'CREDIT_CARD' && creditCard) {
    body.creditCard = {
      holderName: creditCard.holderName,
      number: creditCard.number,
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    };
    body.creditCardHolderInfo = {
      name: creditCardHolderInfo.name,
      email: creditCardHolderInfo.email,
      cpfCnpj: creditCardHolderInfo.cpfCnpj,
      postalCode: creditCardHolderInfo.postalCode,
      addressNumber: creditCardHolderInfo.addressNumber,
      phone: creditCardHolderInfo.phone,
    };
    body.remoteIp = remoteIp;
  }

  return call('POST', '/v3/payments', body, idempotencyKey);
}

// Consulta detalhes de uma cobrança
export async function getPayment(paymentId) {
  return call('GET', `/v3/payments/${paymentId}`);
}

// Obtém QR Code PIX (encodedImage, payload, expirationDate)
export async function getPixQrCode(paymentId) {
  return call('GET', `/v3/payments/${paymentId}/pixQrCode`);
}

// Deleta cobrança (para cancelar PENDING)
export async function deletePayment(paymentId) {
  return call('DELETE', `/v3/payments/${paymentId}`);
}

// Reembolso (total ou parcial)
export async function refundPayment(paymentId, value = null) {
  const body = {};
  if (value !== null) body.value = value;
  return call('POST', `/v3/payments/${paymentId}/refund`, body);
}

// Tokeniza cartão (Checkout Transparente — dados NUNCA são armazenados)
export async function tokenizeCard(cardData) {
  // ATENÇÃO: cardData contém dados sensíveis. Esta função tokeniza
  // o cartão com o Asaas e retorna APENAS o token. O frontend deve
  // usar este token no lugar dos dados brutos do cartão.
  //
  // Idealmente, a tokenização deve ocorrer no frontend via Asaas JS SDK
  // para que dados de cartão NUNCA trafeguem pelo seu servidor.
  //
  // Por enquanto, este endpoint atua como proxy para minimizar a
  // superfície PCI, mas o ideal é tokenizar no frontend.
  return call('POST', '/v3/creditCard/tokenize', cardData);
}

// ──────── WEBHOOK HMAC ────────

// Gera HMAC-SHA256 do payload do webhook para verificação
// O Asaas envia o header 'asaas-signature' com este HMAC
export function gerarHmacPayLoad(body, secret) {
  if (!secret) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(typeof body === 'string' ? body : JSON.stringify(body))
    .digest('hex');
}

// Verifica se a assinatura HMAC recebida é válida
export function verificarAssinaturaWebhook(body, signature, secret) {
  if (!signature || !secret) return false;
  const expected = gerarHmacPayLoad(body, secret);
  // Comparação segura contra timing attack
  if (!expected) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
