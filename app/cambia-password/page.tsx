import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function CambiaPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const primo = Boolean(user.user_metadata?.must_change_password);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <Brand
          subtitle={
            primo
              ? "Primo accesso: imposta una nuova password"
              : "Modifica la tua password"
          }
        />
        <ChangePasswordForm />
      </div>
    </main>
  );
}
