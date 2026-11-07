/**
 * WhatsApp Business Cloud API Client
 * Sends messages directly to users via Meta's Graph API.
 */

export async function sendWhatsAppTextMessage(to: string, message: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneId) {
    return { ok: false, error: 'WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing' };
  }

  // Sanitize recipient phone (remove +, spaces, leading zeros)
  const cleanTo = to.replace(/\D/g, '');

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('WhatsApp API send error:', data);
      return { ok: false, error: data?.error?.message || 'Failed to send WhatsApp message', data };
    }

    return { ok: true, data };
  } catch (err: any) {
    console.error('WhatsApp API network error:', err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}
