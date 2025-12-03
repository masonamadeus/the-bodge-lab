---
uid: site-about
contentHash: 1f97d6dd
date: '2025-12-03T01:08:02.229Z'
title: BodgeLab Website Design Info
---
# I Always Wanna Know How Stuff Works

And I love seeing the inner workings of various design choices.

One of the most magical things about the flash era (and [Homestarrunner](https://homestarrunner.com) in particular) was how you could easily download a finished animation (.SWF file) and then deconstruct it in the flash editor to see how it was made.

I want to carry that spirit in the things I create, and try to share what I think are 'cool design choices'. Maybe this will help someone else make an even cooler website. Maybe nobody will read this. Maybe this will inspire someone to email me and tell me why my design choices are bad, actually. (I genuinely welcome any constructive criticism!!)

That said, here are some features of The Bodge Lab that I think are particularly neat.


___


## Unique Themes for Every User

When you first arrive at The Bodge Lab, a script runs that grabs some of your data.


```js
const uniqueString = [
        navigator.userAgent, navigator.language || (navigator.languages && navigator.languages[0]),
        (screen.width || 0) + 'x' + (screen.height || 0), new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 1, navigator.deviceMemory || 0,
        window.devicePixelRatio || 0, screen.colorDepth || 0,
        navigator.webdriver || false, (screen.availWidth || 0) + 'x' + (screen.availHeight || 0),
        navigator.maxTouchPoints || 0, navigator.doNotTrack || "unspecified",
        Intl.DateTimeFormat().resolvedOptions().timeZone || ""
      ].join('|');
```

**Specifically it attempts to grab:**

{%grid%}

- Your User-Agent string, which identifies your browser application.
- Your primary language preferences.
- The total screen resolution (width and height) of your display.
- Your time zone offset from UTC in minutes.
- The number of logical processor cores (threads) available on your system.
- The approximate RAM/memory available on your device.
- Your device's pixel ratio (screen pixel density).

``

- Your browser's vendor string.
- The color bit depth of your device..
- A flag indicating if youre browser is being controlled by automated software (like Selenium).
- The *available* screen resolution (width and height, excluding OS taskbars or docks).
- The maximum number of simultaneous touch contacts your device supports.
- Your Do Not Track (DNT) preference.
- Your IANA time zone identifier (e.g., "America/New_York").

{%endgrid%}

Not all of these work every time, but it's still pretty spooky how much of a fingerprint I can grab without your browser complaining about it, right?

Rather than using this for nefarious purposes like marketing, however, I just stick all of the results together into a big long string, and feed it to a simple hashing function that turns it into a number.

This number is then used to procedurally generate a handful of colors, and those colors then pass through a dodgy bit of code that tries to make sure text contrast is always within acceptable limits. (Otherwise, you could end up with a totally unreadable version of the website).

**What all this means is that when you first arrived here, I created a custom theme for you based on properties your device!**

It's not random, it's deterministic, so it's truly created *for you*. You're welcome.

If you don't like it, hey - you're already digging into the .config folder, so why not check out the [theme randomizer](../randomize%20theme) or make your own [custom theme](../customize%20theme).

___

# The Broken Links Problem

I built this site to look and act like a literal folder on a filesystem (which is what any website truly is anyway).

I did this for a couple reasons, but the biggest one was that I wanted it to be super duper absolutely EASY to add new content to my site. I thought to myself many times "I wish I could just push a folder up to the internet and that's it". I've now made that a reality using Eleventy. I'll probably do a better write up about Eleventy eventually. If I do that, I'll link it here.

Anyways, the flexibility and simplicity of sharing stuff in this folder-like way is great. The problem is that I intend this website to outlast any potential organizational strategy I might employ against its contents. I'll probably move stuff around as I see fit. This presents a problem when sharing links to things.

If links are intrinsically built around the folder hierarchy, and I change that, then any time I've shared a link publically I run the risk of breaking that link. Maybe it's in the shownotes of a podcast, maybe it's on the mention of a news article or something IDK. This concept is known as [Link Rot](https://en.wikipedia.org/wiki/Link_rot). It's also what makes NFTs so hilariously stupid, but that's a tangent I won't get into.

Anyways -- knowing that I might share a page publically and then MOVE it somewhere - I needed a way to avoid links breaking when that happened. I came up with two solutions.

## Solution #1: Smart-ish 404 Routing

There's a trick for using your 4-0-4 page as a router for a single-page static site. You basically host your index page as your 4-0-4, and have scripts that grab the url and process it however you want. This way, you can pass any kind of information you can store in a URL into your single-page app really easily.

Because the 4-0-4 gets served whenever a page is requested that doesn't exist, you'll always get served your index. Voila! Neat, and clever, and I love it. It's a trick I'm abusing for the brand new PodCube™ website that isn't done yet.

I didn't use that here, because this isn't a single page site, but I mention this trick because it inspired what I HAVE done for the 4-0-4 page here at The Bodge Lab.

If you try to go to a page that doesn't exist on this site, the 404 will automagically perform a search using keywords extracted from the bad URL - and if there is only ONE good result, it'll redirect you there right away! Otherwise it shows you a search result page.

Go ahead, try it! Click the URL bar and add some words to the end, then hit enter. If you want something that I know will get you a result, you can type "farting".

## Solution #2: My Own Bodgey Shortlinking/Permalinking System

By default every page gets built at an address that reflects its position in the folder hierarchy. You can probably see that right now if you look at the URL bar.

As I spent a lot of text explaining, that's a problem. 

In comes the "share" button you'll see at the bottom of this post!

I built a little function that will dynamically generate static links for each page. I originally had it replacing the URL with these static links in case someone copy/pastes a link to share that way... but it caused some downstream issues with pathing that have been annoying to resolve. I might go at it again sometime.

Anyways the way it works is that those automatically generated links will always point towards that specific page, and they can be overridden in the 'front matter' of any post (by setting a custom uid field).

The effect is that it gives me a chance to deliberately create a shortlink for any page just by adding a 'uid' to the top, but also if I have a page that's been up WITHOUT one I can copy that permalink *before* I move the page, stick it in the uid at the top, and then move the page however I'd like and the link will stay alive.

It remains to be seen how effective this strategy is, I'm very open to other ideas.

___

# Download EVERYTHING

I built download links into the layout at every possible opportunity. I want this to really feel like a cross between a folder on someone's computer, a blog, and a github repository.

To that end, every post has a download button to grab the markdown source of the post (a nice clean copy!).

Every media page has a download button, every asset has a download button. Download it all. The whole site is up on github, though some larger assets are hosted at assets.bodgelab.com using Cloudflare R2. Their free tier is super generous, and also they have great prices on domains.

I'm not sponsored by Cloudflare but I would like to be lol.

___

# Dynamic Favicons

I've got a script that dynamically generates a random favicon every time you load a page. Maybe you noticed it keeps changing? I just think that's fun.

```js
(function() { // 1. Config
    const size = 5;
    // 2. Color Generation (HSL)
    const hue = Math.floor(Math.random() * 360);
    const colorLight = `hsl(${hue}, 80%, 40%)`; // Darker for Light Mode
    const colorDark = `hsl(${hue}, 80%, 70%)`;
    // Lighter for Dark Mode
    // 3. Generate Pattern (Mirrored + Random Opacity)
    let rects = '';
    for (let x = 0; x < Math.ceil(size / 2); x++) {
        for (let y = 0; y < size; y++) {
            if (Math.random() > 0.5) { // Random Opacity (The "Decayed" Look)
                const alpha = (Math.random() * 0.6 + 0.4).toFixed(2);
                // Draw Left Pixel
                rects += `<rect x="${x}" y="${y}" width="1" height="1" opacity="${alpha}" />`;
                // Draw Mirror Pixel (if not center column)
                if (x < Math.floor(size / 2)) {
                    rects += `<rect x="${
                                    size - 1 - x
                                }" y="${y}" width="1" height="1" opacity="${alpha}" />`;
                }
            }
        }
    }
    // 4. Construct SVG (Solid Fill + Dark Mode Support)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
            <style>
                rect { fill: ${colorLight}; }
                @media (prefers-color-scheme: dark) {
                    rect { fill: ${colorDark}; } 
                }
            </style>
            ${rects}
        </svg>`;
    // 5. Inject
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.head.appendChild(link);
})();
```
