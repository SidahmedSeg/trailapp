const env = require('../config/env');

/**
 * Register a payment order with SATIM
 * Returns the redirect URL for the user
 */
async function registerPayment({ orderId, amount, returnUrl }) {
  const params = new URLSearchParams({
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderNumber: orderId,
    amount: String(amount), // in centimes
    currency: '012', // DZD
    returnUrl,
  });

  const response = await fetch(`${env.SATIM_API_URL}/register.do?${params}`, {
    method: 'POST',
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`SATIM register error: ${data.errorMessage || data.errorCode}`);
  }

  return {
    orderId: data.orderId, // SATIM's order ID
    formUrl: data.formUrl, // Redirect URL for payment page
  };
}

/**
 * Confirm payment status with SATIM (server-to-server)
 * NEVER trust the callback query params — always verify here
 */
async function getOrderStatus(satimOrderId) {
  const params = new URLSearchParams({
    userName: env.SATIM_MERCHANT_ID,
    password: env.SATIM_SECRET_KEY,
    orderId: satimOrderId,
  });

  const response = await fetch(`${env.SATIM_API_URL}/getOrderStatus.do?${params}`, {
    method: 'POST',
  });

  const data = await response.json();

  return {
    orderStatus: data.orderStatus, // 0=registered, 1=pre-authorized, 2=deposited (success)
    actionCode: data.actionCode, // 0=success
    amount: data.amount,
    pan: data.Pan, // masked card number
    cardholderName: data.cardholderName,
    approvalCode: data.approvalCode,
    errorCode: data.errorCode,
    errorMessage: data.errorMessage,
    orderNumber: data.orderNumber, // our order ID
  };
}

module.exports = { registerPayment, getOrderStatus };
