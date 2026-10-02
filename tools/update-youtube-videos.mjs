import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHANNEL_ID = 'UCABxg7GwnxlhkuXpEChazLg';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const SHORTS_URL = 'https://www.youtube.com/@yuyushi17/shorts';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../data/latest-videos.json');

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5000, 10000, 15000];

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

function getAttribute(xml, tag, attribute) {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]+)"[^>]*>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function toDateLabel(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo',
  }).format(date).replaceAll('/', '.');
}

function parseFeed(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
  return entries.slice(0, 6).map((entry) => {
    const videoId = getTag(entry, 'yt:videoId');
    const title = getTag(entry, 'title');
    const published = getTag(entry, 'published');
    const link = getAttribute(entry, 'link', 'href');
    const thumbnail = getAttribute(entry, 'media:thumbnail', 'url');
    if (!videoId || !title || !link || !thumbnail) throw new Error('YouTubeフィードに必要な動画情報がありません。');
    return { id: videoId, title, url: link, thumbnail, published, dateLabel: toDateLabel(published) };
  });
}

function parseShortsPage(html, existingData = null) {
  const videos = [];
  const seen = new Set();
  const existingById = new Map((existingData?.videos || []).map((video) => [video.id, video]));
  for (const match of html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
    const videoId = match[1];
    if (seen.has(videoId)) continue;
    seen.add(videoId);
    const chunk = html.slice(match.index, match.index + 15000);
    const titleMatch = chunk.match(/"overlayMetadata":\{"primaryText":\{"content":"([\s\S]*?)"/);
    if (!titleMatch?.[1]) continue;
    const existing = existingById.get(videoId);
    const published = existing?.published || new Date().toISOString();
    videos.push({
      id: videoId,
      title: titleMatch[1],
      url: `https://www.youtube.com/shorts/${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      published,
      dateLabel: existing?.dateLabel || toDateLabel(published),
    });
    if (videos.length >= 6) break;
  }
  if (videos.length < 3) throw new Error('YouTube Shorts一覧から必要な動画数を取得できませんでした。');
  return videos;
}

async function fetchWithRetry(url, maxRetries = MAX_RETRIES) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  };
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      if ((response.status === 404 || response.status >= 500) && attempt < maxRetries - 1) {
        const delay = RETRY_DELAYS_MS[attempt] || 15000;
        console.log(`HTTP ${response.status} が返りました。${delay / 1000}秒後にリトライします... (${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(`YouTubeフィードの取得に失敗しました: ${response.status}`);
    } catch (error) {
      if (attempt < maxRetries - 1 && error instanceof TypeError) {
        const delay = RETRY_DELAYS_MS[attempt] || 15000;
        console.log(`ネットワークエラーが発生しました。${delay / 1000}秒後にリトライします... (${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('リトライ回数の上限に達しました。');
}

try {
  let existingData = null;
  try { existingData = JSON.parse(await readFile(outputPath, 'utf8')); } catch { /* 初回実行 */ }

  let response;
  let source = 'rss';
  try {
    response = await fetchWithRetry(FEED_URL);
  } catch (error) {
    console.warn(`YouTube RSSを取得できないためShorts一覧へ切り替えます: ${error instanceof Error ? error.message : error}`);
    response = await fetch(SHORTS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; yuyukrid.github.io updater)' },
    });
    source = 'shorts';
    if (!response.ok) {
      console.warn(`Shorts一覧も取得できないため、既存データを保持します: ${response.status}`);
      process.exit(0);
    }
  }

  const body = await response.text();
  const videos = source === 'shorts' ? parseShortsPage(body, existingData) : parseFeed(body);
  if (videos.length < 3) throw new Error('表示に必要な動画数を取得できませんでした。');
  if (JSON.stringify(existingData?.videos) === JSON.stringify(videos)) {
    console.log('最新動画に変更はありません。');
    process.exit(0);
  }

  const data = {
    channelId: CHANNEL_ID,
    channelUrl: `https://www.youtube.com/channel/${CHANNEL_ID}`,
    updatedAt: new Date().toISOString(),
    videos,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`最新動画データを更新しました: ${videos.length}件 (${source})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
