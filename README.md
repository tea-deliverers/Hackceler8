# Hackceler8 Game Tools

## 操作
推荐使用方向键控制。

- 滚轮缩放
- <kbd>Shift</kbd> 移动地图
- <kbd>V</kbd> 重设中心点为玩家
- <kbd>B</kbd> 显示 `Entity`
- <kbd>H</kbd> 开启模拟模式

  在模拟模式下：
  - 不动不记录 `Tick`
  - 用鼠标指向目的地，按 <kbd>`</kbd> 瞬移过去（搜索，有可能不成功）
  - <kbd>Z</kbd> 倒退
  - <kbd>X</kbd> 前进
  - <kbd>,</kbd> 减速
  - <kbd>.</kbd> 加速
  - <kbd>LeftCtrl</kbd> 暂时加速
  - <kbd>T</kbd> 提交

  再次按 <kbd>H</kbd> 重新与服务端同步

## 显示
蓝黄色方框：碰撞盒

白色线：连接 `Terminal` 和 `FlagConsole`

紫红色线：`Portal` 指向其目的地

绿色线：连接玩家和 `Key`

橙色线：连接 `KeyReceptacle` 和其控制的 `Entity`

红色实心方框：死亡区域

## 浏览器控制台

- `closeFloat()` 关闭所有浮动窗口

## `Terminal` 转发

转发到 `localServer` 下。数据均以 hex 编码，换行结尾。