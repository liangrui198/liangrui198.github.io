---
layout: default
title: Markdown 博客示例
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

# 这是一个 Markdown 博客页面
 这里的内容支持 **Markdown** 语法，可以像普通 md 文件一样书写。

  - 支持列表
  - 支持标题
  - 支持代码块

  ```python
  print('Hello Markdown!')
  ```

