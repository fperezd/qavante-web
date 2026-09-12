export interface BinaryDownload {
  bytes: Uint8Array<ArrayBuffer>;
  filename: string;
  contentType: string;
}

/** Última defensa antes de entregar un nombre al navegador. El contrato del
 * endpoint se valida antes; acá sólo se impiden rutas, controles y extensiones
 * engañosas en cualquier caller futuro. */
export function safeDownloadFilename(filename: string, extension: `.${string}`): string {
  if (!/^\.[a-z0-9]+$/i.test(extension)) throw new Error("Extensión de descarga inválida");
  const leaf = filename.split(/[\\/]/).at(-1) ?? "";
  const escapedExtension = extension.replace(".", "\\.");
  const basename =
    leaf
      .replace(new RegExp(`${escapedExtension}$`, "i"), "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "") || "export";
  return `${basename}${extension.toLowerCase()}`;
}

export function downloadBinary(file: BinaryDownload, extension: `.${string}`): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([file.bytes], { type: file.contentType }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeDownloadFilename(file.filename, extension);
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
