import crypto from 'crypto';

async function main() {
  const vercelUrl = process.env.VERCEL_APP_URL || 'https://recoveriq-seven.vercel.app';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoveriq_test_secret_32bytes';

  console.log('================================================================');
  console.log('RECOVERIQ — TRIGGERING LIVE STAGING PAYMENT RECOVERY SEQUENCE');
  console.log(`Target Webhook URL: ${vercelUrl}/api/webhooks/razorpay`);
  console.log('================================================================\n');

  const txnTimestamp = Date.now();
  const testPaymentId = `pay_test_demo_${txnTimestamp}`;
  const testOrderId = `order_test_demo_${txnTimestamp}`;
  const testEventId = `evt_test_demo_${txnTimestamp}`;

  const payload = {
    entity: 'event',
    account_id: 'acc_saasify_blr',
    event: 'payment.failed',
    event_id: testEventId,
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: testPaymentId,
          entity: 'payment',
          amount: 499900, // ₹4,999.00
          currency: 'INR',
          status: 'failed',
          order_id: testOrderId,
          method: 'upi',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'UPI transaction timed out at PSP bank switch',
          error_source: 'bank',
          error_step: 'payment_authorization',
          error_reason: 'payment_failed',
          contact: '+919876543210',
          email: 'rohit.patel@saasify-customer.com',
          vpa: 'rohit@okhdfcbank',
          bank: 'HDFC Bank',
          created_at: Math.floor(txnTimestamp / 1000),
          notes: {
            merchantId: 'mer_saasify_blr',
            plan: 'PRO_ANNUAL_SUBSCRIPTION',
          },
        },
      },
    },
    created_at: Math.floor(txnTimestamp / 1000),
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  console.log(`Sending webhook event: ${testEventId} for Payment: ${testPaymentId} (₹4,999.00)...`);

  const response = await fetch(`${vercelUrl}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Razorpay-Signature': signature,
    },
    body: rawBody,
  });

  const responseText = await response.text();
  console.log(`Response Status: ${response.status}`);
  console.log(`Response Body: ${responseText}\n`);

  if (!response.ok) {
    console.error('❌ Failed to trigger live webhook!');
    process.exit(1);
  }

  console.log('✅ Webhook successfully accepted by Vercel web app!');
  console.log('The Render worker daemon will now claim the sequence from Upstash Redis.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
