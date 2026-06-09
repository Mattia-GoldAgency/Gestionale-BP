import { redirect } from "next/navigation";

// La root reindirizza alla dashboard; il middleware gestisce l'eventuale
// redirect a /login se l'utente non è autenticato.
export default function Home() {
  redirect("/dashboard");
}
