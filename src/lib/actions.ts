"use server";

import { redirect } from "next/navigation";
import { destroySession } from "./auth";

export async function logout() {
  await destroySession();
  redirect("/login");
}
