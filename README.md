# ネタ帳

バーのマスター向け・開店前の会話ネタ仕込みツール。
NHKの公式RSSから6ジャンル(経済/国際/国内/スポーツ/エンタメ/科学)のニュースを取得し、
縦スワイプで流し読みできる。登録不要・完全無料で動く。

## 構成

```
netacho/
├── netlify.toml              # Netlify設定(ビルド不要)
├── public/
│   └── index.html            # 本体(HTML/CSS/JSすべてこの1枚)
└── netlify/
    └── functions/
        └── news.mjs          # RSS取得の中継API(CORS回避+暗いニュースの除外)
```

## デプロイ手順

1. このフォルダをGitHubリポジトリにpush
2. Netlifyで「Add new site → Import an existing project」からリポジトリを選択
3. ビルド設定は自動で `netlify.toml` が読まれるのでそのまま「Deploy」
   (Build command: 空欄 / Publish directory: public)
4. 発行されたURLをスマホで開けばそのまま動く

以降はgit pushするたびに自動で再デプロイされる。

## ローカルで試す場合

```bash
npm install -g netlify-cli
netlify dev
```

→ http://localhost:8888 で確認できる(Functionsも動く)。
※ index.htmlを直接ブラウザで開くとFunctionsがないため取得は失敗する。

## カスタマイズのポイント

- ジャンルの増減: `news.mjs` の `FEEDS` と `index.html` の `GENRES` を対で編集
  (NHKのRSS一覧: https://www3.nhk.or.jp/toppage/rss/index.html)
- 除外キーワード: `news.mjs` の `DARK` 配列
- 1ジャンルあたりの本数: `index.html` の `fetchGenre` 内 `.slice(0, 4)`
- 保存データはスマホのブラウザ内(localStorage)に残る。サーバーには何も保存しない

## 費用

- Netlify無料枠内(静的配信+軽量Function)
- NHK RSSは公式の無料配信
- 合計: 0円/月
