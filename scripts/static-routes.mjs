// Canonical app routes remain hash routes; readable path aliases only redirect.
export const legalPaths = ["/privacy", "/privacy/", "/terms", "/terms/"];
export const routeAliases = {
  "/onboarding": "/#setup", "/setup": "/#setup", "/today": "/#today",
  "/schedule": "/#schedule", "/courses": "/#courses", "/planner": "/#planner",
  "/progress": "/#progress", "/settings": "/#settings",
};
export function routeAlias(pathname) {
  const clean = pathname.replace(/\/$/, "");
  if (Object.hasOwn(routeAliases, clean)) return routeAliases[clean];
  const course = clean.match(/^\/courses\/([a-zA-Z0-9_-]+)$/);
  return course ? `/#courses/${course[1]}` : undefined;
}
export const pagesRedirects = [
  // Proxy the canonical root: Pages normalizes index.html and can otherwise
  // redirect a legal route to a trailing-slash URL before serving the shell.
  ...legalPaths.map((route) => `${route} / 200`),
  ...Object.entries(routeAliases).flatMap(([route, target]) => [`${route} ${target} 302`, `${route}/ ${target} 302`]),
  "/courses/:id /#courses/:id 302",
].join("\n") + "\n";
