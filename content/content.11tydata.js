const path = require('path');
const MarkdownIt = require('markdown-it');
const mime = require('mime-types');

const md = new MarkdownIt;

// #region ORIGINAL HELPERS

/**
 * Normalizes a web path from data.page.url to be used as a consistent lookup key.
 */
function normalizeLookupKey(webPath) {
  let key = path.normalize(decodeURIComponent(webPath.replace(/&amp;/g, '&'))).replace(/\\/g, '/');
  if (key.length > 1 && key.endsWith('/')) {
    key = key.slice(0, -1);
  }
  return key || '/';
}

/**
 * Creates a URL-friendly "slug" from a string.
 */
function slugify(str) {
  if (!str) return 'page';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Generates a simple hash from a string (for collision-proofing).
 */
function getSeed(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Correctly finds the directory node that should be listed.
 */
function getDirectoryNode(data) {
  const pageKey = normalizeLookupKey(data.page.url);

  // CASE 1: Auto-generated directory page
  if (data.page.inputPath.endsWith("autoDirectory.njk")) {
    return data.filetree.lookupByPath[pageKey];
  }

  // CASE 2: index.md page
  if (data.page.inputPath.endsWith("index.md")) {
    return data.filetree.lookupByPath[pageKey];
  }

  // CASE 3: Standard File
  const parentKey = normalizeLookupKey(path.dirname(pageKey));
  return data.filetree.lookupByPath[parentKey];
}

// #endregion

// #region NEW SEO HELPERS

/**
 * Ensures a URL is absolute (Required for OpenGraph)
 */
function toAbsoluteUrl(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return path.join(baseUrl, url);
  }
}

/**
 * Extracts ID from various YouTube URL formats
 */
function getYouTubeID(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

/**
 * Resolves relative paths to the current page
 */
function resolvePath(src, pageInputPath) {
    if (!src || src.startsWith('http') || src.startsWith('/')) return src;
    
    // Attempt to resolve relative to the file
    // Note: In 11ty, relative paths in data files can be tricky. 
    // This logic assumes a standard structure or that you want the web-path.
    // Given your original logic used a complex resolve, we can stick to a simpler pass-through
    // if we trust the markdown parser, OR re-implement the path.resolve logic if needed.
    // For now, we will return it as-is if it looks like a relative path, and let toAbsoluteUrl handle the domain.
    return src;
}

/**
 * Extracts H1, Clean Excerpt, and Assets
 */
function parseMarkdownData(content, page) {
  if (!content) return { h1: null, excerpt: null, assets: { images: [], videos: [], audio: [] } };

  // 1. CLEANUP FOR EXCERPT: Remove Nunjucks tags BEFORE parsing text to avoid leaking code into summaries
  // This Regex removes {% ... %} and {{ ... }} blocks entirely from the text-processing view
  const cleanContent = content
      .replace(/\{%[^%]*%\}/g, '') 
      .replace(/\{\{[^}]*\}\}/g, '');

  const tokens = md.parse(content, {}); // We still parse original content for Assets
  const textTokens = md.parse(cleanContent, {}); // We parse clean content for Text
  
  let h1 = null;
  let textContent = "";
  
  // Asset Collections
  const assets = { images: [], videos: [], audio: [] };
  const videoExts = ['.mp4', '.mov', '.mkv', '.webm'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];

  const addAsset = (type, item) => {
      if (!assets[type].find(x => x.src === item.src)) assets[type].push(item);
  };

  // 1. EXTRACT ASSETS (From Original Content)
  for (const t of tokens) {
    // H1 Detection
    if (!h1 && t.type === 'heading_open' && t.tag === 'h1') {
        // We peek ahead in the token stream for the content
        const next = tokens[tokens.indexOf(t) + 1];
        if (next && next.type === 'inline') h1 = next.content;
    }
    // Standard Markdown Images
    if (t.type === 'image') {
      const src = t.attrGet('src');
      if (src) addAsset('images', { src: src });
    }
    // Raw Links (Video/Audio auto-detect)
    if (t.type === 'link_open') {
        const href = t.attrGet('href');
        if (href) {
            const ext = path.extname(href).toLowerCase();
            if (videoExts.includes(ext)) addAsset('videos', { src: href, type: 'local' });
            else if (audioExts.includes(ext)) addAsset('audio', { src: href });
            else {
                const ytId = getYouTubeID(href);
                if (ytId) addAsset('videos', { src: href, type: 'youtube', id: ytId });
            }
        }
    }
  }

  // 2. SHORTCODE SCAN (Aggressive Regex on Original Content)
  const imgMatches = [...content.matchAll(/\{%\s*image\s*["']([^"']+)["']/g)];
  imgMatches.forEach(m => addAsset('images', { src: m[1] }));

  const vidMatches = [...content.matchAll(/\{%\s*video\s*["']([^"']+)["']/g)];
  vidMatches.forEach(m => addAsset('videos', { src: m[1], type: 'local' }));

  const audMatches = [...content.matchAll(/\{%\s*audio\s*["']([^"']+)["']/g)];
  audMatches.forEach(m => addAsset('audio', { src: m[1] }));

  const ytMatches = [...content.matchAll(/\{%\s*yt\s*["']([^"']+)["']/g)];
  ytMatches.forEach(m => {
    const id = getYouTubeID(m[1]) || m[1];
    addAsset('videos', { src: `https://www.youtube.com/watch?v=${id}`, type: 'youtube', id });
  });

  // 3. GENERATE CLEAN EXCERPT (From Cleaned Content)
  // We simply extract all text nodes from the "clean" parse
  textTokens.forEach(t => {
      if (t.type === 'inline') textContent += t.content + " ";
  });

  const excerpt = textContent.replace(/\s+/g, ' ').trim().slice(0, 200).trim() + (textContent.length > 200 ? "..." : "");

  return { h1, excerpt, assets };
}

// #endregion

module.exports = {
  layout: "layout.njk",
  download: true,
  directory: true,

  eleventyComputed: {

    // --- Parse content once ---
    _pageData: data => {
      // Skip running on special pages that don't have markdown content to parse
      if (data.page.inputPath.endsWith("media.njk") ||
        data.page.inputPath.endsWith("autoDirectory.njk") ||
        !data.page.rawInput ||
        !data.page.rawInput.trim()) {
        return null;
      }

      // Run the expensive parsing once
      return parseMarkdownData(data.page.rawInput, data.page);
    },

    uid: data => {
      // 1. Use existing UID if present in front matter
      if (data.uid) return slugify(data.uid);

      // 2. Ignore system files
      if (data.page.url === "/" ||
        (data.page.inputPath.endsWith("media.njk") && data.media) ||
        data.page.inputPath.endsWith("autoDirectory.njk") ||
        data.page.inputPath.includes("tags.njk") ||
        data.page.inputPath.includes("share.njk") ||
        data.page.inputPath.includes("search.json") ||
        data.page.inputPath.includes("shortlinks.json") ||
        data.page.inputPath.includes("404")) {
        return null;
      }

      // 3. Generate Short UID: Filename + Hash
      const filename = path.basename(data.page.inputPath, path.extname(data.page.inputPath));
      const slug = slugify(filename); 
      const hash = getSeed(data.page.inputPath).toString(36).slice(-5);

      return `${slug}-${hash}`;
    },

    permalink: data => {
      if (data.permalink) {
        return data.permalink;
      }
      return undefined;
    },

    title: data => {
      // 1. Check for a hard-coded title in front matter.
      if (data.title) {
        return data.title;
      }

      // 2. Check if this is a MEDIA PAGE (from media.njk)
      if (data.page.inputPath.endsWith("media.njk") && data.media) {
        return data.media.name;
      }

      // 3. Check if this is an AUTO-DIRECTORY PAGE (from autoDirectory.njk)
      if (data.page.inputPath.endsWith("autoDirectory.njk")) {
        const dirNode = getDirectoryNode(data);
        if (dirNode) {
          return dirNode.title || dirNode.name;
        }
        return "Directory"; 
      }

      // 4. Use the pre-calculated H1
      if (data._pageData && data._pageData.h1) {
        return data._pageData.h1;
      }

      // 5. As a last resort, use the site default.
      return "The Bodge Lab";
    },

    directoryTitle: data => {
      const dirNode = getDirectoryNode(data);
      if (dirNode) {
        return dirNode.title || dirNode.name;
      }
      return "Directory"; 
    },

    parentUrl: data => {
      if (data.page.url === "/") {
        return null;
      }
      let my_url = data.page.url;
      if (my_url.length > 1 && my_url.endsWith('/')) {
        my_url = my_url.substring(0, my_url.length - 1);
      }
      return my_url.substring(0, my_url.lastIndexOf('/')) + '/';
    },
    
    directoryParentUrl: data => {
      const dirNode = getDirectoryNode(data);
      if (!dirNode || dirNode.webPath === '/' || dirNode.webPath === '') {
        return null;
      }
      let my_url = dirNode.webPath;
      if (my_url.length > 1 && my_url.endsWith('/')) {
        my_url = my_url.slice(0, -1);
      }
      return my_url.substring(0, my_url.lastIndexOf('/')) + '/';
    },

    directoryContents: data => {
      const dirNode = getDirectoryNode(data);

      if (!dirNode || !dirNode.children) {
        return { directories: [], files: [], pages: [] };
      }

      const cleanUrl = dirNode.webPath === '/' ? '/' : `${dirNode.webPath}/`;

      let directories = [];
      let files = [];
      let pages = [];

      const mainPageUrl = normalizeLookupKey(data.page.url);

      for (const item of dirNode.children) {
        if (item.isDirectory) {
          directories.push({ name: item.name, url: `${cleanUrl}${item.name}/` });
        }
        else if (item.isTemplate) {
          const baseName = path.basename(item.name, item.ext);
          let itemUrl;
          if (item.isIndex) {
            itemUrl = dirNode.webPath;
            if (itemUrl === '') itemUrl = '/'; 
            if (itemUrl !== '/' && !itemUrl.endsWith('/')) {
              itemUrl += '/'; 
            }
          } else {
            itemUrl = item.permalink || `${cleanUrl}${baseName}/`;
          }

          const itemName = item.title || baseName;
          const isCurrent = (normalizeLookupKey(itemUrl) === mainPageUrl);

          pages.push({
            name: `» ${itemName}`,
            url: itemUrl,
            isCurrent: isCurrent
          });
        }
        else if (item.isMedia) {
          files.push({ 
            name: item.name, 
            url: `${cleanUrl}${item.name}.html`,
            downloadUrl: `${cleanUrl}${item.name}`,
         });
        }
      }

      return { directories, files, pages };
    },

    download_filename: data => {
      if (data.media && data.media.url) {
        return path.basename(data.media.url);
      }
      if (data.page && data.page.inputPath) {
        const ext = path.extname(data.page.inputPath);
        let baseName;
        if (data.title) {
          baseName = data.title;
        }
        else if (data._pageData && data._pageData.h1) {
          baseName = data._pageData.h1;
        }
        else {
          baseName = path.basename(data.page.inputPath, ext);
        }
        return baseName.trim().replace(/[/\\]/g, '-') + ext;
      }
      return "file";
    },

    seo: data => {
      const meta = data.meta || { url: "https://bodgelab.com/", defaultImage: "/.config/ogimg.jpg", defaultDescription: "A curious folder on the internet. Home of Mason Amadeus" };
      const page = data.page;
      
      // Helper to force absolute URLs
      const toAbsolute = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        try { return new URL(url, meta.url).href; } 
        catch (e) { return path.join(meta.url, url); }
      };

      // 1. BASELINE DEFAULTS
      let seo = {
        title: data.title || "The Bodge Lab",
        description: data.description || meta.defaultDescription || "",
        url: toAbsolute(data.permalink || page.url),
        image: toAbsolute(meta.defaultImage),
        type: 'website',
        // Media Object: { mode: 'player'|'image', url: '', secure_url: '', mime: '', width: '', height: '' }
        media: null 
      };

      // 2. EXTRACTED DATA (From the helper we fixed in Step 1)
      const parsed = data._pageData || { excerpt: null, assets: { images: [], videos: [], audio: [] } };
      
      // If no manual description, use the clean excerpt
      if (!seo.description && parsed.excerpt) {
        seo.description = parsed.excerpt;
      }

      // 3. DETECT MEDIA STRATEGY
      // We check sources in priority order: FrontMatter > Media Page > Content Body

      // --- STRATEGY A: Explicit Front Matter (share_embed / share_poster) ---
      if (data.share_embed) {
        const embedUrl = toAbsolute(data.share_embed);
        const isYt = Boolean(getYouTubeID(data.share_embed));
        
        seo.type = 'video.other';
        seo.media = {
            mode: 'player',
            url: embedUrl,
            secure_url: embedUrl,
            mime: data.share_type || 'text/html', // 'text/html' triggers iframes in Twitter cards
            isYouTube: isYt
        };
        if (data.share_poster) seo.image = toAbsolute(data.share_poster);
        else if (isYt) seo.image = `https://i.ytimg.com/vi/${getYouTubeID(data.share_embed)}/maxresdefault.jpg`;
      }

      // --- STRATEGY B: "Media" Page Type (media.njk) ---
      else if (data.media && data.media.url) {
        const mediaUrl = toAbsolute(data.media.url);
        const mimeType = mime.lookup(mediaUrl) || 'application/octet-stream';

        if (data.media.type === 'video') {
            seo.type = 'video.other';
            seo.media = {
                mode: 'player',
                url: mediaUrl,
                secure_url: mediaUrl,
                mime: mimeType,
                width: data.media.width || 1280,
                height: data.media.height || 720
            };
        } else if (data.media.type === 'audio') {
            seo.type = 'music.song';
            seo.media = {
                mode: 'audio',
                url: mediaUrl,
                secure_url: mediaUrl,
                mime: mimeType
            };
        } else if (data.media.type === 'image') {
            seo.image = mediaUrl;
        }
      }

      // --- STRATEGY C: Content Auto-Detection ---
      else {
        // Check for Videos in content
        if (parsed.assets.videos.length > 0) {
            const vid = parsed.assets.videos[0];
            seo.type = 'video.other';

            if (vid.type === 'youtube') {
                seo.media = {
                    mode: 'player',
                    url: `https://www.youtube.com/embed/${vid.id}`,
                    secure_url: `https://www.youtube.com/embed/${vid.id}`,
                    mime: 'text/html',
                    isYouTube: true,
                    width: 1280, 
                    height: 720
                };
                seo.image = `https://i.ytimg.com/vi/${vid.id}/maxresdefault.jpg`;
            } else {
                const vidUrl = toAbsolute(vid.src);
                seo.media = {
                    mode: 'player',
                    url: vidUrl,
                    secure_url: vidUrl,
                    mime: mime.lookup(vid.src) || 'video/mp4',
                    width: 1280,
                    height: 720
                };
            }
        }
        // Check for Audio in content
        else if (parsed.assets.audio.length > 0) {
            const aud = parsed.assets.audio[0];
            const audUrl = toAbsolute(aud.src);
            seo.type = 'music.song';
            seo.media = {
                mode: 'audio',
                url: audUrl,
                secure_url: audUrl,
                mime: mime.lookup(aud.src) || 'audio/mpeg'
            };
        }
        // Check for Images in content (if we don't already have a better one)
        else if (parsed.assets.images.length > 0 && (!seo.image || seo.image === toAbsolute(meta.defaultImage))) {
            seo.image = toAbsolute(parsed.assets.images[0].src);
        }
      }

      return seo;
    },
  }
};