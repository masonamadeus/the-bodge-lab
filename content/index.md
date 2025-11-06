---
layout: layout.njk
title: "Home"
---

# Welcome to My Shitass Site

Here is a list of all my ""content""":

<ul class="content-list">
{% for post in collections.posts | reverse %}
  <li>
    <a href="{{ post.url }}">{{ post.data.title }}</a>
    
    <div>
      {% for tag in post.data.tags %}
        <a href="/tags/{{ tag | slugify }}">{{ tag }}</a>
      {% endfor %}
    </div>
    </li>
{% endfor %}
</ul>