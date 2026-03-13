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

# 重装时需要先卸载
ipa-client-install --uninstall

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

# 调式 主要是查看他访问具体ip的kdc信息
# 有时候kdc会用这个里面的ip去认证 /var/lib/sss/pubconf/kdcinfo.xx.COM,而不是/etc/krb5.conf里的ip，
# 是因为安装了sssd服务读取  /etc/sssd/sssd.conf
KRB5_TRACE=/dev/stdout kinit admin

# strace 调试执行栈信息
strace kinit admin

# hadoop 相关 如果有认证相关问题可以做以下调试
# keytab 诊断环境
hadoop kdiag
hadoop kdiag --keytab zk.service.keytab --principal zookeeper/devix.example.org@REALM > out.txt 2>&1
# 查看认证信息
hadoop org.apache.hadoop.security.UserGroupInformation
# hadoop开启jass debug
export HADOOP_JAAS_DEBUG=true
export HADOOP_OPTS="-Dsun.security.krb5.debug=true -Dsun.security.spnego.debug=true"
-Dsun.security.krb5.debug=true -Dsun.security.spnego.debug=true
# hadoop查看debug 信息 
hdfs --loglevel DEBUG dfs -ls /tmp
export HADOOP_ROOT_LOGGER=hadoop.root.logger=Debug,console

# 增加远程调试
export HADOOP_OPTS="$HADOOP_OPTS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5006"
hadoop  jar hdfs-client-op-1.0-SNAPSHOT.jar HdfsRetryTest
socat TCP-LISTEN:5006,fork,reuseaddr TCP:10.62.22.45:5006
socat TCP-LISTEN:5006,fork,reuseaddr TCP:10.12.69.204:5006

# nodemanger 远程调试
export YARN_NODEMANAGER_OPTS="$YARN_NODEMANAGER_OPTS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"
/usr/hdp/3.1.0.0-78/hadoop-yarn/bin/yarn --config /usr/hdp/3.1.0.0-78/hadoop/conf --daemon start nodemanager

# hadoop jar 远程调试
export HADOOP_CLIENT_OPTS="$HADOOP_CLIENT_OPTS -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"
hadoop --debug  jar      hdfs-client-op-1.0-SNAPSHOT.jar  

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

**每天定时备份**  
- 把下面脚本放到 /usr/local/bin/ipa_backup_daily.sh  
- 加入定时任务 /etc/crontab  

```shell 
#!/bin/bash

# echo '0 10 * * * root /bin/bash /usr/local/bin/ipa_backup_daily.sh  > /dev/null 2>&1' >> /etc/crontab
# chmod +x /usr/local/bin/ipa_backup_daily.sh

# 获取当前时间戳
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")

# 执行备份
ipa-backup --data --online

# 检查备份是否成功
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup successful: /var/lib/ipa/backup/ipa-data-$TIMESTAMP" >/var/log/ipa_backup.log
else
  echo "[$(date)] Backup failed!" >>/var/log/ipa_backup.log
  exit 1
fi

# 清理30天前的备份目录
find "/var/lib/ipa/backup/" -maxdepth 1 -type d -name "ipa-data-*" -mtime +30 -exec rm -rf {} \; -exec echo "[$(date)] Deleted old backup: {}" \; >>/var/log/ipa_backup.log
```  

## 进程监控&自动重启
**监控kdc 389ds keepalived进程，发现挂了主动重启**    
- 脚本放到 /root/check_ds.sh  
- 2分钟检查一次 echo "*/2 * * * * root /bin/bash /root/check_ds.sh  > /dev/null 2>&1"  >> /etc/crontab

