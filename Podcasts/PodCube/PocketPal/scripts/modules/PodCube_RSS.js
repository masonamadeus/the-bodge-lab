// PodCubeRSS.js - RSS Feed parser module

// NEED TO BRING THIS UP TO PARITY WITH THE JSON VERSION
// SPECIFICALLY DATE PARSING
// SPECIFICALLY ALSO GET <ITUNES:DURATION> TAGS (WHICH SHOW DURATION IN 00:00:00 FORMAT) AND CONVERT IT TO SECONDS

export class PodCubeRSS {
    constructor() {
        this.FEED_URL = "https://pinecast.com/feed/pc";
        this.lastUpdated = null;
        this.feed = null;
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    lookFor(desc, property) {
        const regex = `:: ${property}: (.*)`;
        const match = this.stripHtml(desc).match(new RegExp(regex));
        return match ? match[1].trim() : "NULL";
    }

    normalizeEpisode(item) {
        const description = item.querySelector("description").innerHTML;
        const titleRaw = item.querySelector("title").innerHTML;
        const titleSplit = titleRaw.split(/_(.+)/)[1];
        const title = titleSplit
            ? titleSplit.replace(/_/g, " ")
            : titleRaw.replace(/_/g, " ");
        
        // Parse date from description metadata
        const dateRaw = this.lookFor(description, "DATE");
        const dateParts = dateRaw.split("/");
        const date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);

        return new Episode({
            id: item.querySelector("guid").innerHTML,
            title: title,
            shortcode: titleRaw.split("_")[0]?.trim(),
            rawTitle: titleRaw,
            date: date,
            published: new Date(item.querySelector("pubDate").innerHTML),
            model: this.lookFor(description, "PODCUBE MODEL"),
            integrity: parseFloat(this.lookFor(description, "INTEGRITY")),
            origin: this.lookFor(description, "ORIGIN"),
            locale: this.lookFor(description, "LOCALE"), 
            region: this.lookFor(description, "REGION"),
            zone: this.lookFor(description, "ZONE"),
            planet: this.lookFor(description, "PLANET"),
            tags: this.lookFor(description, "TAGS").split(",").map(t => t.trim()),
            audioUrl: item.querySelector("enclosure").getAttribute("url"),
            duration: parseInt(item.querySelector("itunes\\:duration")?.innerHTML),
            size: parseInt(item.querySelector("enclosure")?.getAttribute("length")),
            description: description
        });
    }

    async fetchFeed() {
        // Return cached feed if it exists and is recent
        if (this.feed && this.lastUpdated && (new Date() - this.lastUpdated) < 900000) {
            console.log("PodCubeRSS: Using cached feed");
            return this.feed;
        }

        try {
            const res = await fetch(this.FEED_URL);
            if (!res.ok) throw new Error("Failed to fetch PodCube RSS feed");

            const text = await res.text();
            const doc = new window.DOMParser().parseFromString(text, "text/xml");
            const items = doc.querySelectorAll("item");
            
            const episodes = Array.from(items).map(item => this.normalizeEpisode(item));
            
            const metadata = {
                title: doc.querySelector("channel > title")?.textContent || "PodCube Feed",
                description: doc.querySelector("channel > description")?.textContent || "",
                icon: doc.querySelector("channel > image > url")?.textContent || "",
                author: doc.querySelector("channel > itunes\\:author")?.textContent || null,
                total: episodes.length
            };

            this.feed = new Feed(metadata, episodes);
            this.lastUpdated = new Date();
            return this.feed;

        } catch (error) {
            console.error("Error fetching RSS feed:", error);
            throw error;
        }
    }
}


// #endregion