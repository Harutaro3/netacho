// ネタ帳 — ニュース取得API (Netlify Function)
// NHKの公式RSSを取得し、JSONに整形して返す。
// ブラウザから直接RSSを読むとCORSで弾かれるため、この関数が中継する。

const FEEDS = {
  keizai:  { label: "経済",     url: "https://www3.nhk.or.jp/rss/news/cat5.xml" },
  world:   { label: "国際",     url: "https://www3.nhk.or.jp/rss/news/cat6.xml" },
  kokunai: { label: "国内",     url: "https://www3.nhk.or.jp/rss/news/cat1.xml" },
  sports:  { label: "スポーツ", url: "https://www3.nhk.or.jp/rss/news/cat7.xml" },
  entame:  { label: "エンタメ", url: "https://www3.nhk.or.jp/rss/news/cat2.xml" },
  kagaku:  { label: "科学",     url: "https://www3.nhk.or.jp/rss/news/cat3.xml" },
};

// 酒場に不向きな話題を弾くキーワード(強すぎると何も残らないので最小限)
const DARK = ["死亡", "死去", "訃報", "殺", "遺体", "自殺", "虐待", "心中"];

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

export default async (req) => {
  const url = new URL(req.url);
  const cat = url.searchParams.get("cat");
  const feed = FEEDS[cat];
  if (!feed) {
    return Response.json({ error: "unknown cat" }, { status: 400 });
  }

  try {
    const res = await fetch(feed.url, { headers: { "user-agent": "netacho/1.0" } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((m) => {
        const block = m[1];
        const pick = (tag) => {
          const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
          return mm ? decode(mm[1]) : "";
        };
        return {
          headline: pick("title"),
          summary: pick("description"),
          url: pick("link"),
          pubDate: pick("pubDate"),
        };
      })
      .filter(
        (it) =>
          it.headline &&
          !DARK.some((w) => (it.headline + it.summary).includes(w))
      )
      .slice(0, 15);

    return Response.json(
      { cat, label: feed.label, items },
      { headers: { "cache-control": "public, max-age=600" } } // 10分キャッシュ
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
};
