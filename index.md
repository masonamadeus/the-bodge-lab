---
layout: layout.njk
title: "Home"
---

# Welcome to My Site

Here is a list of all my shitass trash:

<ul class="content-list">
{% for post in collections.posts | reverse %}
  <li>
    <a href="{{ post.url }}">{{ post.data.title }}</a>
  </li>
{% endfor %}
</ul>