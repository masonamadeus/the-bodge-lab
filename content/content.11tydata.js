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
 * Extracts ID from various YouTube URL formats
 */
function getYouTubeID(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}


/**
 * Extracts H1, Excerpt and Lists of Assets
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
      if (!assets[type].find(x => x.src === item.src)) {
          assets[type].push(item);
      }
  };

  // Helper to strip HTML tags, Nunjucks Shortcodes, and Markdown Images
  const cleanText = (str) => {
    if (!str) return "";
    return str
        .replace(/<[^>]*>?/gm, '')         // Strip HTML tags
        .replace(/\{[%\{].*?[%\}]\}/g, '') // Strip {% ... %} and {{ ... }}
        .replace(/!\[.*?\]\(.*?\)/g, '')   // Strip Markdown Images ![...](...)
        .replace(/`/g, '')                 // Strip Backticks
        .trim();
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

    // LINK TOKENS
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
    // Grab content from ANY inline token (h2, h3, p, li, etc)
    // UNLESS it belongs to the H1 (which we don't want in the description)
    if (t.type === 'inline') {
        const isH1Content = tokens[i-1]?.type === 'heading_open' && tokens[i-1]?.tag === 'h1';
        
        if (!isH1Content) {
             const cleaned = cleanText(t.content);
             if (cleaned && cleaned.length > 0) {
                 textContent += cleaned + " ";
             }
        }
    }
  }

  // 2. SHORTCODE SCAN (Aggressive Regex)
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

  const excerpt = textContent.slice(0, 155).trim() + (textContent.length > 155 ? "..." : "");

  // H1 Fallback
  if (!h1 && page && page.inputPath) {
      h1 = path.basename(page.inputPath, path.extname(page.inputPath));
  }

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
      const p = data.page.inputPath;

      if (!p.endsWith('.md')) return null;

      // Run the expensive parsing
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

    directoryUrl: data => {
      const dirNode = getDirectoryNode(data);
      if (dirNode) {
        return dirNode.webPath === '/' ? '/' : `${dirNode.webPath}/`;
      }
      return null;
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
        // Return empty index as well
        return { directories: [], files: [], pages: [], index: null };
      }

      const cleanUrl = dirNode.webPath === '/' ? '/' : `${dirNode.webPath}/`;

      let directories = [];
      let files = [];
      let pages = [];
      let indexPage = null; // Holder for the index

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
          
          const pageObj = {
            name: `${itemName}`, // You could add specific styling logic here if needed
            url: itemUrl,
            isCurrent: isCurrent
          };

          // Check if this is the index
          if (item.isIndex) {
            indexPage = pageObj;
          } else {
            pages.push(pageObj);
          }
        }
        else if (item.isMedia) {
          files.push({ 
            name: item.name, 
            url: `${cleanUrl}${item.name}.html`,
            downloadUrl: `${cleanUrl}${item.name}`,
         });
        }
      }

      // Return 'index' as a separate property
      return { directories, files, pages, index: indexPage };
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
      // 1. SETUP & HELPERS
      const meta = data.meta || { 
        url: "https://bodgelab.com/", 
        defaultImage: "/.config/ogimg.jpg", 
        defaultDescription: "A curious folder on the internet. Home of Mason Amadeus",
      };
      
      const toAbsolute = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        try { return new URL(url, meta.url).href; } 
        catch (e) { return path.join(meta.url, url); }
      };

      // 2. PARSE CONTENT (Get what we know exists)
      const parsed = data._pageData 
        || parseMarkdownData(data.page.rawInput, data.page) 
        || { h1: null, excerpt: null, assets: { images: [], videos: [], audio: [] } };

      // 3. DETECT STRATEGY (Find the best specific candidate, if any)
      let type = 'website';
      let media = null;
      let detectedImage = null; // Placeholder for content-found images

      // Strategy A: Manual Embed (Front Matter)
      if (data.share_embed) {
        const embedUrl = toAbsolute(data.share_embed);
        const ytId = getYouTubeID(data.share_embed);
        
        type = 'video.other';
        media = {
            mode: 'player',
            url: embedUrl,
            secure_url: embedUrl,
            mime: data.share_type || 'text/html',
            isYouTube: !!ytId
        };
        // If it's YouTube, we get a free image
        if (ytId) detectedImage = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
      }
      
      // Strategy B: Media Page (media.njk)
      else if (data.media && data.media.url) {
        const mediaUrl = toAbsolute(data.media.url);
        const mimeType = mime.lookup(mediaUrl) || 'application/octet-stream';

        if (data.media.type === 'video') {
            type = 'video.other';
            media = { mode: 'player', url: mediaUrl, secure_url: mediaUrl, mime: mimeType, width: data.media.width || 1280, height: data.media.height || 720 };
        } else if (data.media.type === 'audio') {
            type = 'music.song';
            media = { mode: 'audio', url: mediaUrl, secure_url: mediaUrl, mime: mimeType };
        } else if (data.media.type === 'image') {
            detectedImage = mediaUrl;
        }
      }

      // Strategy C: Content Auto-Detection (Markdown Body)
      else {
        // Video
        if (parsed.assets.videos.length > 0) {
            const vid = parsed.assets.videos[0];
            type = 'video.other';
            if (vid.type === 'youtube') {
                media = { mode: 'player', url: `https://www.youtube.com/embed/${vid.id}`, secure_url: `https://www.youtube.com/embed/${vid.id}`, mime: 'text/html', isYouTube: true, width: 1280, height: 720 };
                detectedImage = `https://i.ytimg.com/vi/${vid.id}/maxresdefault.jpg`;
            } else {
                const vidUrl = toAbsolute(vid.src);
                media = { mode: 'player', url: vidUrl, secure_url: vidUrl, mime: mime.lookup(vid.src) || 'video/mp4', width: 1280, height: 720 };
            }
        } 
        // Audio
        else if (parsed.assets.audio.length > 0) {
            const aud = parsed.assets.audio[0];
            const audUrl = toAbsolute(aud.src);
            type = 'music.song';
            media = { mode: 'audio', url: audUrl, secure_url: audUrl, mime: mime.lookup(aud.src) || 'audio/mpeg' };
        } 
        // Image
        else if (parsed.assets.images.length > 0) {
            detectedImage = toAbsolute(parsed.assets.images[0].src);
        }
      }

      // 4. APPLY DEFAULTS (The Waterfall)
      // Priority: Manual Override > Detected Content > System Default

      return {
        title: data.title || parsed.h1 || "The Bodge Lab",
        
        description: data.description || parsed.excerpt || meta.defaultDescription || "",
        
        url: toAbsolute(data.permalink || data.page.url),
        
        // share_poster overrides everything, then we check what we found, then default
        image: (data.share_poster ? toAbsolute(data.share_poster) : null) 
            || detectedImage 
            || toAbsolute(meta.defaultImage),
            
        type: type,
        media: media
      };
    },
  }
};