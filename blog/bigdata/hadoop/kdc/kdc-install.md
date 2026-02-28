---
layout: default
title:  kdc
author: liangrui
description: "kdc" 
keywords: kdc
date: 2026-02-13
---


# 服务安装
ambari依懒ipa客户端命令，来执行服务安装的时候需要新建kerberos账号信息。比如新增一个datandoe节点,ambari先增加一个hostname和dn/hostname服务账号到kdc服务中，kdc是用的389ds存储数据。  
这里以ubuntu16.04安装为例  


## freeipa全家桶安装
### 安装server
系统安装服务包  
```bash
apt-get update  
apt-get install -y freeipa-server
```

安装服务server 
```bash
ipa-server-install
 Do you want to configure integrated DNS (BIND)? [no]no
  Server host name [fs-hiido-ipa-66-115.hiido.host.xx.com]: fs-hiido-ipa-66-115.hiido.host.xx.com
  Please provide a realm name [HIIDO.HOST.xx.COM]: xx.COM
  pass
  pass
  Continue to configure the system with these values? [no]:  yes

# 测试服务是否可用
ipa user-add roy --first=liang --last=rui
ipa-getkeytab -k /root/roy.keytab -p roy 
kinit -kt /root/roy.keytab roy
klist

```

### 安装副本
在已安装的server服务上执行,增加相应的权限    
```bash
# 增加host
ipa host-add  ipa-70-10.hiido.host.int.yy.com
# 异常 additional info: Entry is managed by topology plugin.Deletion not allowed,就是因为没有加入到member组中去，需要执行这个   
ipa hostgroup-add-member ipaservers --hosts ipa-70-10.hiido.host.int.yy.com

#查看member
ipa hostgroup-find
```


需要装副本的机器上执行  
```bash
#安装服务包
apt-get update
apt-get install -y freeipa-server

# ipa-server-install 副本节点不要安装server
#如果有问题卸载服务，重新安装
ipa-server-install --uninstall

ipa-client-install --domain=hiido.host.xx.com --realm=xx.COM --server=fs-hiido-ipa-65-155.hiido.host.xx.com  --force-join
# 根据提示写信息
Using existing certificate '/etc/ipa/ca.crt'.
Autodiscovery of servers for failover cannot work with this configuration.
If you proceed with the installation, services will be configured to always access the discovered server for all operations and will not fail over to other servers in case of failure.
Proceed with fixed values and no DNS discovery? [no]: yes 
Client hostname: ipa-70-2.hiido.host.int.yy.com
Realm: YYDEVOPS.COM
DNS Domain: hiido.host.yydevops.com
IPA Server: fs-hiido-kerberos-21-117-149.hiido.host.yydevops.com
BaseDN: dc=yydevops,dc=com

Continue to configure the system with these values? [no]: yes
Synchronizing time with KDC...
Attempting to sync time using ntpd.  Will timeout after 15 seconds
Unable to sync time with NTP server, assuming the time is in sync. Please check that 123 UDP port is opened.
User authorized to enroll computers: admin
Password for admin@YYDEVOPS.COM: 
Enrolled in IPA realm YYDEVOPS.COM
...
Client configuration complete.


#执行副本拉取数据
#无ca
ipa-replica-install  --skip-conncheck
# debug
ipa-replica-install  --skip-conncheck --debug
#有ca
ipa-replica-install --setup-ca  --skip-conncheck
#带有更改配置文件的安装，就是
ipa-replica-install  --dirsrv-config-file=/root/maxsasliosize.ldif --skip-conncheck 

# 如果安装有问题，需要先删除再执行安装
ipa-replica-manage del --force ipa-70-3.hiido.host.int.xx.com --cleanup



```
查看服务的信息  
```bash
# 查看replica 列表
ipa-replica-manage list

#查看topology 默认有2种类型 domain和ca
ipa topologysegment-find

# 通过389ds查看复制状态
ldapsearch -LLL -x -H ldap://localhost:389     -D "cn=Directory Manager" -w $pass     -b "cn=replica,cn=dc\3Dyydevops\2Cdc\3Dcom,cn=mapping tree,cn=config"    "(objectClass=nsds5ReplicationAgreement)" cn nsDS5ReplicaHost nsds5replicaLastUpdateStatus


```


