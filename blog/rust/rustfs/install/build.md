---
layout: default
title:  RUST BUILD
author: liangrui
description: "rust build" 
keywords: rust podman build
date: 2026-06-16
---


# rustFS环境和编译
RustFS 是一个高性能的分布式对象存储系统，它使用 Rust 语言构建——Rust 是全球最受欢迎的编程语言之一。RustFS 结合了 MinIO 的简洁性和 Rust 的内存安全性和强大的性能。它完全兼容 S3，完全开源，并针对数据湖、人工智能和大数据工作负载进行了优化。    
与其他存储系统不同，RustFS 采用宽松的 Apache 2.0 许可证发布，避免了 AGPL 的限制。RustFS 基于 Rust 语言，为下一代对象存储提供卓越的速度和安全的分布式特性。   
clone源码 https://github.com/rustfs/rustfs    

## rustFS开发环境
这里以VS code为例，VS code用的是rust-analyzer插件。    


 
## 编译工具
```shell
wsl --install -d Ubuntu-22.04

# 安装依懒工具
sudo apt update
sudo apt install -y protobuf-compiler pkg-config build-essential cmake clang
protoc --version


# build
cd /mnt/f/pro/github/rustfs
sudo apt install -y dos2unix
sudo apt install -y zip
dos2unix build-rustfs.sh
./build-rustfs.sh --platform x86_64-unknown-linux-gnu


# 会产出
target/release/x86_64-unknown-linux-gnu/rustfs
```

# 安装


## login  
user and password : rustfsadmin 


<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2026-06-16" class="date-value">2026-06-16</time>
</div>

<div class="outline" style="background:#f6f8fa;padding:1em 1.5em 1em 1.5em;margin-bottom:2em;border-radius:8px;">
  <strong>大纲：</strong>
  <ul id="outline-list" style="margin:0;padding-left:1.2em;"></ul>
</div>

<!--菜单栏-->
  <nav class="blog-nav">
    <button class="collapse-btn" onclick="toggleBlogNav()">☰</button>
    {% include blog_navigation.html items=site.data.blog_navigation %}
 </nav>

 <script src="/assets/blog.js"></script>
<link rel="stylesheet" href="/assets/blog.css">
<!--评论区-->
<div id="giscus-comments" style="max-width:900px;margin:2em auto 0 auto;padding:0 1em;"></div>
<script>
  insertGiscusComment('giscus-comments');
</script>