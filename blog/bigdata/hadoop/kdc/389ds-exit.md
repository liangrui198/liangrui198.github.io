---
layout: default
title:  389ds
author: liangrui
description: "389ds" 
keywords: 389ds
date: 2026-04-27
---


# 问题描述
每次ambari在增加hadoop节点时，389ds就会严重卡死，然后keepalived就会切节点  
原因是ambari操作把389ds的并发locks占用完，导致线程全部在 futex_wait_queue_me

## 问题排查
编写389ds卡死的的自动诊断脚本  crash_389ds.sh    
```shell
#!/bin/bash
# 389-ds 深度诊断增强版 (Ubuntu 16.04 适配版)
# 修复 pstack 失效问题，采用 GDB 原生线程追踪

INSTANCE="slapd-YYDEVOPS-COM"
PID=$(pgrep -f "ns-slapd -D /etc/dirsrv/$INSTANCE")
LOG_DIR="/tmp/ds_deep_diag_$(date +%Y%m%d_%H%M%S)"
pass="xx"

if [ -z "$PID" ]; then
    echo "错误: 389-ds 进程未运行。"
    exit 1
fi

# 检查 GDB 是否安装
if ! command -v gdb &> /dev/null; then
    echo "错误: 未安装 gdb，请执行 apt-get install gdb"
    exit 1
fi

mkdir -p "$LOG_DIR"
echo "开始诊断 | 进程 PID: $PID | 输出目录: $LOG_DIR"

# 0. 解除 ptrace 限制 (针对 Ubuntu 安全策略)
if [ -f /proc/sys/kernel/yama/ptrace_scope ]; then
    ORIG_PTRACE=$(cat /proc/sys/kernel/yama/ptrace_scope)
    echo 0 > /proc/sys/kernel/yama/ptrace_scope
fi

# 1. 使用 GDB 抓取线程栈 (替代 pstack)
echo "[1/5] 正在通过 GDB 抓取全线程快照 (共 3 次)..."
for i in {1..3}; do
    echo "采样第 $i 次..."
    # batch 模式运行，thread apply all bt 打印所有线程堆栈
    gdb -batch -ex "set pagination 0" -ex "thread apply all bt" -p $PID  > "$LOG_DIR/gdb_threads.$i.log" 2>&1
    sleep 3
done

# 2. 抓取内核态堆栈 (排查底层锁或磁盘 IO)
echo "[2/5] 抓取内核态等待快照..."
# 抓取主进程栈
cat "/proc/$PID/stack" > "$LOG_DIR/kernel_main_stack.log"
# 遍历所有轻量级线程 (LWP) 的内核栈
for task_stack in /proc/$PID/task/*/stack; do
    tid=$(echo "$task_stack" | cut -d'/' -f5)
    echo "Thread $tid:" >> "$LOG_DIR/kernel_all_tasks.log"
    cat "$task_stack" >> "$LOG_DIR/kernel_all_tasks.log"
    echo "----------------" >> "$LOG_DIR/kernel_all_tasks.log"
done

# 3. 抓取 LDAP 内部监控 (如果端口还能响应)
echo "[3/5] 尝试读取 LDAP 内部计数器..."
ldapsearch -H ldap://localhost -x -D "cn=directory manager" -w "$pass" -s base -b "cn=monitor" > "$LOG_DIR/monitor_global.log" 2>/dev/null
ldapsearch -H ldap://localhost -x -D "cn=directory manager" -w "$pass" -s base -b "cn=database,cn=monitor,cn=ldbm database,cn=plugins,cn=config" > "$LOG_DIR/monitor_db.log" 2>/dev/null

# 4. 分析文件句柄 (FD) 状态
echo "[4/5] 分析文件句柄占用..."
ls -lh "/proc/$PID/fd" > "$LOG_DIR/fd_details.log"
netstat -antp | grep "$PID" > "$LOG_DIR/network_connections.log"

# 5. 自动汇总异常点
echo "[5/5] 正在生成初步诊断摘要..."
{
    echo "=== 诊断摘要 ==="
    echo "采样时间: $(date)"
    echo "当前线程总数: $(ls /proc/$PID/task | wc -l)"
    echo "当前 FD 占用数: $(ls /proc/$PID/fd | wc -l)"
    echo ""
    echo "--- GDB 堆栈中的高频关键字统计 ---"
    grep -E "bdb_layer_lock|slapi_entry_compat|wait|poll|mutex" "$LOG_DIR/gdb_threads.1.log" | awk '{print $4}' | sort | uniq -c | sort -nr
} > "$LOG_DIR/summary.txt"

# 恢复 ptrace 限制
if [ -n "$ORIG_PTRACE" ]; then
    echo "$ORIG_PTRACE" > /proc/sys/kernel/yama/ptrace_scope
fi

echo "------------------------------------------------"
echo "诊断完成！请打包该目录发送给专家分析: $LOG_DIR"
echo "提示: 如果汇总显示大量线程处于 'bdb_layer_lock'，请检查 nsslapd-db-locks 是否真的生效。"
echo "提示: 如果大量线程处于 'slapi_entry_compat'，说明 Schema Compatibility 插件在高并发下写锁死。"
```
诊断信息输出  
```log
 ./crash_389ds.sh 
开始诊断 | 进程 PID: 44068 | 输出目录: /tmp/ds_deep_diag_20260427_111421
[1/5] 正在通过 GDB 抓取全线程快照 (共 3 次)...
采样第 1 次...
采样第 2 次...
采样第 3 次...
[2/5] 抓取内核态等待快照...
[3/5] 尝试读取 LDAP 内部计数器...
[4/5] 分析文件句柄占用...
[5/5] 正在生成初步诊断摘要...
------------------------------------------------
诊断完成！请打包该目录发送给专家分析: /tmp/ds_deep_diag_20260427_111421
提示: 如果汇总显示大量线程处于 'bdb_layer_lock'，请检查 nsslapd-db-locks 是否真的生效。
提示: 如果大量线程处于 'slapi_entry_compat'，说明 Schema Compatibility 插件在高并发下写锁死。
```