```shell
#!/bin/bash

# 日志文件路径 touch /var/log/check-dirsrv.log
LOGFILE="/var/log/check-dirsrv.log"

# 告警脚本路径（你已有的 Python 脚本） 告警逻辑根据自己的场景去编写，这里只参考传参
ALERT_SCRIPT="/home/dspeak/xx.py"

# 固定参数
ID=45496
SID=367116
MSG_KEY=500
#不同告警key sed -i  s/MSG_KEY=500/MSG_KEY=502/g /root/check_ds.sh

# 检查 ns-slapd 进程是否存在
if ! pgrep -x ns-slapd > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - dirsrv not running, restarting..." | tee -a "$LOGFILE"
    /usr/sbin/start-dirsrv

    # 发送告警
    MESS="check dirsrv stopped  to auto started"
    PARM_STR="op_admin_dw=dw_liangrui&id=${ID}&sid=${SID}&msg=${MESS}&msg_key=${MSG_KEY}"
    CMD="python ${ALERT_SCRIPT} \"${PARM_STR}\""
    eval $CMD
else
    # 检查日志条数
    LINECOUNT=$(wc -l < "$LOGFILE" 2>/dev/null || echo 0)
    if [ "$LINECOUNT" -gt 10000 ]; then
        : > "$LOGFILE"   # 清空日志文件
        echo "$(date '+%Y-%m-%d %H:%M:%S') - logfile exceeded 10000 lines, cleared." >> "$LOGFILE"
    fi
    echo "$(date '+%Y-%m-%d %H:%M:%S') - dirsrv is running." >> "$LOGFILE"
fi

if ! pgrep -x krb5kdc > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - dirsrv not running, restarting..." | tee -a "$LOGFILE"
    systemctl start  krb5-kdc.service
    # 发送告警
    MESS="check krb5kdc stopped  to auto started"
    PARM_STR="op_admin_dw=dw_liangrui&id=${ID}&sid=${SID}&msg=${MESS}&msg_key=$((MSG_KEY + 200))"
    CMD="python ${ALERT_SCRIPT} \"${PARM_STR}\""
    eval $CMD
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - krb5kdc is running." >> "$LOGFILE"
fi

if ! pgrep -x keepalived > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - keepalived not running, restarting..." | tee -a "$LOGFILE"
    /usr/sbin/keepalived -f /etc/keepalived/keepalived.conf
    # 发送告警
    MESS="check keepalived stopped  to auto started"
    PARM_STR="op_admin_dw=dw_liangrui&id=${ID}&sid=${SID}&msg=${MESS}&msg_key=$((MSG_KEY + 200))"
    CMD="python ${ALERT_SCRIPT} \"${PARM_STR}\""
    eval $CMD
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - keepalived is running." >> "$LOGFILE"
fi

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

ldapmodify -x -H ldap://$(hostname):389 \
  -D "cn=Directory Manager" -w $pass <<EOF
dn: cn=ipaca,cn=ldbm database,cn=plugins,cn=config
changetype: modify
replace: nsslapd-cachememsize
nsslapd-cachememsize: 536870912
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
### KDC优化
#### 增加进程
**ubuntu16.04 freeipa4.3中优化,4.3默认是单进程，kdc需要多进程来提升并发**   
**文档参考**   
1：<a href="https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/tuning_performance_in_identity_management/assembly_adjusting-the-performance-of-the-kdc_tuning-performance-in-idm#proc_adjusting-the-length-of-the-kdc-listen-queue_assembly_adjusting-the-performance-of-the-kdc">proc_adjusting-the-length-of-the-kdc-listen-queue_assembly_adjusting-the-performance-of-the-kdc</a>    
2：<a href="https://docs.redhat.com/zh-cn/documentation/red_hat_enterprise_linux/10/html/tuning_performance_in_identity_management/adjusting-the-number-of-krb5kdc-processes  ">adjusting-the-number-of-krb5kdc-processes</a>   

```shell
#查看版本
dpkg -l | grep krb5-kdc

mkdir -p /etc/systemd/system/krb5-kdc.service.d/
#修改启动命令 增加-w 参数，指定进程数，推荐是机器的cpu核数，nproc 查看
vi /etc/systemd/system/krb5-kdc.service.d/performance.conf
cat /etc/systemd/system/krb5-kdc.service.d/performance.conf
[Service]
ExecStart=
ExecStart=/usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24