### 如果节点有问题，需要重新初始化

```bash
# 重新初始化用户数据
ipa-replica-manage re-initialize    --from  fs-hiido-ipa-65-155.hiido.host.yydevops.com

# 重新初始化包含 CA 证书
ipa-csreplica-manage re-initialize --from fs-hiido-ipa-65-155.hiido.host.yydevops.com

# 把389ds中的证书同步到本地
ipa-certupdate

# 日志调试，可根据errorlog-level来查看389ds的日志输出
# 文档查看https://www.port389.org/docs/389ds/FAQ/faq.html
dn: cn=config
changetype: modify
replace: nsslapd-errorlog-level
nsslapd-errorlog-level: 128

```
更改dn信息例子，有些情况需要修改389ds中的数据，比如某个service的证书过多，需要删除     
```bash
# 准备一个ldif文件 > modify_http_08.ldif
dn: krbprincipalname=HTTP/fs-hiido-kerveros-test08.hiido.host.xx.com@YYDEVOPS.COM,cn=services,cn=accounts,dc=yydevops,dc=com
changetype: modify
replace: userCertificate
userCertificate:: MIIFKzCCBBOgAwIBAgIDAJuGMA0G...


# 证书文件过多，修改为一个
ldapmodify -x -D "cn=Directory Manager" -w $pass  -f modify_http_08.ldif

# 或者直接删除某个dn 
ldapsearch -x -H ldap://localhost -D "cn=Directory Manager" -w $pass  -b "krbprincipalname=HTTP/fs-hiido-kerveros-test08.hiido.host.xx.com@YYDEVOPS.COM,cn=services,cn=accounts,dc=yydevops,dc=com" 

```
### 客户端安装
```bash 
#安装client
apt-get install freeipa-client
#增加组权限
ipa hostgroup-add-member ipaservers --hosts ipa-test-65-194.hiido.host.xx.com
# 配置指向访问地个副本节点
ipa-client-install --domain=hiido.host.xx.com --realm=YYDEVOPS.COM --server=ipa-test-65-188.hiido.host.xx.com

# admin工具
apt-get install freeipa-admintools

```
## 安装遇到的问题
### RUV 包含相同的 URL
 RUV 包含相同的 URL 但副本 ID 不同，则创建的引用会包含重复项。  
