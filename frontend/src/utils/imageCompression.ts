/**
 * Verkleinert ein Bild im Browser (Canvas), bevor es hochgeladen wird.
 *
 * Warum: Artikelbilder werden serverseitig ohnehin auf 800x800 herunterskaliert
 * (siehe items.service.ts uploadImage), aber das passiert erst NACH dem
 * vollstaendigen Upload. Ein 10-40MB Rohfoto direkt von einer Handykamera
 * bringt bei schlechter Verbindung im Lager/Feld den Upload selbst zum
 * Scheitern, bevor die Server-Kompression je greifen kann.
 */
export async function compressImageFile(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.85 } = options;

  // Nur echte Rasterbilder komprimieren; alles andere unveraendert durchreichen
  // (z.B. falls ein Browser einen Dateityp liefert, den <canvas> nicht lesen kann).
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);

    // Bild ist bereits klein genug - nicht unnoetig neu kodieren (verlustfrei bleiben)
    if (scale >= 1 && file.size <= 2 * 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    // Nur verwenden, wenn tatsaechlich kleiner - sonst Original behalten
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Bei jedem Fehler (nicht unterstuetztes Format, Canvas-Fehler, ...)
    // einfach die Originaldatei hochladen - Server-Validierung greift ohnehin.
    return file;
  }
}
