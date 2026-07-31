"use server";

import { askStatusProForSession, asAuthFailure } from "@/application/session-actions";

export async function askStatusProAction(question: string) {
  try {
    return await askStatusProForSession(question);
  } catch (err) {
    const msg = asAuthFailure(err);
    if (msg) return msg;
    throw err;
  }
}