日志：`attrlist_replace - attr_replace (nsslapd-referral, ldap://ipa-70-3.hiido.host.int.xx.com:389/dc%3Dyydevops%2Cdc%3Dcom) failed.`     
服务bug:https://pagure.io/389-ds-base/c/6f585fa9adaa83efa98b72aa112e162f180b0ad1    
```bash
#列出 ruv 发现有2个相同的hostname 但id不同

ipa-replica-manage list-ruv
ipa-70-7.hiido.host.int.xx.com:389: 79
ipa-70-7.hiido.host.int.xx.com:389: 82
...

# 如何确定删除那个  
ldapsearch -x -D "cn=directory manager" -W \
  -b "cn=replica,cn=dc\3Dyydevops\,dc\3Dcom,cn=mapping tree,cn=config" \
  nsds50ruv

# meToipa-70-7.hiido.host.int.yy.com, replica, dc\3Dyydevops\2Cdc\3Dcom, mappin
 g tree, config
dn: cn=meToipa-70-7.hiido.host.int.yy.com,cn=replica,cn=dc\3Dyydevops\2Cdc\3Dc
 om,cn=mapping tree,cn=config
nsds50ruv: {replicageneration} 699d83610000003c0000
nsds50ruv: {replica 79 ldap://ipa-70-7.hiido.host.int.yy.com:389} 699fe19c0000
 004f0000 699fe19c0000004f0000
nsds50ruv: {replica 60 ldap://fs-hiido-ipa-65-155.hiido.host.yydevops.com:389}
  699d83630000003c0000 699fe17d0000003c0000
nsds50ruv: {replica 73 ldap://ipa-70-3.hiido.host.int.yy.com:389} 699d86e00002
 00490000 699fe284000100490000
nsds50ruv: {replica 72 ldap://ipa-70-2.hiido.host.int.yy.com:389} 699d86ca0002
 00480000 699fe288000000480000
nsds50ruv: {replica 44 ldap://fs-hiido-kerveros-test08.hiido.host.yydevops.com
 :389}
nsds50ruv: {replica 76 ldap://ipa-70-8.hiido.host.int.yy.com:389} 699eebea0000
 004c0000 699fe0b80001004c0000
 ....

 nsds50ruv中没有82这个id,说明是没有用到的，需要删除

# 执行删除
ipa-replica-manage clean-ruv 82
...
consistency. Be very careful.
Continue to clean? [no]: yes
ipa: DEBUG: Creating CLEANALLRUV task for replica id 82
ipa: DEBUG: flushing ldaps://fs-hiido-ipa-65-155.hiido.host.yydevops.com:636 from SchemaCache
ipa: DEBUG: retrieving schema for SchemaCache url=ldaps://fs-hiido-ipa-65-155.hiido.host.yydevops.com:636 conn=<ldap.ldapobject.SimpleLDAPObject instance at 0x7f85186531b8>
Background task created to clean replication data. This may take a while.
This may be safely interrupted with Ctrl+C

#必须要保证所有master节点服务在运行，不然会卡在清理ruv，如果有坏的节点可以执行 del先删除  
ipa-replica-manage list
ipa-replica-manage del --force ipa-65-189.hiido.host.yydevops.com --cleanup

#如果反复了现，会产生脏数据，需要手动删除，执行以下操作
ipa-replica-manage del --force ipa-70-7.hiido.host.int.xx.com --cleanup

# 查询出不在的ruv
ldapsearch -D "cn=Directory Manager" -W -b "cn=config" "(objectclass=nsds5replicationagreement)" cn nsds50ruv
...
nsds50ruv: {replica 79 ldap://ipa-70-7.hiido.host.int.yy.com:389} 699fe19c0000
 ...
nsds50ruv: {replica 83 ldap://ipa-70-7.hiido.host.int.yy.com:389} 699ff56f0000 
nsds50ruv: {replica 82 ldap://ipa-70-7.hiido.host.int.yy.com:389} 699ff56f0000
 00530000 699ff684000400530000

#增加删除文件
cat clean_7.ldif 
dn: cn=clean82_manual, cn=cleanallruv, cn=tasks, cn=config
objectclass: extensibleObject
cn: clean82_manual
replica-base-dn: dc=yydevops,dc=com
replica-id: 82
replica-force-cleaning: yes

dn: cn=clean79_manual, cn=cleanallruv, cn=tasks, cn=config
objectclass: extensibleObject
cn: clean79_manual
replica-base-dn: dc=yydevops,dc=com
replica-id: 79
replica-force-cleaning: yes

dn: cn=clean83_manual, cn=cleanallruv, cn=tasks, cn=config
objectclass: extensibleObject
cn: clean83_manual
replica-base-dn: o=ipaca
replica-id: 83
replica-force-cleaning: yes

#执行
root@fs-hiido-ipa-65-155:/home/liangrui06# ldapadd -D "cn=Directory Manager" -W -x -f clean_7.ldif 
Enter LDAP Password: 
adding new entry "cn=clean82_manual, cn=cleanallruv, cn=tasks, cn=config"
adding new entry "cn=clean79_manual, cn=cleanallruv, cn=tasks, cn=config"
adding new entry "cn=clean83_manual, cn=cleanallruv, cn=tasks, cn=config"

#日志显示
[28/Feb/2026:11:20:43 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Initiating CleanAllRUV Task... 
[28/Feb/2026:11:20:47 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Successfully cleaned rid(82). 
[28/Feb/2026:11:21:00 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 83): Successfully cleaned rid(83). 
[28/Feb/2026:11:21:00 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 79): Successfully cleaned rid(79). 


ipa-replica-manage list-ruv
# ruv彻底消失了


# 日志输出
[26/Feb/2026:17:32:44 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Sending cleanAllRUV task to all the replicas... 
[26/Feb/2026:17:32:44 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Cleaning local ruv's... 
[26/Feb/2026:17:32:45 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Waiting for all the replicas to be cleaned... 
[26/Feb/2026:17:32:45 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Waiting for all the replicas to finish cleaning... 
[26/Feb/2026:17:32:45 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Successfully cleaned rid(82). 
[26/Feb/2026:17:32:50 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): delete_cleaned_rid_config: failed to find any entries with nsds5ReplicaCleanRUV under (cn=replica,cn="dc=yydevops,dc=com",cn=mapping tree,cn=config) 
[26/Feb/2026:17:32:50 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): delete_cleaned_rid_config: failed to remove replica config (-1), rid (82) 
[26/Feb/2026:17:32:50 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Waiting for all the replicas to finish cleaning... 
[26/Feb/2026:17:32:50 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Not all replicas finished cleaning, retrying in 10 seconds 
[26/Feb/2026:17:33:00 +0800] NSMMReplicationPlugin - CleanAllRUV Task (rid 82): Successfully cleaned rid(82). 

那个异常一直输出的日志就消失了  
```
### dna-plugin - dna_pre_op: no more values available!!

