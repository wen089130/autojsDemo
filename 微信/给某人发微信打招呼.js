/**
 * 功能: 自动给微信里指定的某个好友发一条消息(默认"你好")
 * 用法: 在 Auto.js 里运行本脚本, 按提示输入好友昵称和要发的内容即可
 * 依赖: 需要开启无障碍服务, 安卓7.0以上
 * 说明: 微信版本不同控件id会变, 所以这里尽量用文字/描述来定位, 兼容性更好
 */

var 微信包名 = "com.tencent.mm";

// ===== 1. 检查无障碍服务 =====
if (auto.service == null) {
    toast("请先开启无障碍服务!");
    // 跳转到无障碍设置页, 开启后再回来运行
    app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" });
    exit();
}

// ===== 2. 让用户填写好友昵称和消息内容 =====
var 好友 = dialogs.rawInput("请输入好友的微信昵称(要完全一致)", "");
if (!好友) {
    toast("没有输入好友昵称, 退出");
    exit();
}
var 消息 = dialogs.rawInput("请输入要发送的内容", "你好");
if (!消息) {
    消息 = "你好";
}

// ===== 3. 主流程 =====
toastLog("准备给【" + 好友 + "】发送: " + 消息);

启动微信();
打开搜索();
搜索并进入好友(好友);
发送消息(消息);

toastLog("发送完毕!");



// ====================== 下面是各个步骤的函数 ======================

// 启动微信并等待主界面
function 启动微信() {
    app.launchPackage(微信包名);
    // 等微信前台出现, 最多等 8 秒
    var ok = waitForPackage(微信包名, 8000);
    if (!ok) {
        toastLog("打开微信失败, 请确认已安装微信");
        exit();
    }
    sleep(1500);
}

// 点击主界面右上角的"搜索"按钮(放大镜)
function 打开搜索() {
    // 微信搜索按钮的描述文字是"搜索", 用 desc 定位最稳
    var 搜索按钮 = desc("搜索").findOne(5000);
    if (搜索按钮 == null) {
        // 兜底: 有的版本是 text 为"搜索"
        搜索按钮 = text("搜索").findOne(3000);
    }
    if (搜索按钮 == null) {
        toastLog("找不到搜索按钮");
        exit();
    }
    搜索按钮.click();
    sleep(1200);
}

// 在搜索框输入好友昵称并点进聊天界面
function 搜索并进入好友(好友) {
    // 搜索页里的输入框
    var 输入框 = className("android.widget.EditText").findOne(5000);
    if (输入框 == null) {
        toastLog("找不到搜索输入框");
        exit();
    }
    输入框.setText(好友);
    sleep(2000); // 等搜索结果出来

    // 在搜索结果里点击与昵称完全一致的那一项
    var 结果 = text(好友).findOne(5000);
    if (结果 == null) {
        toastLog("没搜到好友【" + 好友 + "】, 请检查昵称是否正确");
        exit();
    }
    结果.click();
    sleep(1500);
}

// 在聊天界面输入并发送消息
function 发送消息(消息) {
    // 聊天界面底部的消息输入框
    var 消息框 = className("android.widget.EditText").findOne(5000);
    if (消息框 == null) {
        toastLog("找不到聊天输入框, 可能没进入聊天界面");
        exit();
    }
    消息框.setText(消息);
    sleep(1000);

    // 输入文字后, 底部会出现"发送"按钮
    var 发送按钮 = text("发送").findOne(5000);
    if (发送按钮 == null) {
        toastLog("找不到发送按钮");
        exit();
    }
    发送按钮.click();
    sleep(800);
}

// 等待某个包名出现在前台
function waitForPackage(包名, 超时毫秒) {
    var 截止 = Date.now() + 超时毫秒;
    while (Date.now() < 截止) {
        if (currentPackage() == 包名) {
            return true;
        }
        sleep(300);
    }
    return false;
}
