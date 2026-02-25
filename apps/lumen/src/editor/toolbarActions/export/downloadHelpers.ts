export const downloadBlobAsFile = (filename: string, blob: Blob) => {
  if (typeof window === "undefined") {
    return false;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};

export const downloadTextAsFile = (
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
) => downloadBlobAsFile(filename, new Blob([content], { type: mimeType }));

export const downloadDataUrlAsFile = (filename: string, dataUrl: string) => {
  if (typeof window === "undefined") {
    return false;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
};
