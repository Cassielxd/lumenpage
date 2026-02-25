const CSS_PX_TO_PDF_PT = 72 / 96;
const PDF_TEXT_ENCODER = new TextEncoder();

const encodePdfText = (text: string) => PDF_TEXT_ENCODER.encode(text);

const concatByteChunks = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const decodeDataUrlBytes = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (_error) {
    return null;
  }
};

const formatPdfNumber = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 0;
  const fixed = normalized.toFixed(3);
  return fixed.replace(/\.?0+$/, "");
};

export const buildPdfFromCanvasPages = (
  pages: HTMLCanvasElement[],
  pageWidthPx: number,
  pageHeightPx: number
) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  const pageWidthPt = Math.max(1, pageWidthPx * CSS_PX_TO_PDF_PT);
  const pageHeightPt = Math.max(1, pageHeightPx * CSS_PX_TO_PDF_PT);
  const formattedWidth = formatPdfNumber(pageWidthPt);
  const formattedHeight = formatPdfNumber(pageHeightPt);

  const totalObjects = 2 + pages.length * 3;
  const objects: Array<Uint8Array | null> = new Array(totalObjects + 1).fill(null);
  const pageRefs: string[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const pageObjectId = 3 + index * 3;
    const contentObjectId = pageObjectId + 1;
    const imageObjectId = pageObjectId + 2;
    const imageName = `Im${index + 1}`;
    const imageDataUrl = page.toDataURL("image/jpeg", 0.92);
    const imageBytes = decodeDataUrlBytes(imageDataUrl);
    if (!imageBytes || imageBytes.length === 0) {
      return null;
    }

    const imageHeader = encodePdfText(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`
    );
    const imageFooter = encodePdfText("\nendstream");
    objects[imageObjectId] = concatByteChunks([imageHeader, imageBytes, imageFooter]);

    const contentText = `q\n${formattedWidth} 0 0 ${formattedHeight} 0 0 cm\n/${imageName} Do\nQ\n`;
    const contentBytes = encodePdfText(contentText);
    objects[contentObjectId] = concatByteChunks([
      encodePdfText(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      encodePdfText("endstream"),
    ]);

    objects[pageObjectId] = encodePdfText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formattedWidth} ${formattedHeight}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    pageRefs.push(`${pageObjectId} 0 R`);
  }

  objects[1] = encodePdfText("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encodePdfText(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(" ")}] >>`
  );

  const header = concatByteChunks([
    encodePdfText("%PDF-1.7\n"),
    new Uint8Array([0x25, 0xff, 0xff, 0xff, 0xff, 0x0a]),
  ]);
  const chunks: Uint8Array[] = [header];
  const offsets = new Array(totalObjects + 1).fill(0);
  let offset = header.length;

  for (let objectId = 1; objectId <= totalObjects; objectId += 1) {
    const objectBody = objects[objectId];
    if (!objectBody) {
      return null;
    }
    const objectPrefix = encodePdfText(`${objectId} 0 obj\n`);
    const objectSuffix = encodePdfText("\nendobj\n");
    offsets[objectId] = offset;
    chunks.push(objectPrefix, objectBody, objectSuffix);
    offset += objectPrefix.length + objectBody.length + objectSuffix.length;
  }

  const xrefOffset = offset;
  chunks.push(encodePdfText(`xref\n0 ${totalObjects + 1}\n`));
  chunks.push(encodePdfText("0000000000 65535 f \n"));
  for (let objectId = 1; objectId <= totalObjects; objectId += 1) {
    const line = `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
    chunks.push(encodePdfText(line));
  }
  chunks.push(
    encodePdfText(
      `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    )
  );

  return concatByteChunks(chunks);
};
