export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

/** PostgREST-style PTxxx errors → our API error contract. */
export function rpcError(error: { code?: string; message?: string }, requestId: string) {
  const status = /^PT(\d{3})$/.exec(error.code ?? '')?.[1];
  return json(status ? Number(status) : 500, {
    code: status ? error.message : 'server_error', message: status ? error.message : 'server_error',
    retryable: !status || status === '429', requestId,
  });
}