# 修改已存在的进程数
sed -i  s/24/16/g /etc/systemd/system/krb5-kdc.service.d/performance.conf

# 重启krb5
systemctl daemon-reload
systemctl restart krb5-kdc
# 查看 一共有25个进程，其中一个1是总进程负责调度子进程，不参与业务
ps -ef | grep krb5kdc
root     12736     1  0 12:10 ?        00:00:00 /usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24
root     12737 12736  0 12:10 ?        00:00:00 /usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24
root     12738 12736  0 12:10 ?        00:00:00 /usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24
root     12739 12736  0 12:10 ?        00:00:00 /usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24
root     12740 12736  0 12:10 ?        00:00:00 /usr/sbin/krb5kdc -P /var/run/krb5-kdc.pid -w 24
...

# 观察cpu中中断和上下文切换的情况 
# 观察 cs (context switches) 和 in (interrupts) 字段。如果数值在认证高峰期突然飙升到数十万，说明进程数可能设多了；
# 如果 CPU 的 us (user) 或 sy (system) 占用极高但 cs 稳定，说明你的配置正在全力高效运转。
vmstat 1

```
#### 每个域控制KDC行为的选项（原生MIT KDC的配置）
为了跟踪每个 Kerberos 域的锁定和解锁用户帐户，KDC 会在每个成功和身份验证失败后写入其数据库。   
通过调整 /etc/krb5.conf (ubuntu:/etc/krb5kdc/kdc.conf )文件的 [dbmodules] 部分中的以下选项，您可以最大程度减少 KDC 写入信息的频率来提高性能。     
disable_last_success 如果设置为 true，这个选项会阻止 KDC 更新到需要预身份验证的主条目的 Last successful authentication 字段。 

```conf
[dbmodules]
    YOUR-REALM.COM = {
        disable_last_success = true
    }
```
disable_lockout 如果设置为 true，这个选项会阻止 KDC 更新到需要预身份验证的主条目的 Last failed authentication 和 Failed password attempts 字段。设置此标志可能会提高性能，但禁用帐户锁定可能会被视为安全风险。

#### 每个域控制KDC行为的选项（freeipa 的配置）
freeipa某些配置是自己实现的，基于db_library = ipadb.so    
相关补丁: <a href="https://bugzilla.redhat.com/show_bug.cgi?id=824488">https://bugzilla.redhat.com/show_bug.cgi?id=824488</a>  
<a href="https://pagure.io/freeipa/issue/5313">https://pagure.io/freeipa/issue/5313</a>   
配置修改  

```shell 
#查询 
ipa config-show | grep "Password plugin features"
 Password plugin features: AllowNThash

ldapsearch -LLL -x -H ldap://localhost:389   -D "cn=Directory Manager" -w $pass  -b "cn=ipaConfig,cn=etc,dc=yydevops,dc=com"  ipaConfigString
ipaConfigString: AllowNThash

# 修改
ipa config-mod --ipaconfigstring="AllowNThash" --ipaconfigstring="KDC:Disable Last Success"
#验证配置
ipa config-show | grep "Password plugin features"
  Password plugin features: AllowNThash, KDC:Disable Last Success

# 重启kdc
systemctl restart krb5-kdc
#验证是否生效
 ipa user-show dw_liangrui2 --all  | grep krblastsuccessfulauth
  krblastsuccessfulauth: 20260305020601Z

#执行keytab login
kinit -kt dw_liangrui2.keytab dw_liangrui2

#用户没有记录最近登录时间，配置已生效
 ipa user-show dw_liangrui2 --all  | grep krblastsuccessfulauth
  krblastsuccessfulauth: 20260305020601Z

```


#### 调整 KDC 侦听队列的长度 （原生MIT KDC的配置）
您可以通过在 /var/kerberos/krb5kdc/kdc.conf (ubuntu:/etc/krb5kdc/kdc.conf)   
文件的 [kdcdefaults] 部分中设置 kdc_tcp_listen_backlog 选项来调整用于 KDC 守护进程的监听队列长度的大小。    
对于某些有大量 Kerberos 流量的 IdM 部署，默认值 5 可能太低，但如果设置的值太高会降低性能。  

查看当前的 kdc_tcp_listen_backlog值   
```shell
ss -lnt sport = :88

