import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHANNEL_ID = 'UCABxg7GwnxlhkuXpEChazLg';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../data/latest-videos.json');

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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
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

    if (!videoId || !title || !link || !thumbnail) {
      throw new Error('YouTubeフィードに必要な動画情報がありません。');
    }

    return {
      id: videoId,
      title,
      url: link,
      thumbnail,
      published,
      dateLabel: toDateLabel(published),
    };
  });
}

try {
  const response = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'yuyukrid.github.io content updater' },
  });
  if (!response.ok) throw new Error(`YouTubeフィードの取得に失敗しました: ${response.status}`);

  const xml = await response.text();
  const videos = parseFeed(xml);
  if (videos.length < 3) throw new Error('表示に必要な動画数を取得できませんでした。');

  let existingData = null;
  try {
    existingData = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // 初回実行時は公開データが存在しないため、そのまま生成する。
  }

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
  console.log(`最新動画データを更新しました: ${videos.length}件`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
