---
layout: default
title:  hdfs cache
author: liangrui
description: "hdfs cache" 
keywords: hadoop,hdfs,hdfs cache
date: 2025-11-20
---

# hdfs集中式缓存
hdfs也支持缓存配置，把内存当作磁盘一样读写数据，类似alluxio cache,这个是基于hdfs内部管理的，如果某些hdfs文件高io的tmp时文件，是一个很好的选择。  
官方文档：https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/CentralizedCacheManagement.html


## 配置相关
```
// 必须配置 此参数决定了 DataNode 用于缓存的最大内存量，字节为单位指定，
dfs.datanode.max.locked.memory=34359738368
//这个配置数要低于linux上的(ulimit -l)的值，这个参数控制进程可以将多少内存锁定在物理RAM中，防止被交换到磁盘。例：
max locked memory       (kbytes, -l) 64

//默认太小，tmp修改到32g
ulimit -l 33554432
//永久修改 （需要root权限） 编辑 
echo -e "root soft memlock 33554432\nroot hard memlock 33554432" >> /etc/security/limits.conf 
echo -e "\nhdfs soft memlock 33554432\nhdfs hard memlock 33554432" >> /etc/security/limits.d/hdfs.conf
// echo -e "\nroot soft memlock 33554432\nroot hard memlock unlimited" >> /etc/security/limits.d/root.conf

// 这里hdfs服务是通过root sudo hdfs启的，他会用root来检查
//使用su - root，这是一个登录shell,会加载/etc/security/limits.conf   sudo -s不会触发登录shell
su - root
sudo -u hdfs bash -c "ulimit -l"

```



<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2025-10-20" class="date-value">2025-10-20</time>
</div>

<div class="outline" style="background:#f6f8fa;padding:1em 1.5em 1em 1.5em;margin-bottom:1em;border-radius:8px;">
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