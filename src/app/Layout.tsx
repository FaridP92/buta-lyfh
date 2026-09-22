import { Rail } from "@/app/Rail";
import { BarreHaute } from "@/app/BarreHaute";
import { PiedPage } from "@/app/PiedPage";
import { TransitionEcran } from "@/app/TransitionEcran";

export function Layout() {
  return (
    <div className="min-h-screen">
      <Rail />
      <div className="cadre-contenu flex min-h-screen flex-col md:pl-[var(--rail-largeur)]">
        <BarreHaute />
        <main className="mx-auto w-full max-w-[var(--contenu-max)] flex-1 px-[var(--esp-4)] py-[var(--esp-5)] md:px-[var(--marge-page)]">
          <TransitionEcran />
        </main>
        <PiedPage />
      </div>
    </div>
  );
}
