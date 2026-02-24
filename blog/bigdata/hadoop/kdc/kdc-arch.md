---
layout: default
title:  kdc
author: liangrui
description: "kdc" 
keywords: kdc
date: 2026-02-13
---


# kdc架构
...待补充 

## 常用命令

```
pass = xx

# 检查复制状态 nsds5replicaLastUpdateStatus   
ldapsearch -LLL -x -H ldap://localhost:389     -D "cn=Directory Manager" -w $pass     -b "cn=replica,cn=dc\3Dyydevops\2Cdc\3Dcom,cn=mapping tree,cn=config"    "(objectClass=nsds5ReplicationAgreement)" cn nsDS5ReplicaHost nsds5replicaLastUpdateStatus

# 查看topologysegment
ipa topologysegment-find 

#删除复制协议
ipa topologysegment-del

#添加
ipa topologysegment-add --leftnode=fs-hiido-kerberos-server04.hiido.host.yydevops.com --rightnode=fs-hiido-kerveros-test08.hiido.host.yydevops.com

ldapdelete -x -H ldap://localhost -D "cn=Directory Manager" -w $pass   "cn=fs-hiido-kerberos-server04.hiido.host.yydevops.com-to-fs-hiido-kerveros-test08.hiido.host.yydevops.com,cn=replica,cn=dc\3Dyydevops\2Cdc\3Dcom,cn=mapping tree,cn=config"

#验证已删除
ldapsearch -LLL -x -H ldap://localhost -D "cn=Directory Manager" -w $pass   \
-b "cn=replica,cn=dc\3Dyydevops\2Cdc\3Dcom,cn=mapping tree,cn=config" "(cn=fs-hiido-kerberos-server04.hiido.host.yydevops.com-to-fs-hiido-kerveros-test08.hiido.host.yydevops.com)" cn

# ldapmodify 密码或kerberos  
ldapmodify -x -D "cn=Directory Manager" -W -f ref_test08.ldif
ldapmodify -H ldap://localhost:389 -Y GSSAPI -f ref_test08.ldif

#检查映射
ldapsearch -LLL -x -H ldap://localhost -D "cn=Directory Manager" -w ipaadmin4yycluster  -b "cn=config" "(objectClass=nsSaslMapping)"


```
### 证书相关
```
# 查看证书情况
getcert list | grep -B 10 2026-

#续订证书
getcert resubmit -i 20220901103045

# 停止跟踪坏掉的请求
getcert stop-tracking -i 20220901103045

# 重新提交新的请求
getcert request -d /etc/pki/pki-tomcat/alias     -n "subsystemCert cert-pki-ca"     -c dogtag-ipa-ca-renew-agent     -P 150763924800

getcert request -d /etc/pki/pki-tomcat/alias     -n "subsystemCert cert-pki-ca"     -c dogtag-ipa-ca-renew-agent     -p /etc/pki/pki-tomcat/password.conf



```

### 服务重启
```
systemctl status apache2.service

systemctl restart certmonger
systemctl restart pki-tomcatd.service
systemctl restart apache2.service
systemctl restart dirsrv@YYDEVOPS-COM.service




#可能会执行
sudo -u dirsrv kdestroy 
sudo -u dirsrv kinit -kt /etc/dirsrv/ds.keytab  ldap/`hostname`
sudo -u dirsrv klist 

pki-server subsystem-enable -i pki-tomcat ca
rm -rf /var/run/ipa/renewal.lock

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