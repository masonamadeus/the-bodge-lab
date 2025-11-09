---
title: "Cheatsheet"
---

{% raw %}
# Bodge Lab: Post Authoring Cheatsheet

This document covers how to create and format content for the Bodge Lab website.

## Front Matter Options

These are YAML options you can set at the very top of any `.md` file.

* `title` (Required)
    * Sets the main `<h1>` for the page and the "current" page name in the breadcrumbs. Must be in quotes.
    * **Example:** `title: "My Awesome New Post"`

* `download` (Optional)
    * Controls the "DOWNLOAD" button at the bottom of a post page. This button links to the raw `.md` file.
    * **Default:** `true` (button is shown).
    * **To Hide:** `download: false`

* `directory` (Optional)
    * Controls the file listing section at the bottom of the page.
    * **Default:** `true` (directory listing is shown).
    * **To Hide:** `directory: false`

* `date` (Optional)
    * Overrides the "Last updated" date.
    * **If not set, the date is automatically pulled from the file's Git commit history.**
    * **Format:** `YYYY-MM-DD`
    * **Example:** `date: "2025-01-30"`

* `tags` (Optional)
    * Adds the post to tag collections. This is used by the `categories.md` page.
    * **Format:** A YAML list.
    * **Example:**
        ```yaml
        tags:
          - "REAPER"
          - "Nunjucks"
          - "Cool Stuff"
        ```

---

## Body Content (Standard Markdown)

You can use any standard Markdown, including:

* `## Heading 2`
* `### Heading 3`
* `**Bold text**` or `*Italic text*`
* `[A link to Google](https://www.google.com)`
* `* Unordered list item 1`
* `1. Ordered list item 1`

---

## Embedding Media (Shortcode Macros)

Use these shortcodes to embed media without writing raw HTML.

**Key Rule for Paths:** All paths **must be in quotes** and **must be root-relative** (start with a `/`).

* **Correct:** `{% video "/Bug & Moss/my-video.webm" %}`
* **Incorrect:** `{% video "my-video.webm" %}`

### `{% image ... %}`

Embeds an image. You should use the path to your **original file** (like `.jpg` or `.png`). The build process will automatically convert this to `.webp` and serve that to the user.

* **Usage:** `{% image "path/to/image.jpg", "alt text" %}`
* **Example:**
    ```nunjucks
    {% image "/Bug & Moss/bugandmosslogo2.jpg", "A clay logo of a bug" %}
    ```

### `{% video ... %}`

Embeds a video player. This shortcode **requires a `.webm` file**. (See the "Media Workflow" section above).

* **Usage:** `{% video "path/to/video.webm" %}`
* **Example:**
    ```nunjucks
    {% video "/REAPER/my_cool_video.webm" %}
    ```

### `{% audio ... %}`

Embeds an audio player.

* **Usage:** `{% audio "path/to/audio.mp3" %}`
* **Example:**
    ```nunjucks
    {% audio "/Bug & Moss/my_theme_song.mp3" %}
    ```

### `{% embed ... %}`

Embeds other files (like `.pdf` or `.txt`) in a frame.

* **Usage:** `{% embed "path/to/file.pdf" %}`
* **Example:**
    ```nunjucks
    {% embed "/my-file.pdf" %}
    ```

### `{% yt ... %}`

Embeds a YouTube video player.

* **Usage:** `{% yt "YOUTUBE_ID_OR_FULL_URL" %}`
* **Example:**
    ```nunjucks
    {% yt "[https://www.youtube.com/watch?v=VLpc3Cf7FNY](https://www.youtube.com/watch?v=VLpc3Cf7FNY)" %}
    ```

### `{% grid ... %}`

Creates a multi-column layout. Separate your content for each column with ` `` `. You can specify column widths like `"half, half"` or `"one-third, two-thirds"`.

* **Usage:** `{% grid "half, half" %}` ...content for column 1... ` `` ` ...content for column 2... `{% endgrid %}`
* **Example:**
    ```nunjucks
    {% grid "half, half" %}
    
    This is the left column.
    
    ``
    
    This is the right column.
    
    {% endgrid %}
    ```

{% endraw %}