import { useEffect, useState } from "react";

const REQUETE = "(max-width: 767px)";

export function useEstMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(REQUETE).matches);
  useEffect(() => {
    const media = window.matchMedia(REQUETE);
    const surChangement = () => setMobile(media.matches);
    media.addEventListener("change", surChangement);
    return () => media.removeEventListener("change", surChangement);
  }, []);
  return mobile;
}
