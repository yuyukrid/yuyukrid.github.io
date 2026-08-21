import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOG_ID = '3869';
const RSS_URL = `https://regimag.jp/b/rss/index/${BLOG_ID}/`;
const BLOG_URL = `https://regimag.jp/b/view/list/blog/${BLOG_ID}/`;
const FALLBACK_THUMBNAIL = `https://regimag.jp/resource/blog/${BLOG_ID}/info/pc_header_68cb956da53e4909693400.webp`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../data/latest-blog-articles.json');

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function toAbsoluteUrl(value = '') {
  try {
    return new URL(value, 'https://regimag.jp').href;
  } catch {
    return '';
  }
}

function getThumbnail(description = '') {
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? toAbsoluteUrl(decodeXml(match[1])) : FALLBACK_THUMBNAIL;
}

function toDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(date).replaceAll('/', '.');
}

function parseFeed(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  return items.slice(0, 6).map((item) => {
    const title = getTag(item, 'title');
    const url = getTag(item, 'link');
    const published = getTag(item, 'pubDate');
    const description = getTag(item, 'description');

    if (!title || !url || !published) {
      throw new Error('ブログRSSに必要な記事情報がありません。');
    }

    return {
      title,
      url: toAbsoluteUrl(url),
      thumbnail: getThumbnail(description),
      published,
      dateLabel: toDateLabel(published),
      hasPromotionNotice: /【PR】|プロモーション|アフィリエイト広告/i.test(`${title} ${description}`),
    };
  });
}

try {
  const response = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'yuyukrid.github.io content updater' },
  });
  if (!response.ok) throw new Error(`ブログRSSの取得に失敗しました: ${response.status}`);

  const xml = await response.text();
  const articles = parseFeed(xml);
  if (!articles.length) throw new Error('表示できるブログ記事を取得できませんでした。');

  let existingData = null;
  try {
    existingData = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // 初回実行時は公開データが存在しないため、そのまま生成する。
  }

  if (JSON.stringify(existingData?.articles) === JSON.stringify(articles)) {
    console.log('最新ブログ記事に変更はありません。');
    process.exit(0);
  }

  const data = {
    blogId: BLOG_ID,
    blogUrl: BLOG_URL,
    rssUrl: RSS_URL,
    updatedAt: new Date().toISOString(),
    articles,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`最新ブログ記事データを更新しました: ${articles.length}件`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
