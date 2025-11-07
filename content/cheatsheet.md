
---
title: "Bodge Lab: Post Authoring Cheatsheet"
---

{% raw %}
## Front Matter Options


* `title` (Required)
    * Sets the main `<h1>` for the page and the "current" page name in the breadcrumbs. Must be in quotes.
    * **Example:** `title: My Awesome New Post`

* `download` (Optional)
    * Controls the "DOWNLOAD" button at the bottom of the page.
    * **Default:** `true` (button is shown, set by `content.11tydata.js`).
    * **To Hide:** `download: false`

* `hideDirectory` (Optional)
    * Controls the file listing section at the bottom of the page.
    * **Default:** `false` (directory listing is shown).
    * **To Hide:** `hideDirectory: true`

* `date` (Optional)
    * Overrides the "Last updated" date. If not set, the date is automatically pulled from Git history.
    * **Format:** `YYYY-MM-DD`
    * **Example:** `date: 2025-01-30`

* `tags` (Optional)
    * Adds the post to tag collections. This is used by the `categories.md` page.
    * **Format:** A YAML list.
    * **Example:**
        ```yaml
        tags:
          - REAPER
          - Nunjucks
          - Cool Stuff
        ```

* `layout` (Not Needed)
    * Only set for non-standard pages otherwise leave blank.


## Body Content (Standard Markdown)

* `# Heading 1` ( `title` front matter is `<h1>`, so it's best to start with `##`)
* `## Heading 2`
* `### Heading 3`
* `**Bold text**` or `*Italic text*`
* `[A link to Google](https://www.google.com)`
* `* Unordered list item 1`
* `1. Ordered list item 1`


## Embedding Media (Shortcode Macros)

Use these shortcodes (defined in `.eleventy.js`) to embed media without writing raw HTML.

**Key Rule for Paths:** All paths **must be in quotes** and **must be root-relative** (start with a `/`).

* **Correct:** `{% video "/Bug and Moss/my-video.mp4" %}`
* **Incorrect:** `{% video "my-video.mp4" %}`


### `{% image ... %}`
Embeds an image using the special "download overlay" container.

* **Usage:** `{% image "path/to/image.jpg", "alt text" %}`
* **Example:**
    ```nunjucks
    {% image "/Bug and Moss/bugandmosslogo2.jpg", "A clay logo of a bug" %}
    ```


### `{% video ... %}`
Embeds a video player.

* **Usage:** `{% video "path/to/video.mp4" %}`
* **Example:**
    ```nunjucks
    {% video "/REAPER/my_cool_video.mp4" %}
    ```

### `{% audio ... %}`
Embeds an audio player.

* **Usage:** `{% audio "path/to/audio.mp3" %}`
* **Example:**
    ```nunjucks
    {% audio "/Bug and Moss/my_theme_song.mp3" %}
    ```


### `{% embed ... %}`
Embeds other files (like `.pdf` or `.txt`) in a frame.

* **Usage:** `{% embed "path/to/file.pdf" %}`
* **Example:**
    ```nunjucks
    {% embed "/my-file.pdf" %}
    ```

{% endraw %}