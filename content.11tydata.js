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
 * UPGRADED: Extracts H1, Excerpt and Lists of Assets
 */
function parseMarkdownData(content, page) {
  if (!content) return { h1: null, excerpt: null, assets: { images: [], videos: [], audio: [] } };

  const tokens = md.parse(content, {});
  
  let h1 = null;
  let textContent = "";
  
  // Asset Collections
  const assets = {
      images: [],
      videos: [],
      audio: []
  };

  const videoExts = ['.mp4', '.mov', '.mkv', '.webm'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];

  // Helper to add asset if unique
  const addAsset = (type, item) => {
      // Very basic duplicate check based on src
      if (!assets[type].find(x => x.src === item.src)) {
          assets[type].push(item);
      }
  };

  // 1. TOKEN SCAN
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // H1 (Critical for Title/Download Filename)
    if (!h1 && t.type === 'heading_open' && t.tag === 'h1' && tokens[i+1]?.type === 'inline') {
        h1 = tokens[i+1].content;
    }

    // IMAGE TOKENS
    if (t.type === 'image') {
      const src = t.attrGet('src');
      if (src) addAsset('images', { src: src });
    }

    // LINK TOKENS (Check for raw media links or YouTube)
    if (t.type === 'link_open') {
        const href = t.attrGet('href');
        if (href) {
            const ext = path.extname(href).toLowerCase();
            
            if (videoExts.includes(ext)) {
                addAsset('videos', { src: href, type: 'local' });
            } else if (audioExts.includes(ext)) {
                addAsset('audio', { src: href });
            } else {
                const ytId = getYouTubeID(href);
                if (ytId) {
                    addAsset('videos', { src: href, type: 'youtube', id: ytId });
                }
            }
        }
    }
    
    // EXCERPT GENERATION
    if (t.type === 'inline' && tokens[i-1]?.type === 'paragraph_open') {
        textContent += t.content + " ";
    }
  }

  // 2. SHORTCODE SCAN (Aggressive Regex)
  
  // Images {% image "..." %}
  const imgMatches = [...content.matchAll(/\{%\s*image\s*["']([^"']+)["']/g)];
  imgMatches.forEach(m => addAsset('images', { src: m[1] }));

  // Local Video {% video "..." %}
  const vidMatches = [...content.matchAll(/\{%\s*video\s*["']([^"']+)["']/g)];
  vidMatches.forEach(m => addAsset('videos', { src: m[1], type: 'local' }));

  // Audio {% audio "..." %}
  const audMatches = [...content.matchAll(/\{%\s*audio\s*["']([^"']+)["']/g)];
  audMatches.forEach(m => addAsset('audio', { src: m[1] }));

  // YouTube Shortcode {% yt "..." %}
  const ytMatches = [...content.matchAll(/\{%\s*yt\s*["']([^"']+)["']/g)];
  ytMatches.forEach(m => {
    const id = getYouTubeID(m[1]) || m[1];
    addAsset('videos', { src: `https://www.youtube.com/watch?v=${id}`, type: 'youtube', id });
  });

  const excerpt = textContent.slice(0, 155).trim() + (textContent.length > 155 ? "..." : "");

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

    // --- REPLACED SEO LOGIC ---
    seo: data => {
      const meta = data.meta || { url: "https://bodgelab.com/", defaultImage: "", defaultDescription: "" };
      const page = data.page;

      const siteName = meta.siteName || "The Bodge Lab";

      // 1. Initial Defaults (title formatted to include site name)
      let seoData = {
      title: data.title ? `${data.title} — ${siteName}` : siteName,
      description: data.description || meta.defaultDescription || "",
      image: data.image || meta.defaultImage || null,
      url: toAbsoluteUrl(data.permalink || page.url, meta.url),
      type: 'website',
      media: null // Will hold structure { type: 'video'|'audio', url: '', embedUrl: '', ... }
      };

      // 2. Extract Data from Parser
      const assets = (data._pageData && data._pageData.assets) ? data._pageData.assets : { images:[], videos:[], audio:[] };
      const excerpt = (data._pageData && data._pageData.excerpt) ? data._pageData.excerpt : null;

      // 3. Description Fallback
      if (!data.description && excerpt) {
      seoData.description = excerpt;
      }

      // --- FRONT-MATTER SHARE OVERRIDES (HIGHEST PRIORITY) ---
      // Authors can explicitly force share behavior per-page using front-matter keys:
      //   share_embed: URL to use as embed/player (absolute or relative)
      //   share_poster: image to use as poster/preview
      //   share_type: "video"|"audio"|"youtube" (optional hint)
      if (data.share_poster) {
        seoData.image = toAbsoluteUrl(data.share_poster, meta.url);
      }

      if (data.share_embed) {
        const embedUrl = toAbsoluteUrl(data.share_embed, meta.url);
        const mimeType = mime.lookup(data.share_embed) || 'text/html';
        const inferredType = data.share_type || (mimeType.startsWith('audio') ? 'audio' : (mimeType.startsWith('video') ? 'video' : 'video'));
        const ytId = getYouTubeID(data.share_embed);

        seoData.media = {
          url: embedUrl,
          secure_url: embedUrl,
          embedUrl: embedUrl,
          type: inferredType,
          mime: mimeType,
          isYouTube: Boolean(ytId)
        };

        if (inferredType === 'video') seoData.type = 'video.other';
        if (inferredType === 'audio') seoData.type = 'music.song';

        // If the embed is a YouTube URL but user didn't provide an id, normalize the image
        if (ytId && !data.share_poster) {
          seoData.image = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
        }

        // Highest priority: return now with overrides applied
        seoData.image = toAbsoluteUrl(seoData.image || meta.defaultImage, meta.url);
        seoData.url = toAbsoluteUrl(seoData.url || page.url || '/', meta.url);
        return seoData;
      }

      // --- ASSET PRIORITIZATION ---

      // Priority A: Front Matter Override (e.g. Generated Media Pages)
      if (data.media && data.media.url) {
       const mediaUrl = data.media.url;
       const absUrl = toAbsoluteUrl(mediaUrl, meta.url);
       const mimeType = mime.lookup(mediaUrl) || 'application/octet-stream';

       if (data.media.type === 'video') {
         seoData.media = {
           url: absUrl,
           secure_url: absUrl,
           embedUrl: absUrl,
           type: 'video',
           mime: mimeType,
           width: data.media.width || 1280,
           height: data.media.height || 720
         };
         seoData.type = 'video.other';
       } else if (data.media.type === 'audio') {
         seoData.media = {
           url: absUrl,
           secure_url: absUrl,
           type: 'audio',
           mime: mimeType
         };
         seoData.type = 'music.song';
       } else if (data.media.type === 'image') {
         seoData.image = absUrl;
       }
      }
      // Priority B: Content Detection
      else {
        // 1. VIDEO (Highest Priority)
        if (assets.videos.length > 0) {
          const vid = assets.videos[0];

          if (vid.type === 'youtube') {
            const embed = `https://www.youtube.com/embed/${vid.id}`;
            seoData.media = {
              url: `https://www.youtube.com/watch?v=${vid.id}`,
              secure_url: `https://www.youtube.com/watch?v=${vid.id}`,
              embedUrl: embed,
              type: 'video',
              mime: 'text/html',
              width: vid.width || 1280,
              height: vid.height || 720,
              isYouTube: true
            };
            // Use highest quality YT thumbnail available as preview
            seoData.image = `https://i.ytimg.com/vi/${vid.id}/maxresdefault.jpg`;
            seoData.type = 'video.other';
          } else {
            // Local Video
            const absUrl = toAbsoluteUrl(vid.src, meta.url);
            seoData.media = {
              url: absUrl,
              secure_url: absUrl,
              embedUrl: absUrl,
              type: 'video',
              mime: mime.lookup(vid.src) || 'video/mp4',
              width: vid.width || 1280,
              height: vid.height || 720
            };
            seoData.type = 'video.other';
          }
        }

        // 2. AUDIO (If no video found)
        else if (assets.audio.length > 0) {
          const aud = assets.audio[0];
          const absUrl = toAbsoluteUrl(aud.src, meta.url);

          seoData.media = {
            url: absUrl,
            secure_url: absUrl,
            type: 'audio',
            mime: mime.lookup(aud.src) || 'audio/mpeg'
          };
          seoData.type = 'music.song';
        }

        // 3. IMAGE selection (Front matter overrides content images)
        if (!seoData.image || seoData.image === meta.defaultImage) {
          if (data.image) {
            seoData.image = data.image;
          } else if (assets.images.length > 0) {
            seoData.image = assets.images[0].src;
          }
        }
      }

      // Final URL cleanup and fallbacks
      seoData.image = toAbsoluteUrl(seoData.image || meta.defaultImage, meta.url);
      seoData.url = toAbsoluteUrl(seoData.url || page.url || '/', meta.url);

      return seoData;
    },
  }
};