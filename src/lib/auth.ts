import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  createSession,
  deleteSession,
  findUserBySessionToken,
  findUserByEmail,
  findUserById,
  verifyLogin,
} from "@/lib/data-access";
import type { PublicUser } from "@/lib/data-access";

const SESSION_COOKIE = "ywz_session";
const SESSION_DAYS = 14;

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = newSessionToken();
  createSession(userId, tokenHash(token));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(tokenHash(token));
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");
  return user;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(tokenHash(token));
  store.delete(SESSION_COOKIE);
}

export { findUserByEmail, findUserById, verifyLogin };
