---
title: "All Categories"
directory: false
---

# All Categories

A list of all tags on this site.

{% if collections.tagList %}
  <ul>
    {% for tag in collections.tagList | sort %}
      {% if tag != "posts" %}
        <li>
          <a href="/tags/{{ tag | slugify }}">{{ tag }}</a>
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% else %}
  <p>No categories yet!</p>
{% endif %}