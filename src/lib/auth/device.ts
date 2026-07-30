// Device management utilities for PIN-based fast sign-in

const DEVICE_ID_KEY = 'agriqcap_device_id';
const DEVICE_HAS_PIN_KEY = 'agriqcap_has_pin';

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

export function ensureDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function setDeviceHasPin(has: boolean) {
  if (typeof window === 'undefined') return;
  if (has) {
    localStorage.setItem(DEVICE_HAS_PIN_KEY, 'true');
  } else {
    localStorage.removeItem(DEVICE_HAS_PIN_KEY);
  }
}

export function deviceHasPin(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEVICE_HAS_PIN_KEY) === 'true';
}

export function clearDevicePin() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_HAS_PIN_KEY);
  localStorage.removeItem(DEVICE_ID_KEY);
}
