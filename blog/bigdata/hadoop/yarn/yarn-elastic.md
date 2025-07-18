---
layout: default
title:  Yarn超卖内存实现
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

# Yarn超卖内存实现 
## 提升集群内存利用率15%,超卖内存20TB+的实践

### 问题描述

当前观察nodeManger物理机实际内存利用率，还存在一定的浪费（spark 在分配置内存的时候，实际jvm存在没有用满的情况），存在一定的内存碎片。
监控观查（可以在几秒内内存是可以用到100%利用率的）大约平均在60%-80%使用率。
![alt text](/image/yarn-elastic/yarn-server-memory.png)

####  测试验证
|物理机|物理机内存(G)|nm分配内存(G)|跑任务使用到100%（G）|物理机内存利用率|系统预留|碎片浪费|
|10.12.65.199|125|100|100%|28%|10%|50%|
|10.12.66.52|125|100|100%|28%|10%|50%|
|10.12.65.239|125|100|100%|28%|10%|50%|
|||合计300G|||||
  
### 1
| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |

