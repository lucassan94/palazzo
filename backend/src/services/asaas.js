// Serviço de integração com a API Asaas (v3)
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

const BASE_URL = config.asaas.baseUrl;
const HEADERS = {
  'Content-Type': 'application/json',
  'access_token': config.asaas.apiKey,
};

// Helper genérico para chamadas à API Asaas
async function call(method, path, body = null, idempotencyKey = null) {
  const headers = { ...HEADERS };
  if (idempotencyKey) headers['idempotency_key'] = idempotencyKey;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(config.asaas.requestTimeout),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.errors?.[0]?.description || 'Erro na comunicação com Asaas';
    const code = data.errors?.[0]?.code || 'ASAAS_ERROR';
    throw new AppError(msg, 400, code);
  }

  return data;
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

// Tokeniza cartão (opcional, para reuso)
export async function tokenizeCard(cardData) {
  return call('POST', '/v3/creditCard/tokenize', cardData);
}
