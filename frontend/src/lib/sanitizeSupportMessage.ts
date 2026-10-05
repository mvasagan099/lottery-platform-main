import DOMPurify from 'dompurify'

// Keep support-editor formatting, but exclude scripts, event handlers, embeds,
// images, styles, forms, and arbitrary attributes, including on old messages.
export function sanitizeSupportMessage(message: string): string {
  return DOMPurify.sanitize(message, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  })
}
