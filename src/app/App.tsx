import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/app/Layout";
import { OuvertureAnimation } from "@/app/OuvertureAnimation";
import { FournisseurFicheIndicateur } from "@/composants/FicheIndicateur";
import { FournisseurExportEcran } from "@/app/exportEcran";
import { EcranVueEnsemble } from "@/ecrans/vue-ensemble";
import { EcranTerritoires } from "@/ecrans/territoires";
import { EcranFunnel } from "@/ecrans/funnel";
import { EcranVentes } from "@/ecrans/ventes";
import { EcranForecast } from "@/ecrans/forecast";
import { EcranPose } from "@/ecrans/pose";
import { EcranPlansAction } from "@/ecrans/plans-action";
import { EcranQualite } from "@/ecrans/qualite";
import { EcranAutomatisations } from "@/ecrans/automatisations";
import { EcranAnalyste } from "@/ecrans/analyste";
import { EcranMethode } from "@/ecrans/methode";

const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

export function App() {
  const [, setOuvertureTerminee] = useState(false);

  return (
    <QueryClientProvider client={clientRequetes}>
      <BrowserRouter>
        <FournisseurFicheIndicateur>
          <FournisseurExportEcran>
            <OuvertureAnimation onTermine={() => setOuvertureTerminee(true)} />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<EcranVueEnsemble />} />
                <Route path="/territoires" element={<EcranTerritoires />} />
                <Route path="/funnel" element={<EcranFunnel />} />
                <Route path="/ventes" element={<EcranVentes />} />
                <Route path="/forecast" element={<EcranForecast />} />
                <Route path="/pose" element={<EcranPose />} />
                <Route path="/plans-action" element={<EcranPlansAction />} />
                <Route path="/qualite" element={<EcranQualite />} />
                <Route path="/automatisations" element={<EcranAutomatisations />} />
                <Route path="/analyste" element={<EcranAnalyste />} />
                <Route path="/methode" element={<EcranMethode />} />
              </Route>
            </Routes>
          </FournisseurExportEcran>
        </FournisseurFicheIndicateur>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
