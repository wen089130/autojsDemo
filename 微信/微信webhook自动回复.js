/**
 * 功能: 微信收到消息时, 把消息POST给你电脑上的服务(webhook),
 *       由你的服务调用本地大模型生成回复, 手机再把回复发出去。
 *
 * 适用: 大模型/agent 跑在你自己电脑上, 手机和电脑在同一个局域网(同一WiFi)。
 *
 * 数据约定(很重要, 你的服务端按这个来):
 *   手机 POST 过去的内容:
 *     { "from": "张三", "message": "在吗", "time": 1690000000000, "isGroup": false }
 *   你的服务要返回(HTTP 200, JSON):
 *     { "reply": "在的, 怎么了?" }
 *   如果 reply 为空或没有这个字段, 手机就不回复这条。
 *
 * 运行前必须:
 *   1. 开启"无障碍服务"(发消息用)
 *   2. 给 Auto.js 开启"通知使用权"(读微信通知用)
 *   3. 把下面的 WEBHOOK地址 改成你电脑的局域网IP和端口
 */

// ===================== 配置 =====================
var WEBHOOK地址 = "http://192.168.1.100:5000/wechat"; // 改成你电脑的局域网IP:端口
var 请求超时 = 30000;     // 等你的大模型出结果, 给久一点

var 微信包名 = "com.tencent.mm";
var 冷却毫秒 = 30 * 1000;        // 同一个人多久内只回一次, 防刷屏/死循环
var 回复群消息 = false;          // 是否也回复群消息(默认只回私聊)

// —— 降低封号风险的开关 ——
var 随机延时 = [3000, 12000];    // 发送前随机停 3~12 秒, 不要秒回(设为 null 关闭)
var 每日上限 = 200;              // 一天最多自动回复多少条, 超过就停(设为 0 不限制)

// ===================== 启动前检查 =====================
if (auto.service == null) {
    toast("请先开启无障碍服务!");
    app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" });
    exit();
}

toastLog("微信webhook自动回复已启动\nwebhook: " + WEBHOOK地址 +
         "\n如果没反应, 请确认已开启Auto.js的【通知使用权】");

var 上次回复时间 = {};   // 每人冷却
var 处理中 = false;      // 同一时间只发一条
var 今日计数 = { 日期: 今天(), 数量: 0 };

// ===================== 监听微信通知 =====================
events.observeNotification();
events.onNotification(function (n) {
    try {
        if (n.getPackageName() != 微信包名) return;

        var 发信人 = (n.getTitle() || "").trim();
        var 内容 = (n.getText() || "").trim();
        var 是群消息 = /^[^:：]{1,20}[:：]\s/.test(内容);

        if (!应该回复(发信人, 内容, 是群消息)) return;

        var now = Date.now();
        if (上次回复时间[发信人] && now - 上次回复时间[发信人] < 冷却毫秒) {
            log("【" + 发信人 + "】冷却中, 跳过");
            return;
        }
        上次回复时间[发信人] = now;

        threads.start(function () {
            处理一条消息(发信人, 内容, 是群消息, now);
        });
    } catch (e) {
        log("处理通知出错: " + e);
    }
});

setInterval(function () {}, 60 * 1000); // 保持运行


// ====================== 函数 ======================

function 应该回复(发信人, 内容, 是群消息) {
    if (!发信人 || !内容) return false;
    if (发信人 == "微信") return false;                 // 微信汇总通知
    if (/^\d+条(新)?消息$/.test(内容)) return false;
    if (/\[\d+条\]/.test(内容)) return false;
    if (内容.indexOf("正在运行") >= 0) return false;
    if (是群消息 && !回复群消息) {
        log("【" + 发信人 + "】疑似群消息, 已跳过");
        return false;
    }
    if (超过每日上限()) {
        toastLog("今日自动回复已达上限(" + 每日上限 + "), 暂停回复");
        return false;
    }
    return true;
}

function 处理一条消息(发信人, 内容, 是群消息, 时间) {
    var 等待截止 = Date.now() + 60000;
    while (处理中 && Date.now() < 等待截止) sleep(500);
    处理中 = true;
    try {
        log("收到【" + 发信人 + "】: " + 内容);
        var 回复 = 请求webhook(发信人, 内容, 是群消息, 时间);
        if (!回复) {
            log("webhook没返回回复, 跳过");
            return;
        }
        log("将回复【" + 发信人 + "】: " + 回复);

        if (随机延时) {
            var 等 = 随机数(随机延时[0], 随机延时[1]);
            log("随机等待 " + 等 + "ms 再发, 降低封号风险");
            sleep(等);
        }

        发送给好友(发信人, 回复);
        累加今日计数();
    } catch (e) {
        log("处理消息出错: " + e);
    } finally {
        处理中 = false;
    }
}

// 把消息发给你电脑上的服务, 返回回复文本
function 请求webhook(发信人, 内容, 是群消息, 时间) {
    try {
        var res = http.postJson(WEBHOOK地址, {
            from: 发信人,
            message: 内容,
            isGroup: 是群消息,
            time: 时间
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 请求超时
        });
        if (!res || res.statusCode != 200) {
            log("webhook请求失败, 状态码: " + (res ? res.statusCode : "无响应"));
            return null;
        }
        var data = res.body.json();
        return data && data.reply ? String(data.reply).trim() : null;
    } catch (e) {
        log("请求webhook出错(检查电脑服务是否开启、IP端口是否正确、是否同一WiFi): " + e);
        return null;
    }
}

function 发送给好友(好友, 消息) {
    app.launchPackage(微信包名);
    if (!waitForPackage(微信包名, 8000)) {
        toastLog("打开微信失败");
        return;
    }
    sleep(1500);

    var 搜索按钮 = desc("搜索").findOne(5000) || text("搜索").findOne(2000);
    if (搜索按钮 == null) {
        back(); sleep(1000);
        搜索按钮 = desc("搜索").findOne(5000) || text("搜索").findOne(2000);
    }
    if (搜索按钮 == null) { toastLog("找不到搜索按钮"); return; }
    搜索按钮.click();
    sleep(1200);

    var 搜索框 = className("android.widget.EditText").findOne(5000);
    if (搜索框 == null) { toastLog("找不到搜索输入框"); return; }
    搜索框.setText(好友);
    sleep(2000);

    var 结果 = text(好友).findOne(5000);
    if (结果 == null) { toastLog("没搜到【" + 好友 + "】, 无法回复"); return; }
    结果.click();
    sleep(1500);

    var 消息框 = className("android.widget.EditText").findOne(5000);
    if (消息框 == null) { toastLog("找不到聊天输入框"); return; }
    消息框.setText(消息);
    sleep(1000);

    var 发送按钮 = text("发送").findOne(5000);
    if (发送按钮 == null) { toastLog("找不到发送按钮"); return; }
    发送按钮.click();
    sleep(800);
    log("已回复【" + 好友 + "】");

    back(); sleep(500); back();
}

function waitForPackage(包名, 超时毫秒) {
    var 截止 = Date.now() + 超时毫秒;
    while (Date.now() < 截止) {
        if (currentPackage() == 包名) return true;
        sleep(300);
    }
    return false;
}

function 随机数(min, max) {
    return Math.floor(min + Math.random() * (max - min));
}

function 今天() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function 超过每日上限() {
    if (!每日上限) return false;
    if (今日计数.日期 != 今天()) 今日计数 = { 日期: 今天(), 数量: 0 };
    return 今日计数.数量 >= 每日上限;
}

function 累加今日计数() {
    if (今日计数.日期 != 今天()) 今日计数 = { 日期: 今天(), 数量: 0 };
    今日计数.数量++;
}
