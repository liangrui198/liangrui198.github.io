---
layout: default
title: 首页
---
<section class="home-posts">
  <h2>最新文章</h2>
  
  <ul class="post-list">
    {% for post in paginator.posts %}
      <li>
        <h3>
          <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        </h3>
        <div class="post-excerpt">
          {{ post.excerpt | truncate: 200 }}
        </div>
        <div class="post-meta">
          <time>{{ post.date | date: "%Y-%m-%d" }}</time>
          <span>•</span>
          {% for tag in post.tags limit:3 %}
            <span class="tag">#{{ tag }}</span>
          {% endfor %}
        </div>
      </li>
    {% endfor %}
  </ul>

  <!-- 分页导航 -->
  <div class="pagination">
    {% if paginator.previous_page %}
      <a href="{{ paginator.previous_page_path }}" class="prev">← 上一页</a>
    {% endif %}
    
    <span class="page-number">
      第 {{ paginator.page }} / {{ paginator.total_pages }} 页
    </span>
    
    {% if paginator.next_page %}
      <a href="{{ paginator.next_page_path }}" class="next">下一页 →</a>
    {% endif %}
  </div>
</section>
