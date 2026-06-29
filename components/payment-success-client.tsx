"use client";

import { useEffect, useState } from 'react';

export function PaymentSuccessClient() {
  const [message, setMessage] = useState('Confirming Stripe payment and updating your MyPetID order…');

  useEffect(() => {
    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const order = params.get('order');
      if (!sessionId || !order) return setMessage('Stripe returned without an order/session id. The payment may still have succeeded; admin can reconcile from Stripe.');
      try {
        const response = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}&order=${encodeURIComponent(order)}`);
        const json = await response.json();
        if (!response.ok) return setMessage(json.error || 'Could not confirm payment automatically.');
        setMessage(json.paid ? 'Payment confirmed. Your tag order is marked paid and ready for QR/NFC prep.' : 'Stripe session found, but payment is not marked paid yet. Admin review is queued.');
      } catch {
        setMessage('Payment return page loaded, but this static host cannot reach the confirmation API. Vercel confirms orders automatically; admin can reconcile from Stripe if needed.');
      }
    }
    confirm();
  }, []);

  return <p className="notice">{message}</p>;
}
