const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  // App
  PORT: parseInt(process.env.PORT, 10) || 8820,
  HOST: process.env.HOST || '0.0.0.0',
  APP_URL: process.env.APP_URL || 'http://localhost:3820',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:8823',

  // SATIM
  SATIM_MERCHANT_ID: process.env.SATIM_MERCHANT_ID,
  SATIM_TERMINAL_ID: process.env.SATIM_TERMINAL_ID,
  SATIM_SECRET_KEY: process.env.SATIM_SECRET_KEY,
  SATIM_API_URL: process.env.SATIM_API_URL,
  SATIM_CALLBACK_URL: process.env.SATIM_CALLBACK_URL,

  // SendGrid
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@lassm.dz',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || 'LASSM',

  // reCAPTCHA
  RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,

  // JWT
  JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET,
  JWT_ADMIN_ACCESS_TTL: process.env.JWT_ADMIN_ACCESS_TTL || '15m',
  JWT_ADMIN_REFRESH_TTL: process.env.JWT_ADMIN_REFRESH_TTL || '7d',

  // Bib
  BIB_RESERVATION_TTL_SECONDS: parseInt(process.env.BIB_RESERVATION_TTL_SECONDS, 10) || 900,
  PAYMENT_AMOUNT_CENTIMES: parseInt(process.env.PAYMENT_AMOUNT_CENTIMES, 10) || 200000,
};

module.exports = env;