State       Recv-Q Send-Q        Local Address:Port                                                 Peer Address:Port              
LISTEN      0      5                  *:88                                                           *:*   
...      
# Send-Q 5说明默认是5         
```

```conf
# 修改配置   
[kdcdefaults]
 ...
   kdc_tcp_listen_backlog = 10
```
#### nsswitch本地用户频繁查找389ds问题
问题描述: 服从偶尔会卡顿，卡顿后虽然做了HA，会切到从节点上，但这个问题还是需要解决一下。  
kdc服务日志显示Unspecified GSS failure       
```log
Mar  6 15:16:08 ipa-78-172 ns-slapd: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')
Mar  6 15:16:35 ipa-78-172 ns-slapd: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')
Mar  6 15:17:02 ipa-78-172 ns-slapd: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')
```  
389ds日志显示 Cannot contact any KDC for realm 'YYDEVOPS.COM'   
/var/log/dirsrv/slapd-xx-COM/error  

```log 
[06/Mar/2026:15:16:35 +0800] slapd_ldap_sasl_interactive_bind - Error: could not perform interactive bind for id [] mech [GSSAPI]: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')) errno 115 (Operation now in progress)
[06/Mar/2026:15:16:35 +0800] slapi_ldap_bind - Error: could not perform interactive bind for id [] authentication mechanism [GSSAPI]: error -2 (Local error)
[06/Mar/2026:15:16:35 +0800] NSMMReplicationPlugin - agmt="cn=ipa-78-172.hiido.host.xx.xx.com-to-ipa-ca-70-11.hiido.host.xx.xx.com" (ipa-ca-70-11:389): Replication bind with GSSAPI auth failed: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM'))
[06/Mar/2026:15:17:02 +0800] slapd_ldap_sasl_interactive_bind - Error: could not perform interactive bind for id [] mech [GSSAPI]: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')) errno 115 (Operation now in progress)
[06/Mar/2026:15:17:02 +0800] slapi_ldap_bind - Error: could not perform interactive bind for id [] authentication mechanism [GSSAPI]: error -2 (Local error)
[06/Mar/2026:15:17:02 +0800] slapd_ldap_sasl_interactive_bind - Error: could not perform interactive bind for id [] mech [GSSAPI]: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM')) errno 115 (Operation now in progress)
[06/Mar/2026:15:17:02 +0800] slapi_ldap_bind - Error: could not perform interactive bind for id [] authentication mechanism [GSSAPI]: error -2 (Local error)
[06/Mar/2026:15:17:02 +0800] NSMMReplicationPlugin - agmt="cn=ipa-78-172.hiido.host.xx.xx.com-to-ipa-70-10.hiido.host.xx.xx.com" (ipa-70-10:389): Replication bind with GSSAPI auth failed: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM'))
[06/Mar/2026:15:17:02 +0800] NSMMReplicationPlugin - agmt="cn=meToipa-78-184.hiido.host.xx.xx.com" (ipa-78-184:389): Replication bind with GSSAPI auth failed: LDAP error -2 (Local error) (SASL(-1): generic failure: GSSAPI Error: Unspecified GSS failure.  Minor code may provide more information (Cannot contact any KDC for realm 'YYDEVOPS.COM'))
[06/Mar/2026:15:17:05 +0800] NSMMReplicationPlugin - agmt="cn=ipa-78-172.hiido.host.xx.xx.com-to-ipa-70-10.hiido.host.xx.xx.com" (ipa-70-10:389): Replication bind with GSSAPI auth resumed
[06/Mar/2026:15:17:05 +0800] NSMMReplicationPlugin - agmt="cn=ipa-78-172.hiido.host.xx.xx.com-to-ipa-ca-70-11.hiido.host.xx.xx.com" (ipa-ca-70-11:389): Replication bind with GSSAPI auth resumed
[06/Mar/2026:15:17:05 +0800] NSMMReplicationPlugin - agmt="cn=meToipa-78-184.hiido.host.xx.xx.com" (ipa-78-184:389): Replication bind with GSSAPI auth resumed
```
这些日志看上去节点在复制或kinit时无法正常登录或复制，原因是kdc认证异常，并没有看到明确的问题，再看看389ds这个时间到低在做什么  
/var/log/dirsrv/slapd-YYDEVOPS-COM/access   
```log
[06/Mar/2026:15:40:06 +0800] conn=1884 op=26 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=liangrui06)..."
[06/Mar/2026:15:40:06 +0800] conn=1884 op=26 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:06 +0800] conn=1884 op=27 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=liangrui06)..."
[06/Mar/2026:15:40:06 +0800] conn=1884 op=27 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:06 +0800] conn=1884 op=28 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=liupeiyue)......"
[06/Mar/2026:15:40:06 +0800] conn=1884 op=29 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:06 +0800] conn=1884 op=30 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=huangzan)..."
[06/Mar/2026:15:40:06 +0800] conn=1884 op=30 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:06 +0800] conn=1884 op=31 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=xieyu09)..."
[06/Mar/2026:15:40:06 +0800] conn=1884 op=31 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:06 +0800] conn=1884 op=32 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=huangxiangjun02)..."
[06/Mar/2026:15:40:06 +0800] conn=1884 op=32 RESULT err=0 tag=101 nentries=0 etime=0
[06/Mar/2026:15:40:09 +0800] conn=645 op=127707 SRCH base="dc=yydevops,dc=com" scope=2 filter="(&(|(objectClass=krbprincipalaux)(objectClass=krbprincipal))(krbPrincipalName=dev_op@YYDEVOPS.COM))" attrs="krbPrincipalName krbCanonicalName ipaKrbPrincipalAlias krbUPEnabled krbPrincipalKey krbTicketPolicyReference krbPrincipalExpiration krbPasswordExpiration krbPwdPolicyReference krbPrincipalType krbPwdHistory krbLastPwdChange krbPrincipalAliases krbLastSuccessfulAuth krbLastFailedAuth krbLoginFailedCount krbExtraData krbLastAdminUnlock krbObjectReferences krbTicketFlags krbMaxTicketLife krbMaxRenewableAge nsAccountLock passwordHistory ipaKrbAuthzData ipaUserAuthType ipatokenRadiusConfigLink objectClass"
...

