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
pass="ipaadmin4yycluster"

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

```shell
# 仅仅在安装期间关闭 Schema Compatibility 插件
ldapmodify -H ldap://localhost -x -D "cn=directory manager" -w $pass <<EOF
dn: cn=Schema Compatibility,cn=plugins,cn=config
changetype: modify
replace: nsslapd-pluginEnabled
nsslapd-pluginEnabled: off
EOF
```

**理由：**
 即使你限制了 Ambari 的并发，只要这个插件开着，每一次写入操作（Add Principal）都会触发一次复杂的虚拟树计算，这依然可能在老版本的 389-ds 上触发 Mutex 锁。关闭它就像是关掉了 389-ds 的“高耗能模式”，安装完成后你可以随时通过改为 on 恢复它。

**Schema Compatibility 插件**   
  
关闭 Schema Compatibility 插件，主要影响集中在老旧客户端的兼容性上，对现代化的 FreeIPA 环境和 Ambari 核心功能基本没有负面影响。 
 该插件的作用是提供一个符合 RFC2307 标准的虚拟视图（通常在 cn=compat,dc=... 路径下）。永久关闭后：
老旧 Linux 系统无法登录：如果你的网络中还有极老的系统（如 CentOS 5 或更早版本，或者没有安装 sssd 的系统），它们通常直接查询 cn=compat 来获取用户和组信息。关闭后，这些老机器将无法通过 LDAP 获取账号。
部分老旧存储/网关设备：某些只支持简单 LDAP 协议且不支持 RFC2307bis（不支持嵌套组）的硬件设备（如旧款 NAS、老版本防火墙），如果它们之前配置指向的是 cn=compat 树，连接会失效。


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