# スケジュール管理メールアプリ

PC・iPhone・Android対応のレスポンシブPWA。
定期タスク管理・カレンダー・Gmail自動通知機能付き。

## 機能

- 📅 カレンダーでタスク管理（通常タスク・定期タスク）
- 🔄 定期タスク設定（毎日〜半年ごと）
- 📧 Gmail自動メール通知（毎日・毎週・毎月）
- 📱 PWA対応（ホーム画面に追加可能）
- ✅ タスク完了・履歴管理

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. アイコン生成

```bash
node generate-icons.js
```

### 3. 環境変数設定

```bash
cp .env.example .env
# .env を編集してGmail設定を入力
```

### 4. ローカル起動

```bash
npm start
```

http://localhost:3000 でブラウザアクセス

## Gmail アプリパスワード設定

1. [Googleアカウントセキュリティ設定](https://myaccount.google.com/security) で2段階認証を有効化
2. [アプリパスワード](https://myaccount.google.com/apppasswords) で「メール」用パスワードを発行
3. アプリの設定画面でGmailアドレスとアプリパスワードを入力
4. 「テスト送信」で動作確認

## Railway デプロイ

### 1. GitHubリポジトリ作成

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/schedule-mail-app.git
git push -u origin main
```

### 2. Railway設定

1. [Railway](https://railway.app) でアカウント作成・ログイン
2. 「New Project」→「Deploy from GitHub repo」でリポジトリ連携
3. 環境変数を設定（Settings → Variables）：
   - `GMAIL_USER`: Gmailアドレス
   - `GMAIL_PASS`: アプリパスワード
   - `DATA_DIR`: `/data`（Volume使用時）

### 3. Volume設定（SQLite永続化）

1. RailwayプロジェクトのSettings → Volumes
2. 「Add Volume」でマウントパス `/data` を設定
3. 環境変数 `DATA_DIR=/data` を設定

### 4. デプロイ確認

GitHubにpushすると自動デプロイ開始。
Railwayの管理画面でログ確認。

## PWA (iPhone) インストール手順

1. SafariでアプリのURLにアクセス
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」を選択
4. アプリ名を確認して「追加」

## ファイル構造

```
├── server.js          # Express サーバー
├── database.js        # SQLite操作
├── scheduler.js       # cron ジョブ
├── mailer.js          # Gmail送信
├── generate-icons.js  # PWAアイコン生成
└── public/
    ├── index.html     # カレンダートップ
    ├── completed.html # 完了済みタスク
    ├── recurring.html # 定期タスク設定
    ├── settings.html  # Gmail設定
    ├── manifest.json  # PWAマニフェスト
    ├── service-worker.js
    ├── css/style.css
    └── js/
        ├── app.js
        ├── calendar.js
        ├── tasks.js
        ├── recurring.js
        ├── settings.js
        └── notify.js
```

## 技術スタック

- **バックエンド**: Node.js + Express
- **DB**: SQLite（better-sqlite3）
- **メール**: nodemailer + Gmail
- **スケジューラー**: node-cron
- **フロントエンド**: Vanilla HTML/CSS/JS
- **デプロイ**: Railway
