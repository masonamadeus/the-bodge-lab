---
title: "All Categories"
---

# All Categories

A list of all topics on this site.

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