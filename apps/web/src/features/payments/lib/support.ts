/** Who to call about a payment that went wrong (the number in the emails and the sidebar). */
export const SUPPORT_PHONE = '+234 802 959 5069';

/** `tel:` link for SUPPORT_PHONE. */
export const SUPPORT_TEL = `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`;

/** A WhatsApp chat with the same number, with `text` typed in for the driver. */
export function supportWhatsApp(text?: string): string {
  const url = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, '')}`;
  return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}
