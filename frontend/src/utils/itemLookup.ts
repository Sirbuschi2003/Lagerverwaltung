export const normalize = (value?: string | null) =>
  value?.normalize("NFKC").trim().toLowerCase() ?? "";

export const normalizeLoose = (value?: string | null) =>
  normalize(value).replace(/[^a-z0-9]/g, "");

const matchesItem = <T extends { code: string; qrCodeValue?: string | null; alternateCodes?: string[] }>(
  item: T,
  normalized: string,
  normalizedLoose: string,
): boolean => {
  const codeExact = normalize(item.code);
  const codeLoose = normalizeLoose(item.code);
  const qrExact = normalize(item.qrCodeValue);
  const qrLoose = normalizeLoose(item.qrCodeValue);

  if (normalized && (normalized === codeExact || normalized === qrExact)) return true;
  if (normalizedLoose && (normalizedLoose === codeLoose || normalizedLoose === qrLoose)) return true;

  if (item.alternateCodes && item.alternateCodes.length > 0) {
    for (const altCode of item.alternateCodes) {
      if (normalized && normalized === normalize(altCode)) return true;
      if (normalizedLoose && normalizedLoose === normalizeLoose(altCode)) return true;
    }
  }

  return false;
};

export const findItemByCode = <T extends { code: string; qrCodeValue?: string | null; alternateCodes?: string[] }>(
  items: T[],
  code: string,
): T | undefined => {
  const normalized = normalize(code);
  const normalizedLoose = normalizeLoose(code);

  // Direkte Suche
  const direct = items.find((item) => matchesItem(item, normalized, normalizedLoose));
  if (direct) return direct;

  // Fallback: QR-Code enthält mehrere Codes getrennt durch " - " (z.B. "6LK50755000 - ROL-KIT-FC30-U")
  // Achtung: nur bei Bindestrich MIT Leerzeichen auf beiden Seiten trennen, damit Codes wie "G0-00732000" nicht zerstückelt werden
  const parts = code.split(/\s+[-–]\s+/);
  if (parts.length > 1) {
    for (const part of parts) {
      const partNorm = normalize(part);
      const partLoose = normalizeLoose(part);
      if (!partNorm) continue;
      const found = items.find((item) => matchesItem(item, partNorm, partLoose));
      if (found) return found;
    }
  }

  return undefined;
};

// Neue Funktion für Backend-basierte Suche mit alternativen Codes
export const findItemByCodeWithAPI = async (code: string): Promise<any | null> => {
  try {
    const { findItemByAnyCode } = await import('./api');
    return await findItemByAnyCode(code);
  } catch (error) {
    console.warn('[ItemLookup] Backend-Suche fehlgeschlagen:', error);
    return null;
  }
};


