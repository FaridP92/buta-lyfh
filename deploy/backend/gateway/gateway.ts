// Passerelle des Edge Functions : reproduit le contrôle `verify_jwt` de Supabase.
// Un JWT HS256 valide (clé anon, authenticated ou service_role signée avec JWT_SECRET) est exigé,
// sauf pour la prévérification CORS (OPTIONS). Ensuite la requête est relayée telle quelle à la fonction.
const secret = Deno.env.get("JWT_SECRET") ?? "";
const origine = Deno.env.get("SITE_ORIGINE") ?? "https://buta.lyfh.fr";
const cibles: Record<string, string> = {
  "analyste": "http://fn-analyste:8000/",
  "expliquer-ecart": "http://fn-expliquer-ecart:8000/",
};
const enc = new TextEncoder();
const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);

function b64u(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function jwtValide(jeton: string): Promise<boolean> {
  const p = jeton.split(".");
  if (p.length !== 3 || !secret) return false;
  try {
    const ok = await crypto.subtle.verify("HMAC", cle, b64u(p[2]!), enc.encode(`${p[0]}.${p[1]}`));
    if (!ok) return false;
    const charge = JSON.parse(new TextDecoder().decode(b64u(p[1]!)));
    if (typeof charge.exp === "number" && charge.exp < Date.now() / 1000) return false;
    return ["anon", "authenticated", "service_role"].includes(charge.role);
  } catch {
    return false;
  }
}

Deno.serve({ port: 8000 }, async (req) => {
  const nom = new URL(req.url).pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  const cible = cibles[nom];
  if (!cible) return new Response(JSON.stringify({ message: "Fonction introuvable" }), { status: 404, headers: { "content-type": "application/json" } });
  if (req.method !== "OPTIONS") {
    const jeton = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!(await jwtValide(jeton))) {
      return new Response(JSON.stringify({ code: 401, message: "Invalid JWT" }), {
        status: 401,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": origine, Vary: "Origin" },
      });
    }
  }
  return await fetch(cible, { method: req.method, headers: req.headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body, duplex: "half" } as RequestInit);
});
