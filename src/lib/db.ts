// Prisma client with environment-aware adapter.
// - 로컬: DATABASE_URL=file:./dev.db (SQLite 파일)
// - 프로덕션 (Vercel/Netlify): DATABASE_URL=libsql://<your-db>.turso.io 와
//   TURSO_AUTH_TOKEN=<token>
// libsql 어댑터는 file: 와 libsql: 두 스킴 모두 지원해서 같은 코드로 동작.

import { PrismaClient } from "../../prisma/generated/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const adapter = new PrismaLibSql({
    url,
    ...(authToken ? { authToken } : {}),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
