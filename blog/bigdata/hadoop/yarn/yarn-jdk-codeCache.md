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

# jdk8存在codeCache bug，这里介绍调试优化过程，和优化后的指标提升

### 待完善文档 


