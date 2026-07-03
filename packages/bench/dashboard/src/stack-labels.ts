/** Human-readable WinRK stack labels for dashboard + registry drift tests. */
const TOKEN_LABELS: Record<string, string> = {
  static: "Static",
  fastify: "Fastify",
  http: "HTTP",
  html: "HTML",
  react: "React",
  vue: "Vue",
  vdom: "VDOM",
  vapor: "Vapor",
  solid: "Solid",
  solidstart: "SolidStart",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  luxel: "Luxel",
  spiral: "Spiral",
  csr: "CSR",
  ssr: "SSR",
  isr: "ISR",
  rsc: "RSC",
  native: "Native",
  full: "Full",
};

function capitalize(token: string): string {
  if (token.length === 0) return token;
  return token[0]!.toUpperCase() + token.slice(1);
}

function labelToken(token: string): string {
  return TOKEN_LABELS[token] ?? capitalize(token);
}

export function stackLabel(stackId: string): string {
  const parts = stackId.split("-");
  const labels: string[] = [];

  for (let i = 0; i < parts.length; ) {
    if (parts[i] === "worker" && parts[i + 1] === "pool") {
      labels.push("(worker pool)");
      i += 2;
      continue;
    }
    labels.push(labelToken(parts[i]!));
    i += 1;
  }

  return labels.join(" ");
}
