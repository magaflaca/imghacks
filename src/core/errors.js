export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'invalid_request') => new HttpError(400, code, message);
export const unauthorized = (message = 'API key invalida o ausente') => new HttpError(401, 'unauthorized', message);
export const notFound = (message = 'No encontrado') => new HttpError(404, 'not_found', message);
export const tooMany = (message) => new HttpError(429, 'rate_limited', message);
