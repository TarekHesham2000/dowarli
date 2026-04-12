import { redirect } from "next/navigation";

/** Listed in sitemap; search UX lives on the home page (Chatbot + filters). */
export default function SearchPage() {
  redirect("/");
}