# 这个用户不存在freeipa中，但是他会一直重复在389ds中查找  
grep liangrui06  access | wc -l
567

# 看看那个ip在搞事情
# grep 'conn=1884 fd=' access
[06/Mar/2026:18:10:03 +0800] conn=79 fd=1884 slot=1884 connection from 10.12.66.242 to 10.12.78.184

# 原来是ambari
# 破案了！Ambari Server 正是导致 389ds 查询泛滥的根源

```       
看到一些本地的用户信息?并且这些用户也不在ipa用户中， ipa user-show liangrui06 完全没有？ 这是什么鬼逻辑    
打开 cat /etc/nsswitch.conf   才知道问题，这个玩意是本地Name Service Switch服务(系统查询用户服务)，本地用户操作，他也会去sssd服务中找到信息，sssd再去389ds中查找用户，但每次都查不到，cache中也不会有这个信息，就一直反复查找，在遇到节点复制的时候可能会有冲突，导致卡顿了。    
```shell
# /etc/nsswitch.conf
passwd:         compat sss
group:          compat sss
shadow:         compat sss
gshadow:        files

hosts:          files dns
networks:       files

protocols:      db files
services:       db files sss
ethers:         db files
rpc:            db files

netgroup:       nis sss
sudoers: files sss
```
**解决方案1: nsswitch配置优化**   
```shell 
# 修改nsswitch
sed -i s/'compat sss'/'files [success=return] sss'/g /etc/nsswitch.conf
sed -i s/'sudoers: files sss'/'sudoers: files [success=return] sss'/g /etc/nsswitch.conf