主要问题   
```shell
# 连接队称2321个排队 严重
tcp6    2321      0 10.12.78.172:389        10.12.70.11:34608       ESTABLISHED 44068/ns-slapd  

# 锁wait 90% 严重,虽然locks调到到10万个，但是并发locks只有101个,历史峰值1154个
# 这是锁竞争/死锁，不是锁数量不足
nsslapd-db-log-region-wait-rate: 90
nsslapd-db-lock-region-wait-rate: 90
nsslapd-db-txn-region-wait-rate: 90
nsslapd-db-lockers: 297
nsslapd-db-configured-locks: 100000
nsslapd-db-current-locks: 101
nsslapd-db-max-locks: 1154
nsslapd-db-current-lock-objects: 64
nsslapd-db-max-lock-objects: 674

# 线程futex_wait_queue_me 266个，说明所有线程全部在futex_wait_queue_me
...
Thread 44363:
[<ffffffffb71104b4>] futex_wait_queue_me+0xc4/0x120
[<ffffffffb7111056>] futex_wait+0x116/0x270
[<ffffffffb7113624>] do_futex+0x214/0x540
[<ffffffffb71139d1>] SyS_futex+0x81/0x180
[<ffffffffb7003b69>] do_syscall_64+0x69/0xe0
[<ffffffffb78b020e>] entry_SYSCALL_64_after_swapgs+0x58/0xc6
[<ffffffffffffffff>] 0xffffffffffffffff
----------------
Thread 44364:
[<ffffffffb71104b4>] futex_wait_queue_me+0xc4/0x120
[<ffffffffb7111056>] futex_wait+0x116/0x270
[<ffffffffb7113624>] do_futex+0x214/0x540
[<ffffffffb71139d1>] SyS_futex+0x81/0x180
[<ffffffffb7003b69>] do_syscall_64+0x69/0xe0
[<ffffffffb78b020e>] entry_SYSCALL_64_after_swapgs+0x58/0xc6
[<ffffffffffffffff>] 0xffffffffffffffff

# GBD threads信息 __db_pthread_mutex_lock出现114次
# filter_candidates_ext 重复出现了 4 次。这说明 LDAP 正在处理一个极其复杂的嵌套过滤器查询。
# 关联性推断：普通的 Ambari 写入不应该产生如此深层的递归搜索。只有 Schema Compatibility 插件在工作时，为了生成虚拟的 cn=compat 条目，它会频繁地在后台发起这种“为了构造一个属性而搜索整个数据库”的操作。 
# 诊断结论：锁桶 (Lock Buckets) 耗尽

...
Thread 233 (Thread 0x7fd507726700 (LWP 44327)):
#0  pthread_cond_wait@@GLIBC_2.3.2 () at ../sysdeps/unix/sysv/linux/x86_64/pthread_cond_wait.S:185
#1  0x00007fd724ead88d in __db_pthread_mutex_lock () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#2  0x00007fd724f56600 in __lock_get_internal () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#3  0x00007fd724f57017 in __lock_get () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#4  0x00007fd724f82447 in __db_lget () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#5  0x00007fd724eca85d in __bam_search () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#6  0x00007fd724eb58fc in ?? () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#7  0x00007fd724eb79ff in ?? () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#8  0x00007fd724f6ee15 in __dbc_iget () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#9  0x00007fd724f7df02 in __dbc_get_pp () from /usr/lib/x86_64-linux-gnu/libdb-5.3.so
#10 0x00007fd720eac0ce in idl_new_fetch () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#11 0x00007fd720eba713 in index_read_ext_allids () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#12 0x00007fd720ea4c3d in ?? () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#13 0x00007fd720ea5452 in ?? () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#14 0x00007fd720ea5a3a in filter_candidates_ext () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#15 0x00007fd720ea6a3f in ?? () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#16 0x00007fd720ea59a2 in filter_candidates_ext () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#17 0x00007fd720ea6a3f in ?? () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#18 0x00007fd720ea59a2 in filter_candidates_ext () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#19 0x00007fd720ea6a3f in ?? () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#20 0x00007fd720ea59a2 in filter_candidates_ext () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#21 0x00007fd720ee11a7 in subtree_candidates () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#22 0x00007fd720ee2733 in ldbm_back_search () from /usr/lib/x86_64-linux-gnu/dirsrv/plugins/libback-ldbm.so
#23 0x00007fd72ff77d90 in op_shared_search () from /usr/lib/x86_64-linux-gnu/dirsrv/libslapd.so.0
#24 0x00005589d7d616df in ?? ()
#25 0x00005589d7d5030f in ?? ()
#26 0x00007fd72eed8088 in ?? () from /usr/lib/x86_64-linux-gnu/libnspr4.so
#27 0x00007fd72ea7f6ba in start_thread (arg=0x7fd507726700) at pthread_create.c:333
#28 0x00007fd72e7b541d in clone () at ../sysdeps/unix/sysv/linux/x86_64/clone.S:109
...

# summary.txt
=== 诊断摘要 ===
采样时间: Mon Apr 27 11:14:36 CST 2026
当前线程总数: 271
当前 FD 占用数: 125

--- GDB 堆栈中的高频关键字统计 ---
    253 at
     38 __db_pthread_mutex_lock
     12 out>,
     12 futex_wait
     11 __db_pthread_mutex_readlock
      3 slapi_wait_condvar
      1 poll
      1 ()

```


