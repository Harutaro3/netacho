// ネタ帳 — 自動貯金係 (Netlify Scheduled Function)
// 1時間ごとに全ジャンルのRSSを取得してアーカイブに追記する。
// 誰もサイトを開かない日でもニュースが貯まり、当週・当月表示が育つ。

import { getStore } from "@netlify/blobs";

const FEEDS = {
  keizai:  "https://www3.nhk.or.jp/rss/news/cat5.xml",
  world:   "https://www3.nhk.or.jp/rss/news/cat6.xml",
  kokunai: "https://www3.nhk.or.jp/rss/news/cat1.xml",
  sports:  "https://www3.nhk.or.jp/rss/news/cat7.xml",
  entame:  "https://www3.nhk.or.jp/rss/news/cat2.xml",
  kagaku:  "https://www3.nhk.or.jp/rss/news/cat3.xml",
};

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

function merge(oldArr, fresh) {
  const seen = new Set(oldArr.map((x) => x.url || x.headline));
  const add = fresh.filter((x) => !seen.has(x.url || x.headline));
  const out = [...add, ...oldArr];
  out.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return out.slice(0, 600);
}

export default async () => {
  const store = getStore("netacho-archive");
  const report = {};
  for (const [cat, url] of Object.entries(FEEDS)) {
    try {
      const live = await fetchLive(url);
      const old = (await store.get(`arc-${cat}`, { type: "json" })) || [];
      const merged = merge(old, live);
      await store.setJSON(`arc-${cat}`, merged);
      report[cat] = merged.length;
    } catch (e) {
      report[cat] = `error: ${e}`;
    }
  }
  console.log("archive report:", JSON.stringify(report));
  return Response.json({ ok: true, report });
};

export const config = {
  schedule: "@hourly",
};
