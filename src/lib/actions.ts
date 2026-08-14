"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession } from "./auth";

export async function logout() {
  await destroySession();
  // Mesmo motivo do login: sem isso, o cache do router ainda mostra a tela
  // logada até um F5.
  revalidatePath("/", "layout");
  redirect("/login");
}