## 解决方案
1: 在 ambari.properties 中添加或修改：   

```conf
# 之前值是30
krbtool.min.no.sleep.task=5
krbtool.each.action.sleep.interval.second=3
krbtool.max.sleep.interval.second=300

```
2:终极“保险丝”建议  
在新版本的freeipa中 Schema Compatibility 插件默认是禁用的  
官方下线bdb文档: https://www.port389.org/docs/389ds/howto/howto-migrate-bdb-to-lmdb.html    
应用LMDB：https://www.port389.org/docs/389ds/howto/howto-use-lmdb.html   

```shell

ldapmodify -H ldap://localhost -x -D "cn=directory manager" -w $pass <<EOF
dn: cn=Schema Compatibility,cn=plugins,cn=config
changetype: modify
replace: nsslapd-pluginEnabled
nsslapd-pluginEnabled: off
EOF

# 查询
ldapsearch -H ldap://localhost -x -D "cn=directory manager" -w "$pass" -s base -b "cn=Schema Compatibility,cn=plugins,cn=config" nsslapd-pluginEnabled  


```

3:你必须手动拓宽 BDB 的“登记簿架子”： 修改后必须重启才能生效    

```shell
ldapmodify -H ldap://localhost -x -D "cn=directory manager" -w $pass <<EOF
dn: cn=config,cn=ldbm database,cn=plugins,cn=config
changetype: modify
add: nsslapd-db-lock-buckets
nsslapd-db-lock-buckets: 30000
EOF

# 重启
systemctl restart dirsrv@xx-COM

```