```
**2:sssd中排除本地用户**   
这个需要保证filter_users确实不存在freeipa中，不然会彻底屏蔽掉这些用户，根据自己本地情况写     
```shell 
/etc/sssd/sssd.conf
[nss]
homedir_substring = /home
# 显式忽略这些本地用户（多个用户用逗号隔开）
# 显式忽略本地组
filter_users = root,user_00,user_01,user_02,yuwanfu,backup,dspeak,huangxiangjun02,huangzan,hujinli,liangrui06,liangrui,liupeiyue,xieyu09
filter_groups = root,execute,user_00,user_01,user_02,backup,dspeak,huangxiangjun02,huangzan,hujinli,liangrui06,liangrui,liupeiyue,xieyu09

# 清理cache 
sss_cache -E
#或
systemctl stop sssd
rm -f /var/lib/sss/db/*

# 重启ssd
systemctl restart sssd
systemctl status sssd
```
**全库查询的问题**
uid=\2A 这是uid=*的意思, conn=3708是本地操作的，是sssd服务本身事件引起的    
```
[09/Mar/2026:14:36:11 +0800] conn=3708 op=35 SRCH base="cn=accounts,dc=yydevops,dc=com" scope=2 filter="(&(uid=\2A)(objectClass=posixAccount)(uid=*) .......
```
原因可能是，如果出现很频繁，需要排查其它原因         
1：组解析（Group Membership Expansion）  
2：服务启动/数据库重建    

解决：
```conf
[domain/hiido.host.xx.com]
...
#ldap_use_tokengroups：什么是 Tokengroups？这是 LDAP 的一种加速机制，用于一次性获取用户所属的所有嵌套组（Nested Groups）。
#为什么要关？性能开销：当用户登录或跑作业（sudo -s）时，如果开启此项，SSSD 会向 389ds 发起复杂的插件调用（memberOf 逻辑）。
ldap_use_tokengroups = False
enumerate = False   
#enumerate:default false , SSSD是否应从目录提供程序（例如 Active Directory 或 LDAP）下载并缓存所有用户和组
#验证 getent passwd | wc -l

```
**sssd缓存优化**  
```conf
[domain/hiido.host.yydevops.com]
#entry_cache_timeout 延长用户信息（UID/GID）缓存时间（默认 5400秒/1.5小时，建议改为 12-24小时）
#entry_cache_group_timeout 延长组信息缓存时间（默认 Default: entry_cache_timeout，建议改为 6小时）
#entry_cache_sudo_timeout 延长 Sudo 规则缓存（默认 Default: entry_cache_timeout，建议改为 6小时）
entry_cache_timeout = 43200
entry_cache_group_timeout = 21600
entry_cache_sudo_timeout = 21600
ignore_group_members = True
#ignore_group_members  忽略那些无法解析的组（防止 SSSD 钻牛角尖） SSSD 仅检索组对象本身的信息，而不检索其成员的信息，从而显著提升性能
#ldap_group_nesting_level  如果 ldap_schema 设置为支持嵌套组的模式格式 开启增量搜索，防止 SSSD 每次都拉取整个组的成员 默认值：2
ldap_group_nesting_level = 2 
[nss]
...
# 增加内存缓存的大小（提高 getpwnam 的响应速度）
#Option memcache_size_passwd DEFAULT VALUE: 8
# Option memcache_size_group DEFAULT VALUE: 6
memcache_size_passwd = 512
memcache_size_group = 128
```  
**最后检查389ds是否还有压力**   
```shell
grep etime= /var/log/dirsrv/slapd-YYDEVOPS-COM/access | tail -n 100
[10/Mar/2026:15:13:58 +0800] conn=6265 op=274724 RESULT err=0 tag=101 nentries=1 etime=0
[10/Mar/2026:15:13:58 +0800] conn=6265 op=274725 RESULT err=0 tag=101 nentries=1 etime=0
[10/Mar/2026:15:13:58 +0800] conn=6265 op=274726 RESULT err=0 tag=101 nentries=1 etime=0
...
# etime=0 说明当前没有查询压力    
```

#### nodemnager的for zookeeper优化
kdc日志一直输出nm/host for zookeeper的认证日志，这是因为nm没有使用cache，每次和zk交互都会认证一下kdc    
```shell
Mar 12 11:01:59 ipa-70-2 krb5kdc[45529]: AS_REQ (4 etypes {18 17 16 23}) 10.12.69.236: NEEDED_PREAUTH: nm/fs-hiido-dn-12-69-236.hiido.host.int.yy.com@YYDEVOPS.COM for krbtgt/YYDEVOPS.COM@YYDEVOPS.COM, Additional pre-authentication required
Mar 12 11:02:00 ipa-70-2 krb5kdc[45529]: AS_REQ (4 etypes {18 17 16 23}) 10.12.69.236: ISSUE: authtime 1773284519, etypes {rep=18 tkt=18 ses=18}, nm/fs-hiido-dn-12-69-236.hiido.host.int.yy.com@YYDEVOPS.COM for krbtgt/YYDEVOPS.COM@YYDEVOPS.COM
Mar 12 11:02:01 ipa-70-2 krb5kdc[45534]: TGS_REQ (4 etypes {18 17 16 23}) 10.12.69.236: ISSUE: authtime 1773284519, etypes {rep=18 tkt=23 ses=18}, nm/fs-hiido-dn-12-69-236.hiido.host.int.yy.com@YYDEVOPS.COM for zookeeper/fs-hiido-jnzk-21-116-2.hiido.host.yydevops.com@YYDEVOPS.COM
Mar 12 11:04:08 ipa-70-2 krb5kdc[45532]: AS_REQ (4 etypes {18 17 16 23}) 10.12.69.236: NEEDED_PREAUTH: nm/fs-hiido-dn-12-69-236.hiido.host.int.yy.com@YYDEVOPS.COM for krbtgt/YYDEVOPS.COM@YYDEVOPS.COM, Additional pre-authentication required

# 日志解析  
# 第一阶段 AS_REQ NEEDED_PREAUTH  Pre-Authentication（预认证）我知道这个用户存在，但你得证明你是它。请用你的 Keytab 加密一个当前时间戳发给
# 第二阶段 TGS_REQ ISSUE 解密成功，时间戳也对得上，确认是本人。于是记录 ISSUE 并把 TGT 发给 NM。
```
**解决优化** 
如果是nm有用到jass模块，启用ticket cache,  修改 yarn_nm_jaas.conf 的配置   
/var/lib/ambari-server/resources/stacks/HDP/3.0/services/YARN/package/templates/ 

```conf
Client {
    com.sun.security.auth.module.Krb5LoginModule required
    useKeyTab=true
    storeKey=true
    useTicketCache=true
    renewTGT=true
    doNotPrompt=true
    keyTab="{{nodemanager_keytab}}"
    principal="{{nodemanager_principal_name}}";
};
com.sun.security.jgss.krb5.initiate {
    com.sun.security.auth.module.Krb5LoginModule required
    renewTGT=true
    doNotPrompt=true
    useKeyTab=true
    keyTab="{{nodemanager_keytab}}"
    principal="{{nodemanager_principal_name}}"
    storeKey=true
    useTicketCache=true;
};
```
2:ambari监控问题,他会把监控数据写到zk产生的，如果不需要，也可以直接干掉这个监控服务           
```log 
# nm日志 
2026-03-11 06:22:12,115 WARN  availability.MetricCollectorHAHelper (MetricCollectorHAHelper.java:findLiveCollectorHostsFromZNode(90)) - Unable to connect to zookeeper.

# 查看和修复测试    
cat /etc/hadoop/conf/hadoop-metrics2.properties

sed -i s/nodemanager.sink.timeline/#nodemanager.sink.timeline/g  /etc/hadoop/conf/hadoop-metrics2.properties
sudo -s su yarn /bin/bash -c '/usr/hdp/3.1.0.0-78/hadoop-yarn/bin/yarn --daemon stop nodemanager'
sudo -s su yarn /bin/bash -c '/usr/hdp/3.1.0.0-78/hadoop-yarn/bin/yarn --daemon start nodemanager'

# 还需要在ambari中的hdfs配置模板中注掉    
```
#### 389ds监控  

```shell 
# 版本
/usr/sbin/ns-slapd --version

#监控4.8会有   4.3没有dsconf
INSTANCE_NAME=$(ls /etc/dirsrv/ | grep slapd- | head -1 | sed 's/slapd-//')
dsconf $INSTANCE_NAME replication monitor
输入 cn=Directory Manager

# 查看389ds后端监控  
ldapsearch -LLL -Y EXTERNAL -H ldapi://%2fvar%2frun%2fslapd-YYDEVOPS-COM.socket -b "cn=monitor,cn=userRoot,cn=ldbm database,cn=plugins,cn=config"

# 调整锁 # 修改前务必备份
stop-dirsrv
cp /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif /root/dse.ldif.bak.20260312  
grep nsslapd-db-locks  /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif
sed -i s/'nsslapd-db-locks: 10000'/'nsslapd-db-locks: 100000'/g /etc/dirsrv/slapd-YYDEVOPS-COM/dse.ldif
start-dirsrv
systemctl status dirsrv@YYDEVOPS-COM.service

#  查看锁信息
ldapsearch -LLL -Y EXTERNAL -H ldapi://%2fvar%2frun%2fslapd-YYDEVOPS-COM.socket -b "cn=config,cn=ldbm database,cn=plugins,cn=config" | grep lock


# 查看当前连接
ldapsearch -LLL -x -b "cn=monitor" -H ldap://localhost:389 | grep connections

# 查看进程当前 FD 使用情况
pid=$(pidof ns-slapd)
ls -l /proc/$pid/fd | wc -l
lsof -p $pid | awk '{print $5}' | sort | uniq -c

# 查看线程与阻塞点
ps -L -p $pid -o pid,tid,psr,pcpu,stat,comm
top -H -p $pid

# 查看ns-slapd进程的线程
ps -L -p $(pidof ns-slapd) -o pid,tid,psr,pcpu,time,comm

# 或使用更详细的输出
ps -eLf | grep "ns-slapd" | grep -v grep

# 查看线程状态分布
ps -L -p $(pidof ns-slapd) -o state | sort | uniq -c
# 输出示例：
#  20 R  # 运行中
#  15 S  # 睡眠中
#   5 D  # 不可中断睡眠（通常是在等IO或锁）

# 查看复制相关线程
top -H -p $(pidof ns-slapd) -b -n 1 | grep -E "(repl|slapd)"

# 或使用htop更直观
# htop -p $(pidof ns-slapd)
# 按H显示线程，按F2设置显示列，添加STATE和COMMAND

# 检查复制线程的堆栈
gdb -p $(pidof ns-slapd) -ex "thread apply all bt" -ex "detach" -ex "quit" 2>/dev/null | \
  grep -A10 "repl" | head -50


# 捕获线程栈（定位阻塞函数）
gdb -p $pid -batch -ex "thread apply all bt" > /tmp/slapd_bt.txt



```


### 构建冗余环形拓扑
为了实现任意单节点宕机时仍能保持全网同步，你需要：增加关键节点之间的复制关系   
可以通过页面或freeipa命令查看当前的默认topologysegment    
`ipa topologysegment-find    ` 
然后找出单点的节点，进行增加复制节点    
```shell
ipa topologysegment-add domain ipa-70-2.hiido.host.int.yy.com-to-ipa-70-3.hiido.host.int.yy.com --left ipa-70-2.hiido.host.int.yy.com --right ipa-70-3.hiido.host.int.yy.com --direction=both

.....

# 执行完后，使用以下命令确认拓扑是否连通：
ipa topologysegment-verify domain

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

<!--评论区-->
<div id="giscus-comments" style="max-width:900px;margin:2em auto 0 auto;padding:0 1em;"></div>
<script>
  insertGiscusComment('giscus-comments');
</script>