import postgres from "postgres";

export type Sql = postgres.Sql;

// Los ids son BIGINT; postgres.js los entrega como texto por defecto. Caben de sobra en un number.
const bigintAsNumber = {
  to: 20,
  from: [20],
  serialize: (x: number) => String(x),
  parse: (x: string) => Number(x),
};

export function createSql(url: string, options: postgres.Options<{}> = {}): Sql {
  return postgres(url, { onnotice: () => {}, types: { bigint: bigintAsNumber }, ...options }) as unknown as Sql;
}
