export const MAX_KIOSK_QR_LENGTH = 4096;

/** Validate and resolve the version 1 itinerary payload printed by the kiosk. */
export function inspectKioskQr(rawValue, knownDestinationIds = []) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { status: 'empty', message: 'No QR contents were received.' };
  if (raw.length > MAX_KIOSK_QR_LENGTH) return { status: 'too-large', message: 'This QR value is too long to process.' };

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { status: 'invalid-json', message: 'This is not a valid Guide Voyager trip QR code.' };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 'invalid-payload', message: 'This QR code does not contain a trip.' };
  }
  if (payload.app !== 'GUIDE_VOYAGER') {
    return { status: 'wrong-app', message: 'This QR code was not created for Guide Voyager.' };
  }
  if (payload.version !== 1) {
    return { status: 'unsupported-version', message: 'This kiosk QR version is not supported. Update Guide Voyager and try again.' };
  }
  if (payload.type !== 'trip') {
    return { status: 'unsupported-type', message: 'This QR code is not a kiosk trip itinerary.' };
  }
  if (!Array.isArray(payload.destinationIds) || !payload.destinationIds.length || payload.destinationIds.some(id => typeof id !== 'string' || !id)) {
    return { status: 'empty-trip', message: 'This QR code does not contain a valid destination list.' };
  }

  const known = new Set(knownDestinationIds);
  const unknown = [...new Set(payload.destinationIds.filter(id => !known.has(id)))];
  if (unknown.length) {
    return { status: 'unknown-destination', unknown, message: `This trip contains a place not included in this guide: ${unknown.join(', ')}. Update the guide or ask the kiosk team for a current QR code.` };
  }

  const destinationIds = [...new Set(payload.destinationIds)];
  return {
    status: 'valid',
    destinationIds,
    duplicatesRemoved: payload.destinationIds.length - destinationIds.length,
    message: 'Kiosk trip is ready to add to your plan.'
  };
}
