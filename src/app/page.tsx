import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { PlayerProvider } from "@/components/PlayerProvider";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <PlayerProvider token={session.access_token!}>
      <Dashboard />
    </PlayerProvider>
  );
}
