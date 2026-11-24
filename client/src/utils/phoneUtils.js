export const LADAS_PAISES = [
  { code: '52', label: '🇲🇽 +52 (México)', maxDigits: 10 },
  { code: '1', label: '🇺🇸 +1 (EE. UU. / Canadá)', maxDigits: 10 },
  { code: '57', label: '🇨🇴 +57 (Colombia)', maxDigits: 10 },
  { code: '502', label: '🇬🇹 +502 (Guatemala)', maxDigits: 8 },
  { code: '503', label: '🇸🇻 +503 (El Salvador)', maxDigits: 8 },
  { code: '504', label: '🇭🇳 +504 (Honduras)', maxDigits: 8 },
  { code: '54', label: '🇦🇷 +54 (Argentina)', maxDigits: 10 },
  { code: '34', label: '🇪🇸 +34 (España)', maxDigits: 9 },
];

/**
 * Separa un teléfono guardado en { lada, numero } para editarlo en el formulario.
 * Mantiene compatibilidad con números mexicanos antiguos de 10 dígitos sin lada.
 */
export const separarLadaYNumero = (telefonoGuardado = '') => {
  const digits = String(telefonoGuardado).replace(/\D/g, '');
  if (!digits) return { lada: '52', numero: '' };

  if (digits.length === 10) {
    return { lada: '52', numero: digits };
  }

  const ordenadas = [...LADAS_PAISES].sort((a, b) => b.code.length - a.code.length);
  for (const pais of ordenadas) {
    if (digits.startsWith(pais.code) && digits.length > pais.code.length + 6) {
      return {
        lada: pais.code,
        numero: digits.slice(pais.code.length),
      };
    }
  }

  return { lada: '52', numero: digits };
};

/**
 * Devuelve el número listo para https://wa.me/<numero> (formato E.164 sin '+').
 */
export const obtenerTelefonoWhatsApp = (telefonoGuardado = '') => {
  const digits = String(telefonoGuardado).replace(/\D/g, '');
  if (!digits) return '';
  // Compatibilidad con registros previos de 10 dígitos en México
  if (digits.length === 10) return `52${digits}`;
  return digits;
};

/**
 * Formatea el número de forma legible en tarjetas (ej. +1 9842842923 o +52 7848497713).
 */
export const formatearTelefonoVisible = (telefonoGuardado = '') => {
  const { lada, numero } = separarLadaYNumero(telefonoGuardado);
  if (!numero) return telefonoGuardado;
  return `+${lada} ${numero}`;
};