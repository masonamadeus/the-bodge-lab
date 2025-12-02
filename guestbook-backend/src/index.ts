/**
 * Cloudflare Worker for Guestbook
 * Features:
 * 1. Tier 1: External List (Exact Match Only - Safe for "Class", "Pineapple")
 * 2. Tier 2: Nuclear List (Partial Match - Catches "dumbsh*t", "slur-word")
 * 3. Database Backup
 */

export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
}

const BLOCKLIST_URL = "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en";

// --- TIER 2: NUCLEAR LIST ---
// Words here will be censored even if they are inside another word.
// e.g. "shit" here will turn "dickshitter" into "dick****ter"
// WARNING: Do not put short common syllables here (like "ass" or "hell") or you will break "class" and "hello".
const NUCLEAR_LIST = [
  "nigg",
  "fuck",
  "fagg",
  "retard",
  "tranny",
  "kike",
  "dyke",
  "whore",
];

let memoryCache: Set<string> | null = null;

async function getBlocklist(env: Env): Promise<Set<string>> {
  if (memoryCache) return memoryCache;

  try {
    const response = await fetch(BLOCKLIST_URL);
    if (response.ok) {
      const text = await response.text();
      env.DB.prepare(
        "INSERT INTO config_store (key, value) VALUES ('blocklist', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(text).run().catch(e => console.error("Backup save failed", e));
      return processList(text);
    } else {
      throw new Error("Live list error");
    }
  } catch (err) {
    const backup = await env.DB.prepare("SELECT value FROM config_store WHERE key = 'blocklist'").first();
    if (backup && backup.value) return processList(backup.value as string);
    return new Set();
  }
}

function processList(text: string): Set<string> {
    const words = text.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    memoryCache = new Set(words);
    return memoryCache;
}

async function sanitize(text: string, env: Env): Promise<string> {
  if (!text) return "";
  const blocklist = await getBlocklist(env);
  const parts = text.split(/([^a-zA-Z0-9]+)/);

  return parts.map(part => {
    const lower = part.toLowerCase();
    for (const badWord of NUCLEAR_LIST) {
      if (lower.includes(badWord)) {
        const regex = new RegExp(badWord, 'gi');
        return part.replace(regex, '*'.repeat(badWord.length));
      }
    }
    if (blocklist.has(lower)) return '*'.repeat(part.length);
    return part;
  }).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- GET (Now with Offset!) ---
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        // Get offset from URL, default to 0
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const { results } = await env.DB.prepare(
          "SELECT name, message, created_at FROM guestbook_entries ORDER BY created_at DESC LIMIT 50 OFFSET ?"
        ).bind(offset).all();
        
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response("Error fetching entries", { status: 500, headers: corsHeaders });
      }
    }

    // --- POST ---
    if (request.method === "POST") {
      try {
        const data = await request.json() as any;
        const { name, message, token } = data;

        if (!name || !message || !token) return new Response("Missing fields", { status: 400, headers: corsHeaders });
        if (name.length > 50 || message.length > 500) return new Response("Text too long", { status: 400, headers: corsHeaders });

        const cleanName = await sanitize(name, env);
        const cleanMessage = await sanitize(message, env);

        const ip = request.headers.get("CF-Connecting-IP");
        const formData = new FormData();
        formData.append("secret", env.TURNSTILE_SECRET);
        formData.append("response", token);
        formData.append("remoteip", ip || "");

        const turnstileResult = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          body: formData,
          method: "POST",
        });

        const outcome = await turnstileResult.json() as any;
        if (!outcome.success) return new Response("Bot verification failed.", { status: 403, headers: corsHeaders });

        await env.DB.prepare(
          "INSERT INTO guestbook_entries (name, message, created_at, ip_address) VALUES (?, ?, ?, ?)"
        ).bind(cleanName, cleanMessage, Date.now(), ip).run();

        return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });

      } catch (err) {
        return new Response("Server Error", { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};