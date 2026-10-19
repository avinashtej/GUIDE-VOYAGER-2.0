export const MAX_KIOSK_QR_LENGTH = 4096;

// The hardware team has not supplied a QR schema. Keep decoding separate from
// interpretation so the eventual parser can be plugged in without guessing a payload.
export function inspectKioskQr(rawValue, parser = null) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { status: 'empty', message: 'No QR contents were received.' };
  if (raw.length > MAX_KIOSK_QR_LENGTH) return { status: 'too-large', message: 'This QR value is too long to process.' };
  if (!parser) return { status: 'contract-pending', raw, message: 'The QR was decoded, but its contents cannot be interpreted until the hardware format is supplied.' };
  return parser(raw);
}
