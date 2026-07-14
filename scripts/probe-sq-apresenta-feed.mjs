const feeds = [
  "https://sq-apresenta.blogspot.com/feeds/posts/default/-/Lancamentos?alt=json&max-results=2",
  "https://sq-apresenta.blogspot.com/feeds/posts/default/-/Estreia?alt=json&max-results=2",
  "https://sq-apresenta.blogspot.com/feeds/posts/default/-/Última%20Edição?alt=json&max-results=2"
];

for (const url of feeds) {
  const response = await fetch(url, {
    headers: { "user-agent": "ReelForgeStudio/1.0" }
  });
  const json = await response.json();
  const entry = json.feed?.entry?.[0];
  console.log("\n===", url, "===");
  if (!entry) {
    console.log("no entries");
    continue;
  }
  const html = entry.content?.$t ?? entry.summary?.$t ?? "";
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const link = entry.link?.find((l) => l.rel === "alternate")?.href;
  console.log({
    title: entry.title?.$t,
    link,
    img,
    categories: entry.category?.map((c) => c.term),
    thumbnail: entry.media$thumbnail?.url
  });
}