/**
 * 功能: 微信收到好友消息时, 用大模型(AI)自动生成回复并发出去
 * 思路: 监听微信通知 -> 取出发信人和内容 -> 调用大模型API生成回复 -> 打开聊天发送
 *
 * 运行前必须做两件事:
 *   1. 开启"无障碍服务"(用来操作微信界面发消息)
 *   2. 给 Auto.js 开启"通知使用权"(设置->通知使用权/Notification access, 用来读取微信通知)
 *
 * 还要填下面的【大模型配置】里的 API密钥。
 * 默认用 DeepSeek(便宜, 接口兼容 OpenAI 格式), 也可以换成通义/智谱/OpenAI 等,
 * 只要是 OpenAI 兼容接口, 改一下 API地址 和 模型 即可。
 */

// ===================== 大模型配置(按需修改) =====================
var 大模型 = {
    API地址: "https://api.deepseek.com/chat/completions",
    API密钥: "在这里填你的key",        // 必填! 例如 sk-xxxxxxxx
    模型: "deepseek-chat",
    系统提示: "你在帮我自动回复微信消息。请用中文、口语化、简短自然地回复对方," +
            "像本人在聊天一样, 一句话即可, 不要带任何前缀或解释。",
    超时毫秒: 20000
};

// ===================== 行为配置 =====================
var 微信包名 = "com.tencent.mm";
var 冷却毫秒 = 30 * 1000;   // 同一个人多久内只回复一次, 防止刷屏/死循环
var 回复群消息 = false;     // 是否也回复群消息(默认只回私聊好友)

// ===================== 启动前检查 =====================
if (auto.service == null) {
    toast("请先开启无障碍服务!");
    app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" });
    exit();
}
if (大模型.API密钥 == "在这里填你的key" || !大模型.API密钥) {
    alert("请先在脚本顶部的【大模型配置】里填写 API密钥");
    exit();
}

toastLog("AI微信自动回复已启动\n如果没反应, 请确认已开启Auto.js的【通知使用权】");

// 记录每个人上次回复的时间, 用于冷却
var 上次回复时间 = {};
// 同一时间只处理一条, 避免多个回复流程互相打架
var 处理中 = false;

// ===================== 监听微信通知 =====================
events.observeNotification();
events.onNotification(function (n) {
    try {
        if (n.getPackageName() != 微信包名) return;

        var 发信人 = (n.getTitle() || "").trim();
        var 内容 = (n.getText() || "").trim();

        if (!应该回复(发信人, 内容)) return;

        // 冷却判断
        var now = Date.now();
        if (上次回复时间[发信人] && now - 上次回复时间[发信人] < 冷却毫秒) {
            log("【" + 发信人 + "】在冷却时间内, 跳过");
            return;
        }
        上次回复时间[发信人] = now;

        // 用单独线程处理, 不阻塞通知监听
        threads.start(function () {
            处理一条消息(发信人, 内容);
        });
    } catch (e) {
        log("处理通知出错: " + e);
    }
});

// 让脚本一直运行
setInterval(function () {}, 60 * 1000);


// ====================== 下面是各个步骤的函数 ======================

// 判断这条通知是不是需要回复的好友消息
function 应该回复(发信人, 内容) {
    if (!发信人 || !内容) return false;
    // 过滤微信自身的汇总/服务通知
    if (发信人 == "微信") return false;
    if (/^\d+条(新)?消息$/.test(内容)) return false;
    if (/\[\d+条\]/.test(内容)) return false;       // "[3条]xxx" 这种汇总
    if (内容.indexOf("正在运行") >= 0) return false;
    // 群消息: 微信群通知的内容一般是 "某人: 具体内容", 这里按需过滤
    var 是群消息 = /^[^:：]{1,20}[:：]\s/.test(内容);
    if (是群消息 && !回复群消息) {
        log("【" + 发信人 + "】疑似群消息, 已跳过");
        return false;
    }
    return true;
}

// 处理一条消息: 生成回复并发送
function 处理一条消息(发信人, 内容) {
    // 排队, 避免并发操作微信界面
    var 等待截止 = Date.now() + 30000;
    while (处理中 && Date.now() < 等待截止) {
        sleep(500);
    }
    处理中 = true;
    try {
        log("收到【" + 发信人 + "】: " + 内容);
        var 回复 = 生成回复(发信人, 内容);
        if (!回复) {
            toastLog("大模型没有返回内容, 跳过");
            return;
        }
        log("AI回复【" + 发信人 + "】: " + 回复);
        发送给好友(发信人, 回复);
    } catch (e) {
        log("处理消息出错: " + e);
    } finally {
        处理中 = false;
    }
}

// 调用大模型, 返回一句回复文本
function 生成回复(发信人, 内容) {
    var body = {
        model: 大模型.模型,
        messages: [
            { role: "system", content: 大模型.系统提示 },
            { role: "user", content: "对方(" + 发信人 + ")对我说: " + 内容 }
        ],
        stream: false
    };
    var res = http.postJson(大模型.API地址, body, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + 大模型.API密钥
        },
        timeout: 大模型.超时毫秒
    });
    if (!res || res.statusCode != 200) {
        log("大模型请求失败, 状态码: " + (res ? res.statusCode : "无响应"));
        if (res) log(res.body.string());
        return null;
    }
    var data = res.body.json();
    try {
        return (data.choices[0].message.content || "").trim();
    } catch (e) {
        log("解析大模型返回出错: " + e + "\n" + JSON.stringify(data));
        return null;
    }
}

// 打开和某个好友的聊天界面, 发送一条消息
function 发送给好友(好友, 消息) {
    app.launchPackage(微信包名);
    if (!waitForPackage(微信包名, 8000)) {
        toastLog("打开微信失败");
        return;
    }
    sleep(1500);

    // 进入微信主界面的搜索
    var 搜索按钮 = desc("搜索").findOne(5000) || text("搜索").findOne(2000);
    if (搜索按钮 == null) {
        // 可能还停在上次的聊天界面, 返回一次再找
        back();
        sleep(1000);
        搜索按钮 = desc("搜索").findOne(5000) || text("搜索").findOne(2000);
    }
    if (搜索按钮 == null) {
        toastLog("找不到搜索按钮");
        return;
    }
    搜索按钮.click();
    sleep(1200);

    // 输入好友昵称
    var 搜索框 = className("android.widget.EditText").findOne(5000);
    if (搜索框 == null) {
        toastLog("找不到搜索输入框");
        return;
    }
    搜索框.setText(好友);
    sleep(2000);

    var 结果 = text(好友).findOne(5000);
    if (结果 == null) {
        toastLog("没搜到【" + 好友 + "】, 无法回复");
        return;
    }
    结果.click();
    sleep(1500);

    // 在聊天界面输入并发送
    var 消息框 = className("android.widget.EditText").findOne(5000);
    if (消息框 == null) {
        toastLog("找不到聊天输入框");
        return;
    }
    消息框.setText(消息);
    sleep(1000);

    var 发送按钮 = text("发送").findOne(5000);
    if (发送按钮 == null) {
        toastLog("找不到发送按钮");
        return;
    }
    发送按钮.click();
    sleep(800);
    log("已回复【" + 好友 + "】");

    // 发完返回到主界面, 方便接收下一条
    back();
    sleep(500);
    back();
}

// 等待某个包名出现在前台
function waitForPackage(包名, 超时毫秒) {
    var 截止 = Date.now() + 超时毫秒;
    while (Date.now() < 截止) {
        if (currentPackage() == 包名) return true;
        sleep(300);
    }
    return false;
}
