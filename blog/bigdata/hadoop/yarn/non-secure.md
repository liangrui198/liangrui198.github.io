---
layout: default
title:  non secure
author: liangrui
description: "YARN non secure" 
keywords: hadoop,yarn,nonsecure
date: 2025-10-20
---

## HDFS用户代理配置
Hadoop 允许您配置代理用户代表其他用户提交作业或访问 HDFS；这称为模拟。启用模拟后，任何使用代理提交的作业都将以被模拟用户的现有权限级别执行，而不是以超级用户（例如）的权限级别执行hdfs。  
所有代理用户都在同一位置进行配置，core-site.xml以便 Hadoop 管理员实现集中式访问控制。  
要配置代理用户，请在core-site.xml属性中设置  
```
hadoop.proxyuser.<proxy_user>.hosts  
hadoop.proxyuser.<proxy_group>.groups
hadoop.proxyuser.<proxy_user>.users
```

## YARN用户代理访问HDFS
如果是ambari管安装，会自动把yarn用户设置为可代理的用户权限，hosts了制为rm的服务器，这样所有用户都可以proxy yarn在rm的主机上访问hdfs（yarn拥有的hdfs权限）。  
例：
![alt text](../../ops/img/image-40.png)   

### 关于新增用户跑作业问题
正常情况下的当前配置，如果提交了一个系统上没有的用户，会抛出异常，因为yarn以实际提交keytab用户的用户来运行作业，即使用spark代理用户提交上去，nm也会取实际代理用户来跑作业。    
例：(以下这种的意思是业务用户user01使用了bus_user的代理认证跑作业，但实际权限还是用的是user01)
```
// hadoop配置增加 core.xml
 <property>
     <name>hadoop.proxyuser.bus_user.hosts</name>
     <value>*</value>
   </property>
   <property>
     <name>hadoop.proxyuser.bus_user.users</name>
     <value>*</value>
   </property>
   <property>
     <name>hadoop.proxyuser.bus_user.groups</name>
     <value>*</value>
   </property>

// keytab login
kinit -kt bus_user.keytab bus_user

//submit spark to proxy 
/data/spark/bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master yarn --deploy-mode cluster \
  --executor-memory 1G --driver-memory 1G \
  --proxy-user user01   \
  --name SparkPi \
  --num-executors 2 \
  /data/spark/examples/jars/spark-examples_2.12-3.2.1.jar 1000

```
备注：spark 不能同时指定--proxy-user 和 --principal ,出于安全考虑，spark submit时需要从kinit中登录keytab凭证，因为如果指定了keytab文件，spark会上传这个文件，那么被代理的用户就可以取得这个文件，这是很不安全的。  
```
    if (proxyUser != null && principal != null) {
      error("Only one of --proxy-user or --principal can be provided.")
    }
```
作业异常日志  
```
25/12/01 15:51:57 WARN YarnSchedulerBackend$YarnSchedulerEndpoint: Requesting driver to remove executor 4 for reason Container from a bad node: container_e174_1763451000295_3150_02_000005 on host: on-test-hadoop-65-239.hiido.host.int.xx.com. Exit status: -1000. Diagnostics: [2025-12-01 15:51:54.253]Application application_1763451000295_3150 initialization failed (exitCode=255) with output: main : command provided 0
main : run as user is user01
main : requested yarn user is user01
User user01 not found
```
这里摸改了yarn container的启动脚本，发果发现系统上没有这个用户，就在linux系统是 adduser一个新用户。   
但想在起用了安全模式集群下，屏蔽业务用户在服务器上起进程，想用统一的用户来起进程，这个目前做不到。  
如果集群启用了安全模式，非安全模式的配置全部无效。  

安全模式下需要给客户端开一个可代理的账号，例：    
```

```

## 客户端需要代理用户操作
spark 实现k8s,效仿yarn功能：https://issues.apache.org/jira/browse/SPARK-25355  
yarn 文档：https://hadoop.apache.org/docs/current/hadoop-project-dist/hadoop-common/Superusers.html  
安全的 Hadoop+YARN 集群和proxy-user身份模拟
:https://github.com/spark-notebook/spark-notebook/blob/master/docs/proxyuser_impersonation.md  



## 非安全集群中用户模式
在没有启用权限和认证的集群中，可以让所有container进程都用统一的用户去跑进程，相关配置如下：  
```yarn.nodemanager.linux-container-executor.nonsecure-mode.limit-users default true```  
这决定了在非安全集群中 LCE 应使用哪一种模式。如果此值设置为“true”，那么所有容器都将按照 yarn.nodemanager.linux-container-executor.nonsecure-mode.local-user 中指定的用户身份启动。如果此值设置为“false”，那么容器将按照提交应用程序的用户身份运行。   
```yarn.nodemanager.linux-container-executor.nonsecure-mode.local-user	default nobody ```  
当在非安全模式下使用 Linux 容器执行器（此用法场景之一是使用 cgroups）时，容器将以 UNIX 用户身份运行，此时会使用 yarn.nodemanager.linux-container-executor.nonsecure-mode.limit-users 参数（该参数的设置值为 true）。  

### CGroups 和安全性
CGroups 本身没有安全方面的要求。但是，LinuxContainerExecutor 有一些要求。如果以非安全模式运行，默认情况下，LCE 会以用户“nobody”的身份运行所有作业。可以通过将“yarn.nodemanager.linux-container-executor.nonsecure-mode.local-user”设置为所需的用户来更改此用户。此外，也可以将其配置为以提交作业的用户身份运行作业。在这种情况下，“yarn.nodemanager.linux-container-executor.nonsecure-mode.limit-users”应设置为 false。  
**配置效果**  

| yarn.nodemanager.linux-container-executor.nonsecure-mode.local-user | yarn.nodemanager.linux-container-executor.nonsecure-mode.limit-users | User running jobs |
| --- | --- | --- |
| (default) | (default) | nobody |
| yarn | (default) | yarn |
| yarn | false | (User submitting the job) |






<div class="post-date">
  <span class="calendar-icon">📅</span>
  <span class="date-label">发布：</span>
  <time datetime="2025-10-20" class="date-value">2025-10-20</time>
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