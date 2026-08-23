/**
 * Chamada de função de banco tipada de forma tolerante.
 *
 * Os tipos gerados do banco podem ficar atrás das funções realmente publicadas.
 * Este utilitário mantém a chamada segura em runtime (nome + argumentos
 * explícitos) sem travar o build quando os tipos gerados ainda não conhecem a
 * função. A autorização continua no banco.
 */
export type DbRpcResult = { data: unknown; error: { message?: string } | null };

export type DbRpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<DbRpcResult>;

export function dbRpc(client: { rpc: unknown }): DbRpcCaller {
  return client.rpc as unknown as DbRpcCaller;
}
