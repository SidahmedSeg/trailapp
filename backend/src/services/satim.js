const env = require('../config/env');
const crypto = require('crypto');

// SATIM API URLs
const SATIM_TEST_URL = 'https://test.satim.dz/payment/rest';
const SATIM_PROD_URL = 'https://cib.satim.dz/payment/rest';

// When SATIM_MOCK=true (Railway staging), short-circuit all four exported
// helpers to return fake-success payloads so the rest of the payment flow
// (callback → bib assign → email → PDF) can be exercised end-to-end without
// hitting the live LASSM merchant. Prod env never sets SATIM_MOCK → no-op.
const MOCK_ENABLED = process.env.SATIM_MOCK === 'true';
const MOCK_PREFIX = 'MOCK-';

function getBaseUrl() {
  // Use test URL if configured, otherwise production
  if (env.SATIM_API_URL && env.SATIM_API_URL.includes('test.satim.dz')) {
    return SATIM_TEST_URL;
  }
  return env.SATIM_API_URL || SATIM_PROD_URL;
}

/**
 * Send POST request to SATIM API
 * SATIM expects application/x-www-form-urlencoded body
 */
async function satimRequest(endpoint, params) {
  const url = `${getBaseUrl()}${endpoint}`;
  const body = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`SATIM HTTP error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Register a payment order with SATIM
 * Returns the redirect URL (formUrl) for the user to pay
 */
async function registerPayment({ orderId, amount, returnUrl, failUrl, language }) {
  if (MOCK_ENABLED) {
    const mockOrderId = MOCK_PREFIX + crypto.randomUUID();
    const callback = `${env.SATIM_CALLBACK_URL}?orderId=${encodeURIComponent(mockOrderId)}&mdOrder=${encodeURIComponent(mockOrderId)}`;
    return { orderId: mockOrderId, formUrl: callback };
  }
  const jsonParams = JSON.stringify({
    force_terminal_id: env.SATIM_TERMINAL_ID,
  });

  const data = await satimRequest('/register.do', {
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderNumber: orderId,
    amount: String(amount), // in centimes (DZD × 100)
    currency: '012', // DZD ISO 4217
    returnUrl,
    failUrl: failUrl || returnUrl,
    language: language || 'FR',
    jsonParams,
  });

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`SATIM register error: ${data.errorMessage || data.errorCode}`);
  }

  return {
    orderId: data.orderId,   // SATIM's internal order ID (UUID)
    formUrl: data.formUrl,   // Redirect URL to SATIM payment page
  };
}

/**
 * Acknowledge/confirm payment after callback (server-to-server)
 * Called via /public/acknowledgeTransaction.do — triggers the actual capture
 * Note: SATIM LASSM uses /public/acknowledgeTransaction.do (not /confirmOrder.do)
 */
async function confirmOrder(satimOrderId) {
  if (MOCK_ENABLED && typeof satimOrderId === 'string' && satimOrderId.startsWith(MOCK_PREFIX)) {
    return { errorCode: '0' };
  }
  const data = await satimRequest('/public/acknowledgeTransaction.do', {
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderId: satimOrderId,
    language: 'FR',
  });

  return data;
}

/**
 * Get payment status (server-to-server)
 * NEVER trust callback query params — always verify here
 */
async function getOrderStatus(satimOrderId) {
  if (MOCK_ENABLED && typeof satimOrderId === 'string' && satimOrderId.startsWith(MOCK_PREFIX)) {
    return {
      orderStatus: 2,
      actionCode: 0,
      actionCodeDescription: 'Approved (mock)',
      amount: null,
      pan: '0000000000000000',
      cardholderName: 'STAGING TEST',
      approvalCode: 'MOCK-OK',
      errorCode: '0',
      errorMessage: null,
      orderNumber: satimOrderId,
      depositAmount: null,
      params: { mock: 'true' },
    };
  }
  const data = await satimRequest('/getOrderStatus.do', {
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderId: satimOrderId,
    language: 'FR',
  });

  return {
    orderStatus: data.OrderStatus ?? data.orderStatus,     // 0=registered, 1=pre-authorized, 2=deposited (success)
    actionCode: data.actionCode,                           // 0=success
    actionCodeDescription: data.actionCodeDescription,
    amount: data.Amount ?? data.amount,
    pan: data.Pan,                                         // masked card number
    cardholderName: data.cardholderName,
    approvalCode: data.approvalCode,
    errorCode: data.ErrorCode ?? data.errorCode,
    errorMessage: data.ErrorMessage ?? data.errorMessage,
    orderNumber: data.OrderNumber ?? data.orderNumber,     // our original order ID
    depositAmount: data.depositAmount,
    params: data.params,
  };
}

/**
 * Refund a payment (full or partial)
 */
async function refundPayment(satimOrderId, amount) {
  if (MOCK_ENABLED && typeof satimOrderId === 'string' && satimOrderId.startsWith(MOCK_PREFIX)) {
    return { errorCode: '0', errorMessage: 'Refund accepted (mock)' };
  }
  const data = await satimRequest('/refund.do', {
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderId: satimOrderId,
    amount: String(amount), // in centimes
    language: 'FR',
  });

  return data;
}

module.exports = { registerPayment, confirmOrder, getOrderStatus, refundPayment };
