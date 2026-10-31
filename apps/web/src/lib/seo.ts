/** Standard meta tags for a page. Keeps each route's head() to one line. */
export function pageMeta(title: string, description: string) {
  const fullTitle = `${title} | PadhLo With Us`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
