# 每日打卡

一个清爽简约的每日习惯打卡网页：添加想坚持的习惯（喝水、运动、看书……），每天完成一项就点一下打勾，顶部显示「今天完成 X / Y」和进度条，完成的项目会整行变灰。

- 手机、电脑都能打开，界面适配小屏幕
- 打勾数据按日期自动分开，新的一天自动清零
- 数据保存在**每台设备的浏览器本地**（localStorage），无需注册、无需服务器、完全免费
- 纯 HTML/CSS/JavaScript，可直接发布到 GitHub Pages

> 注意：不做云同步，手机和电脑打开同一个网址时，各自记录各自的打卡数据。

## 文件说明

- `index.html` / `styles.css` / `app.js`：页面本体（双击 index.html 即可本地使用）
- `README.md`：本说明

## 发布到 GitHub Pages（免费）

### 方法一：GitHub 网页直接上传（不用命令行）

1. 打开 <https://github.com/new>，登录你的 GitHub 账号。
2. Repository name 填 `habit-checkin`，选择 **Public**，其他保持默认，点 **Create repository**。
3. 在新仓库页面点 **uploading an existing file**（上传已有文件）。
4. 把本目录里的 `index.html`、`styles.css`、`app.js` 三个文件拖进上传区，点 **Commit changes**。
5. 进入仓库 **Settings → Pages**，Source 选择 **Deploy from a branch**，Branch 选 `main`、目录选 `/ (root)`，点 **Save**。
6. 等 1–2 分钟，打开 `https://你的用户名.github.io/habit-checkin/` 即可。

### 方法二：命令行推送

```bash
git init
git add .
git commit -m "每日打卡 v1"
git branch -M main
git remote add origin https://github.com/你的用户名/habit-checkin.git
git push -u origin main
```

然后按上面的第 5、6 步在仓库设置里开启 GitHub Pages。

## 日常使用

- 顶部输入框输入习惯名称后点「添加」，例如“喝水”“运动”“看书”。
- 点一下习惯所在整行即打勾：该行变灰，进度条和「今天完成 X / Y」同步更新；再点一次取消。
- 右上角「管理」可切换出删除按钮；删除会连同历史记录一起移除。
- 每天 0 点后重新打开（或页面回到前台）会自动切换到新的一天，打卡从零开始。
- 在手机浏览器打开网址后，可以把页面“添加到主屏幕”，像 App 一样每天点开。

## 注意事项

- 数据只存在当前设备、当前浏览器的本地存储里。换设备、换浏览器、清除浏览器数据或使用无痕模式，都会看不到之前的记录。
- 所有习惯默认都是「每天打卡一次」，暂不支持按周几/频率设置。
- 日期按设备本地时区计算，建议保持在一个时区使用。
