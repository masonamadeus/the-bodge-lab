---
layout: layout.njk
permalink: /tags/
title: Browse By Tags
directory: true
download: false
uid: 8d9044b3
---

## Browse By Tags

Click a tag to see all posts associated with it.

<ul class="tag-list">
{% for tag in collections.tagList %}
  <li><a href="/tags/{{ tag | slugify }}/">{{ tag }}</a></li>
{% endfor %}
</ul>
