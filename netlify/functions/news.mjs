// ネタ帳 — ニュース取得API v2 (Netlify Function)
// NHKの公式RSSを取得してJSONで返す。
// さらに、取得のたびにNetlify Blobs(無料のデータ置き場)へニュースを貯金し、
// range=week / month のときはその貯金から返す。
// ※RSSは直近分しか配信されないため、週・月のアーカイブは稼働初日から徐々に育つ。

import { getStore } from "@netlify/blobs";

const FEEDS = {
  keizai:  { label: "経済",     url: "https://www3.nhk.or.jp/rss/news/cat5.xml" },
  world:   { label: "国際",     url: "https://www3.nhk.or.jp/rss/news/cat6.xml" },
  kokunai: { label: "国内",     url: "https://www3.nhk.or.jp/rss/news/cat1.xml" },
  sports:  { label: "スポーツ", url: "https://www3.nhk.or.jp/rss/news/cat7.xml" },
  entame:  { label: "エンタメ", url: "https://www3.nhk.or.jp/rss/news/cat2.xml" },
  kagaku:  { label: "科学",     url: "https://www3.nhk.or.jp/rss/news/cat3.xml" },
};

// 酒場に不向きな話題を弾くキーワード(最小限)
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

async function fetchLive(feedUrl) {
  const res = await fetch(feedUrl, { headers: { "user-agent": "netacho/1.0" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
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
      (it) => it.headline && !DARK.some((w) => (it.headline + it.summary).includes(w))
    )
    .slice(0, 15);
}

// アーカイブと新着を合流(URL基準で重複排除、新しい順、上限600件)
function merge(oldArr, fresh) {
  const seen = new Set(oldArr.map((x) => x.url || x.headline));
  const add = fresh.filter((x) => !seen.has(x.url || x.headline));
  const out = [...add, ...oldArr];
  out.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return out.slice(0, 600);
}

export default async (req) => {
  const u = new URL(req.url);
  const cat = u.searchParams.get("cat");
  const range = u.searchParams.get("range") || "today"; // today | week | month
  const feed = FEEDS[cat];
  if (!feed) return Response.json({ error: "unknown cat" }, { status: 400 });

  try {
    const live = await fetchLive(feed.url);

    // 貯金(Blobsが使えない環境でも当日表示は生かす)
    let merged = live;
    try {
      const store = getStore("netacho-archive");
      const old = (await store.get(`arc-${cat}`, { type: "json" })) || [];
      merged = merge(old, live);
      await store.setJSON(`arc-${cat}`, merged);
    } catch (e) {
      console.error("blobs unavailable:", e);
    }

    let items;
    if (range === "week" || range === "month") {
      const days = range === "week" ? 7 : 31;
      const cap = range === "week" ? 20 : 30;
      const cutoff = Date.now() - days * 86400000;
      items = merged
        .filter((it) => {
          const t = Date.parse(it.pubDate);
          return !t || t >= cutoff;
        })
        .slice(0, cap);
    } else {
      items = live;
    }

    return Response.json(
      { cat, label: feed.label, range, items },
      { headers: { "cache-control": "public, max-age=300" } }
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
};
