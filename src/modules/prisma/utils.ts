import { Prisma } from "@prisma/client";

// Ambil semua key yang diakhiri dengan ScalarFieldEnum
type ScalarFieldEnumKeys = Extract<
  keyof typeof Prisma,
  `${string}ScalarFieldEnum`
>;

// Ambil nama entity saja (misalnya "User" dari "UserScalarFieldEnum")
type Entity = ScalarFieldEnumKeys extends `${infer U}ScalarFieldEnum`
  ? U
  : never;

// Ambil key-key field milik Entity
type Keys<T extends Entity> = keyof (typeof Prisma)[Extract<
  `${T}ScalarFieldEnum`,
  keyof typeof Prisma
>];

export function prismaExclude<T extends Entity, K extends Keys<T>>(
  type: T,
  omit: K[]
) {
  type Key = Exclude<Keys<T>, K>;
  type TMap = Record<Key, true>;
  const result: TMap = {} as TMap;

  // Paksa TS tahu kalau ini ada di Prisma
  const scalarEnum = Prisma[
    `${type}ScalarFieldEnum` as keyof typeof Prisma
  ] as Record<string, string>;

  for (const key in scalarEnum) {
    if (!omit.includes(key as K)) {
      result[key as Key] = true;
    }
  }

  return result;
}