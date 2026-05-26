import { Episode } from "../classes/PodCube_Episode.js";
import { Feed } from "../classes/PodCube_Feed.js";
// PodCubeJSON.js - JSON Feed parser module

export class PodCubeJSON {


    constructor() {
        this.FEED_URL = "https://pinecast.com/jsonfeed/pc";
    }

    stripHtml(html) {
        // Create a temporary element to decode HTML entities  
        const tempElement = document.createElement('textarea');
        tempElement.innerHTML = html;
        html = tempElement.value;
        // Remove any remaining HTML tags
        return html.replace(/<[^>]*>/g, '');
    }

    parseContentHtml(contentHtml) {

        const lines = this.stripHtml(contentHtml)
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith(":: "));

        const data = {};

        for (const line of lines) {
            const match = line.match(/^:: ([A-Z ]+): (.+)$/); //match podcube indicator of :: tag: value
            if (!match) continue;
            const key = match[1].toLowerCase().replace(/ /g, '_');
            let value = match[2].trim();

            if (key === "tags") {
                value = value.split(',').map(tag => tag.trim());
            }

            data[key] = value;
        }

        return data;
    } 

    normalizeEpisode(rawItem) {
        // Parse metadata from content_html first
        const meta = this.parseContentHtml(rawItem.content_html || "");

        // Create HTML entity decoder
        const decoder = document.createElement('textarea');

        // Parse title and shortcode
        const rawTitle = rawItem.title || "";
        const [code, ...titleParts] = rawTitle.split("_");
        let shortcode = code?.trim() || "";
        let title = titleParts.join(" ").trim();
        if (title.length === 0) {
            title = this.stripHtml(rawTitle);
        }
        

        // Decode any HTML entities in the title
        decoder.innerHTML = title;
        title = decoder.value || "Untitled";

        // Get the audio attachment info
        const attachment = rawItem.attachments?.[0] || {};

        // Return normalized episode data
        return new Episode({
            id: rawItem.id,
            title: title,
            shortcode: shortcode,
            rawTitle: rawTitle,
            date: meta.date,
            published: rawItem.date_published,
            model: meta.podcube_model,
            integrity: meta.integrity,
            origin: meta.origin,
            locale: meta.locale,
            region: meta.region,
            zone: meta.zone,
            planet: meta.planet,
            tags: meta.tags || [],
            description: rawItem.content_html,
            audioUrl: attachment.url,
            duration: attachment.duration_in_seconds,
            size: attachment.size_in_bytes
        });
    }

    async fetchFeed() {
        const res = await fetch(this.FEED_URL);
        if (!res.ok) throw new Error("Failed to fetch PodCube feed");
        const json = await res.json();
        const episodes = json.items.map(item => this.normalizeEpisode(item));
        const metadata = {
            title: json.title,
            description: json.description,
            icon: json.icon,
            author: json.authors?.[0]?.name || null,
            total: episodes.length
        };

        return new PodCube.Class.Feed(metadata, episodes);
    }
};
