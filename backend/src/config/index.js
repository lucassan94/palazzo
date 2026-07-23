import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'delivery',
    user: process.env.DB_USER || 'default',
    password: process.env.DB_PASS || 'default',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  },

  // JWT
  jwt: {
    secret: (() => {
      const s = process.env.JWT_SECRET;
      if (process.env.NODE_ENV === 'production' && !s) {
        console.error('[FATAL] JWT_SECRET não configurado em produção!');
        process.exit(1);
      }
      return s || 'dev-secret-key-change-in-production';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '365d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
  },

  // Multi-tenant: Restaurant ID (hardcoded for this instance)
  restaurantId: parseInt(process.env.RESTAURANT_ID || '1', 10),

  // CORS
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),

  // Upload
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },

  // Asaas Payment Gateway
  asaas: {
    apiKey: process.env.ASAAS_API_KEY,
    environment: process.env.ASAAS_ENV || 'sandbox',
    baseUrl: process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
    // HMAC secret para verificar assinatura dos webhooks
    // Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    webhookSecret: process.env.ASAAS_WEBHOOK_SECRET || '',
    // Tempo de expiração do QR Code PIX em minutos (padrão Asaas: 30-60min)
    pixExpiryMinutes: parseInt(process.env.ASAAS_PIX_EXPIRY || '30', 10),
    requestTimeout: parseInt(process.env.ASAAS_REQUEST_TIMEOUT || '30000', 10),
  },
};
