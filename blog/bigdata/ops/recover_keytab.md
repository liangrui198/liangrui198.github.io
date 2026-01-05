---
layout: default
title:  通过密钥恢复keytab文件
author: liangrui
description: "密钥密钥恢复keytab文件" 
keywords: kerberos,recover keytab,kdc,ldap
date: 2025-12-31
---



# 逆向恢复keytab文件
## 需求背景
  ambari服务器通过freeipa可以有很的管理keytab分发和生成新的keytab文件，在装节点的时候，都是自动生成对应的服务keytab文件，用户需要自己的keytab文件需要从freeipa client端生成。
如果某个keytab文件被覆盖或都服务端的keytab账号信息丢失，那么需要客户端需要全部更换，如果客户端很多，更换这个会很麻烦。  
能不能把客户端的keytab文件反向生成回去呢？答案是不可以的，因为：   
**keytab 文件本质：**它只是 KDC 数据库中某个 principal 的密钥副本，经过 master key 加密后存储在 LDAP/KDC 中。  
**KDC 数据库与 keytab 的关系：**  
KDC（LDAP 后端）保存的是 principal 的密钥（加密材料）。  
keytab 文件是客户端/服务端的副本，用来免交互认证。  
**不能直接导入 keytab：**
keytab 文件里的密钥是已经派生好的，不包含 KDC 数据库所需的完整属性（如 kvno、加密类型、salt）。  
KDC 数据库必须通过 kadmin.local 或 ipa-getkeytab 来生成并写入，这样才能保证 kvno 和加密算法一致。  

## ✅ 可行的解决方案
1：有备份的krbPrincipalKey密文  
2：必须保证两边的 KDC 数据库里存的密钥和客户端 keytab 完全一致  
3：确保 master key 相同    
   两个 FreeIPA/KDC 必须是同一个 realm，且共享同一个 master key。否则无法识别相同的密钥  
有了以上条件，可以手动导入，让客户端继续能够使用之前生成的keytab文件，即使服务端丢失了keytab信息也能导入进去。   

 

## 必须条件
### 确保masterKey一致
```shell
root@fs-hiido-kerberos-server04:/home/liangrui06# kdb5_util list_mkeys
Master keys for Principal: K/M@YYDEVOPS.COM
KVNO: 1, Enctype: aes256-cts-hmac-sha1-96, Active on: Thu Jan 01 08:00:00 CST 1970 *

root@ipa-65-189:/home/liangrui06# kdb5_util list_mkeys
Master keys for Principal: K/M@YYDEVOPS.COM
KVNO: 1, Enctype: aes256-cts-hmac-sha1-96, Active on: Thu Jan 01 08:00:00 CST 1970 *
```
### 有备份ldap中的principalKey
导出 principal 的密钥  
```shell
ldapsearch -x -h fs-hiido-kerberos-server04.xx.com  -LLL -D "cn=Directory Manager" -W    -b "cn=users,cn=accounts,dc=xx,dc=com"   uid=act_change krbPrincipalName krbPrincipalKey

# 导出全量普通用户 | (objectClass=posixAccount)：过滤出普通用户。你也可以换成 (uid=*)
ldapsearch  -h fs-hiido-kerberos-server04.hiido.host.xx.com -x -D "cn=Directory Manager" -W   -b "cn=users,cn=accounts,dc=yydevops,dc=com"   "(objectClass=posixAccount)" dn krbPrincipalKey > all_users.ldif

# 导出给定列表用户 
while read u; do
  ldapsearch -h fs-hiido-kerberos-server04.hiido.host.xx.com -x -LLL -D "cn=Directory Manager"  -y /root/ldap_pass.txt  -b "cn=users,cn=accounts,dc=yydevops,dc=com"   uid=$u dn krbPrincipalKey
done < userlist.txt > selected_users.ldif

# 格式化为可导入 LDIF |可以用 awk 自动加上：
awk '/^dn:/ {print; print "changetype: modify"; next} /^krbPrincipalKey/ {print "add: krbPrincipalKey"; print $0; next} {print}' selected_users.ldif > import_users.ldif




# 输出结果
Enter LDAP Password: 
dn: uid=act_change,cn=users,cn=accounts,dc=xx,dc=com
krbPrincipalName: act_change@xx.COM
krbPrincipalKey:: MIIBsqADAg...
```


## 操作步骤
### 构造 LDIF 文件
```
构造 LDIF 文件 /tmp/act_change.ldif
dn: uid=act_change,cn=users,cn=accounts,dc=testcluster,dc=com
changetype: modify
add: krbPrincipalKey
krbPrincipalKey:: MIHeoAMCAQGhAwIBAaIDAgEBowMCAQGkgccw...
```
### 新增用户
`ipa user-add act_change --first=act --last=change`
### 执行ldapmodify修改ldif
`ldapmodify -x -D "cn=Directory Manager" -W -f /tmp/act_change.ldif`
### KVNO调整
```bash
# 查看 KVNO
ktutil:  rkt /home/liangrui06/act_change.keytab 
ktutil:  list
slot KVNO Principal
---- ---- ---------------------------------------------------------------------
   1    1               act_change@TESTCLUSTER.COM
   2    1               act_change@TESTCLUSTER.COM
# 调整 KVNO  需要在CA服务上执行
kadmin.local -q "modprinc -kvno 1 act_change@TESTCLUSTER.COM"

# 查看
kadmin.local -q "getprinc xx@YYDEVOPS.COM"
Authenticating as principal admin/admin@YYDEVOPS.COM with password.
Principal: xx@YYDEVOPS.COM
Expiration date: [never]
Last password change: [never]
Password expiration date: [none]
Maximum ticket life: 1800 days 00:00:00
Maximum renewable life: 3600 days 00:00:00
Last modified: Sun Jan 04 17:16:01 CST 2026 (admin/admin@YYDEVOPS.COM)
Last successful authentication: [never]
Last failed authentication: [never]
Failed password attempts: 0
Number of keys: 6
Key: vno 1, aes256-cts-hmac-sha1-96
Key: vno 1, aes128-cts-hmac-sha1-96
Key: vno 1, des3-cbc-sha1
Key: vno 1, arcfour-hmac
Key: vno 1, camellia128-cts-cmac
Key: vno 1, camellia256-cts-cmac
MKey: vno 1
Attributes: REQUIRES_PRE_AUTH
Policy: [none]
```
## 验证 

```bash
# 丢失的keytab执行失败
liangrui06@ipa-65-189:~$ kinit -kt dw_liangrui2.keytab dw_liangrui2
kinit: Client 'dw_liangrui@YYDEVOPS.COM' not found in Kerberos database while getting initial credentials


# 之前丢失的keytab，按上面的流程重新导入后，执行成功
liangrui06@ipa-65-189:~$ kinit -kt dw_liangrui2.keytab dw_liangrui2
liangrui06@ipa-65-189:~$ klist
Ticket cache: FILE:/tmp/krb5cc_6416
Default principal: dw_liangrui2@YYDEVOPS.COM

Valid starting       Expires              Service principal
01/04/2026 17:19:11  12/09/2030 17:19:11  krbtgt/YYDEVOPS.COM@YYDEVOPS.COM
        renew until 11/13/2035 17:19:11
```

<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2026-01-05" class="date-value">2026-01-05</time>
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