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

# hdfs 扩展第三台nn
### 问题描述
  ambari默认只支持2台主备namenode,基于ambari插件方式完成第三台nn扩展

### 待完善文档 

