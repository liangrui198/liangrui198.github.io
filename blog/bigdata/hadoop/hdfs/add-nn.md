---
layout: default
title:  扩展第三台nn
---

<link rel="stylesheet" href="/assets/blog.css">
<script>
function toggleBlogNav() {
  var nav = document.querySelector('.blog-nav');
  nav.classList.toggle('collapsed');
}
</script>
  <nav class="blog-nav">
    <button class="collapse-btn" onclick="toggleBlogNav()">☰</button>
    {% include blog_navigation.html items=site.data.blog_navigation %}
  </nav>

# hdfs EC实现和应用

  - 支持列表
  - 支持标题
  - 支持代码块

  ```python
  print('Hello hdfs ec!')
  ```

