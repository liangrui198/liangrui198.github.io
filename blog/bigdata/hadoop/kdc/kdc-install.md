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
apt-get update
apt-get install -y freeipa-server

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
## 客户端安装
```bash 
#安装client
apt-get install freeipa-client
#增加组权限
ipa hostgroup-add-member ipaservers --hosts ipa-test-65-194.hiido.host.xx.com
# 配置指向访问地个副本节点
ipa-client-install --domain=hiido.host.xx.com --realm=YYDEVOPS.COM --server=ipa-test-65-188.hiido.host.xx.com
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


日志查看4.3和4.8输出不同文件
tailf /var/log/daemon.log
tailf /var/log/auth.log

```

## 配置优化



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