执行增加用户时 ipa user-add mg01 抛出  
`Operations error: Allocation of a new value for range cn=posix ids,cn=distributed numeric assignment plugin,cn=plugins,cn=config failed! Unable to proceed`
  
```bash
# 查看
ipa-replica-manage dnarange-show
fs-hiido-ipa-65-155.hiido.host.yydevops.com: No range set
ipa-70-2.hiido.host.int.yy.com: No range set
ipa-70-3.hiido.host.int.yy.com: No range set
ipa-70-8.hiido.host.int.yy.com: No range set
ipa-78-184.hiido.host.int.yy.com: No range set
ipa-70-9.hiido.host.int.yy.com: No range set
ipa-70-10.hiido.host.int.yy.com: No range set
ipa-78-172.hiido.host.int.yy.com: No range set

 ipa idrange-find
---------------
1 range matched
---------------
  Range name: YYDEVOPS.COM_id_range
  First Posix ID of the range: 1378000000
  Number of IDs in the range: 200000
  Range type: local domain range
----------------------------
Number of entries returned 1
----------------------------

#重新分配
ipa-replica-manage dnarange-set ipa-70-2.hiido.host.int.yy.com 1378010000-1378029999
ipa-replica-manage dnarange-set ipa-70-3.hiido.host.int.yy.com 1378030000-1378049999
ipa-replica-manage dnarange-set ipa-70-8.hiido.host.int.yy.com 1378050000-1378069999
ipa-replica-manage dnarange-set ipa-70-9.hiido.host.int.yy.com 1378070000-1378089999
ipa-replica-manage dnarange-set ipa-70-10.hiido.host.int.yy.com 1378090000-1378109999
ipa-replica-manage dnarange-set ipa-78-172.hiido.host.int.yy.com 1378110000-1378129999
ipa-replica-manage dnarange-set ipa-78-184.hiido.host.int.yy.com 1378130000-1378149999
ipa-replica-manage dnarange-set fs-hiido-ipa-65-155.hiido.host.yydevops.com 1378150000-1378169999

#验证执行成功了
ipa user-add mg01
First name: m
Last name: g
-----------------
Added user "mg01"
-----------------
  User login: mg01
  First name: m
  Last name: g
  Full name: m g
  Display name: m g
  Initials: mg
  Home directory: /home/mg01
  GECOS: m g
  Login shell: /bin/sh
  Kerberos principal: mg01@YYDEVOPS.COM
  Email address: mg01@yydevops.com
  UID: 1378050000
  GID: 1378050000
  Password: False
  Member of groups: ipausers
  Kerberos keys available: False

# 如果你的环境未来用户量极大（超过 20 万），你还可以通过 ipa idrange-mod 来通过 Red Hat 身份管理指南 扩展总的 Number of IDs，但目前这 20 万空间配合每节点 2 万的配额已经非常稳健了。

```



## 日常运维
```bash
# 状态查看
ipactl status
Directory Service: RUNNING
krb5kdc Service: RUNNING
kadmin Service: RUNNING
ipa_memcached Service: RUNNING
httpd Service: RUNNING
ipa-custodia Service: RUNNING
pki-tomcatd Service: RUNNING
ipa-otpd Service: RUNNING
ipa: INFO: The ipactl command was successful

# 服务重启
ipactl restart


# 日志查看4.3和4.8输出不同文件
tailf /var/log/daemon.log
tailf /var/log/auth.log

# 查看389ds版本
ns-slapd -v
389 Project
389-Directory/1.3.4.9 B2016.109.158


```
## 备份与恢复
```bash
# 备份
ipa-backup --data --online

# 恢复
ipa-restore   /var/lib/ipa/backup/xx

# 如果你的证书系统（PKI）完好，只是 LDAP 数据（用户、组、策略）出了问题。
ipa-restore  /var/lib/ipa/backup/ipa-full-2024-01-15-12-00-00.tar
```