**理由：**
 即使你限制了 Ambari 的并发，只要这个插件开着，每一次写入操作（Add Principal）都会触发一次复杂的虚拟树计算，这依然可能在老版本的 389-ds 上触发 Mutex 锁。关闭它就像是关掉了 389-ds 的“高耗能模式”，安装完成后你可以随时通过改为 on 恢复它。

**Schema Compatibility 插件介绍**   
  
关闭 Schema Compatibility 插件，主要影响集中在老旧客户端的兼容性上，对现代化的 FreeIPA 环境和 Ambari 核心功能基本没有负面影响。 
 该插件的作用是提供一个符合 RFC2307 标准的虚拟视图（通常在 cn=compat,dc=... 路径下）。永久关闭后：
老旧 Linux 系统无法登录：如果你的网络中还有极老的系统（如 CentOS 5 或更早版本，或者没有安装 sssd 的系统），它们通常直接查询 cn=compat 来获取用户和组信息。关闭后，这些老机器将无法通过 LDAP 获取账号。
部分老旧存储/网关设备：某些只支持简单 LDAP 协议且不支持 RFC2307bis（不支持嵌套组）的硬件设备（如旧款 NAS、老版本防火墙），如果它们之前配置指向的是 cn=compat 树，连接会失效。

## 为什么这个插件会有这多大的风险? 
这个插件之所以成为 389-ds 的“性能杀手”，核心在于它的架构设计与老版本锁机制之间的冲突。

**为什么这个插件风险这么大？**
1:全局写锁（Global Write Lock）：   
在旧版本（如你使用的 1.3.x）中，该插件在更新虚拟视图时会触发一个全局锁。当 Ambari 发起大量的 ADD 或 MODIFY 操作时，每一个操作都要等插件计算完“兼容性视图”并释放锁，这导致了严重的串行化，最终引发你看到的 __db_pthread_mutex_lock 堆积。

2:实时动态计算（On-the-fly Calculation）：    
它不是一个静态的数据库，而是一个“计算引擎”。每当有查询进来，它会实时把 cn=accounts 里的条目转换成 RFC2307 格式。在高并发下，这种转换非常消耗 CPU 和内存，且容易在转换过程中与主数据库产生死锁。

3:内存管理与 BDB 限制：   
旧版本依赖 Berkeley DB (BDB)。BDB 的锁空间是有限的（就是你之前查不到的 lock-buckets）。Schema Compatibility 产生的临时操作会大量消耗这些锁资源。当锁桶满了，整个数据库引擎就卡死在等待状态。

## 新版本（389-ds 1.4.x / 2.x）是如何解决的
在 FreeIPA 和 389-ds 的新版本中，进行了“脱胎换骨”的改造：

1:更换数据库引擎（LMDB 替代 BDB）：  
新版本彻底放弃了 Berkeley DB，改用 LMDB（Lightning Memory-Mapped Database）。
LMDB 特点：它支持 MVCC（多版本并发控制），实现了一写多读且读写互不阻塞。这意味着写操作再多，也不会让读操作（或插件的计算过程）卡死。

2:插件锁优化：  
Red Hat 对该插件进行了重构，将原本的粗粒度全局锁改成了更细粒度的锁，或者通过无锁队列来处理更新。这使得多个线程可以同时进行视图转换，不再排队。

3:异步处理：  
新版本的 Schema Compatibility 能够更智能地处理后台更新，避免了在主写入事务执行路径上同步执行耗时的转换逻辑。
SSSD 的普及：
由于现代 Linux 客户端（SSSD）已经非常成熟，不再需要通过这个插件来兼容旧格式。官方现在的策略是默认不建议开启此插件，除非明确有老旧系统需求。

**总结**
你当前处于 “旧引擎 (BDB) + 粗粒度锁插件 + 高并发写入 (Ambari)” 的组合下，这正好触发了 389-ds 设计上的最弱点。


<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2026-04-27" class="date-value">2026-04-27</time>
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

<!--评论区-->
<div id="giscus-comments" style="max-width:900px;margin:2em auto 0 auto;padding:0 1em;"></div>
<script>
  insertGiscusComment('giscus-comments');
</script>