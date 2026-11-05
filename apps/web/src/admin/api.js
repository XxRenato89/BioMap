/**
 * Llamadas del panel a /api/admin. La sesión viaja en una cookie HttpOnly que
 * el navegador manda solo; los errores llegan con su código y mensaje.
 */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {string} method
 * @param {string} path Relativa a /api/admin.
 * @param {object | Blob} [body] JSON, o una imagen (Blob/File) para subir.
 */
export async function adminApi(method, path, body) {
  const isFile = body instanceof Blob;
  const response = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': isFile ? body.type : 'application/json' },
    body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? 'ERROR',
      data?.error?.message ?? `Error ${response.status}`,
    );
  }
  return data;
}
