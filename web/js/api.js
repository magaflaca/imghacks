const BASE = '/web';

async function request(path, options) {
  const response = await fetch(BASE + path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'No se pudo conectar con el servidor');
    error.status = response.status;
    throw error;
  }
  return body;
}

export const api = {
  models: () => request('/models').then(({ data }) => data),
  generate: (payload) =>
    request('/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  job: (id) => request(`/generations/${id}`),
};
