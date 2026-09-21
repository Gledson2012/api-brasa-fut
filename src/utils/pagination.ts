/**
 * Envelope padrão de paginação da BrasaFut API.
 *
 * Todas as rotas de listagem retornam:
 * `{ page, limit, total, totalPages, data }`
 * com campos extras opcionais mesclados via `extra`.
 */
export interface Paginated<T, E extends Record<string, unknown> = Record<string, never>> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

export type PaginatedWith<E extends Record<string, unknown>, T> = Paginated<T> & E;

export function paginate<T, E extends Record<string, unknown> = Record<string, never>>(
  page: number,
  limit: number,
  total: number,
  data: T[],
  extra?: E
): Paginated<T> & E {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    data,
    ...(extra ?? ({} as E)),
  };
}