## 配置优化

### 数据库缓存设置
https://access.redhat.com/documentation/en-us/red_hat_directory_server/11/html/performance_tuning_guide/memoryusage
```bash
pass=xx

ldapmodify -x -H ldap://$(hostname):389 \
  -D "cn=Directory Manager" -w $pass <<EOF
dn: cn=config,cn=ldbm database,cn=plugins,cn=config
changetype: modify
replace: nsslapd-dbcachesize
nsslapd-dbcachesize: 5368709120
EOF


ldapmodify -x -H ldap://$(hostname):389 \
  -D "cn=Directory Manager" -w $pass <<EOF
dn: cn=userroot,cn=ldbm database,cn=plugins,cn=config
changetype: modify
replace: nsslapd-cachememsize
nsslapd-cachememsize: 5368709120
EOF

ldapmodify -x -H ldap://$(hostname):389 \
  -D "cn=Directory Manager" -w $pass <<EOF
dn: cn=changelog,cn=ldbm database,cn=plugins,cn=config
changetype: modify
replace: nsslapd-cachememsize
nsslapd-cachememsize: 21474836480
EOF

ldapmodify -x -H ldap://$(hostname):389 \
  -D "cn=Directory Manager" -w $pass <<EOF
dn: cn=userroot,cn=ldbm database,cn=plugins,cn=config
changetype: modify
replace: nsslapd-dncachememsize
nsslapd-dncachememsize: 603979776
EOF
```

验证配置  
```bash 
cat /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif| grep nsslapd-cachememsize
cat /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif| grep nsslapd-dbcachesize
cat /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif|grep  nsslapd-cache-autosize

ldapsearch -h $(hostname) -p 389 -D "cn=directory manager" -w $pass -b "cn=userroot,cn=ldbm database,cn=plugins,cn=config" | grep nsslapd-cachememsize
ldapsearch -h $(hostname) -p 389 -D "cn=directory manager" -w $pass -b "cn=userroot,cn=ldbm database,cn=plugins,cn=config" | grep nsslapd-dbcachesize

```

### fd限制调大  
```
sed -i s/LimitNOFILE=8192/LimitNOFILE=131072/g /etc/default/dirsrv.systemd
systemctl daemon-reexec
systemctl restart  dirsrv@YYDEVOPS-COM.service
```

### 线程配置优化
因当前kdc认证压力过大，原因是在查询389DS服务的时间，默认参数太于限制了资源使用，但服务器上的资源使用很低，需要调大以下参数。   
参数说明  

```bash
# 最大线程数
nsslapd-threadnumber: 128
# 每个连接可用并发线程数
nsslapd-maxthreadsperconn: 20
# 会让空闲连接长时间占用 socket/FD/线程，默认1小时，缩短为5分钟就释放掉
nsslapd-idletimeout: 300
# 打开文件描述符最大限制，需要调成一致的，默认的太少了，上限后会阻止复制
nsslapd-maxdescriptors: 32768

#默认值：
 nsslapd-idletimeout: 3600 （1 小时）
 nsslapd-threadnumber: 64
 nsslapd-maxthreadsperconn: 5
 sslapd-maxdescriptors: 8192

# -------编写config_update.ldif
dn: cn=config
changetype: modify
replace: nsslapd-threadnumber
nsslapd-threadnumber: 256
-
replace: nsslapd-maxthreadsperconn
nsslapd-maxthreadsperconn: 20
-
replace: nsslapd-idletimeout
nsslapd-idletimeout: 300
-
replace: nsslapd-maxdescriptors
nsslapd-maxdescriptors: 131072

#-------执行修改文件
ldapmodify -x -D "cn=Directory Manager" -w  $pass -H ldap://localhost:389 -f config_update.ldif
#先停再启 
stop-dirsrv 
start-dirsrv 
# 验证配置
cat /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif| grep sslapd-maxdescriptors

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