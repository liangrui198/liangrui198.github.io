---
layout: default
title:  盘io隔离&监控
author: liangrui
description: "hadoop集群磁盘io隔离" 
keywords: cgroup,cadvisor,disk io,hadoop,shuffle
date: 2025-10-17
---

<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2025-08-18" class="date-value">2025-10-17</time>
</div>

<div class="outline" style="background:#f6f8fa;padding:1em 1.5em 1em 1.5em;margin-bottom:2em;border-radius:8px;">
  <strong>大纲：</strong>
  <ul id="outline-list" style="margin:0;padding-left:1.2em;"></ul>
</div>

# 磁盘io隔离&监控

## 需求背景
  目前我们hadoop集群是混部署方式，一台服务器上有dn,nm,shuffle服务，经常在作业高峰期的时候，出现集群服务器磁盘io使用100%的情况，  
但又没有日志可以追踪到是那个服务引起的，或那个作业引起的。这样就会导致这台物理机上的所有服务有读写100% io磁盘的数据时，都会卡顿，互相影响。  
  所以我们需要启用cgroup来隔离使用磁盘io的限制，并采集到磁盘使用数据，来对服务进行优化。


## 实现方案
### 1111

## 效果展示

<script src="{{ '/assets/blog.js' | relative_url }}"></script>
<link rel="stylesheet" href="/assets/blog.css">

<!--菜单栏-->
  <nav class="blog-nav">
    <button class="collapse-btn" onclick="toggleBlogNav()">☰</button>
    {% include blog_navigation.html items=site.data.blog_navigation %}
 </nav>