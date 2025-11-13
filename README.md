# Google Drive Music Player

Google Driveにある曲を検索、閲覧、ストリーミング再生できるWebアプリケーションです。

## 機能

- 🔐 Google Drive API認証
- 🔍 音楽ファイルの検索機能
- 📋 音楽ファイル一覧の表示
- 🎵 ストリーミング再生機能
- 📱 レスポンシブデザイン

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「ライブラリ」から「Google Drive API」を有効化
4. 「認証情報」→「認証情報を作成」→「OAuth 2.0 クライアント ID」を選択
5. アプリケーションの種類を「ウェブアプリケーション」に設定
6. 承認済みのリダイレクト URIに以下を追加：
   - `http://localhost:3000/api/drive/auth/callback`（開発環境）
   - 本番環境のURL（本番環境の場合）

### 3. 環境変数の設定

`.env.example`を`.env.local`にコピーし、取得した認証情報を設定：

```bash
cp .env.example .env.local
```

`.env.local`を編集：

```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/drive/auth/callback
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 使用方法

1. 「Googleでログイン」ボタンをクリックして認証
2. 認証後、Google Drive内の音楽ファイルが自動的に表示されます
3. 検索バーで曲名やアーティスト名を検索
4. ファイル一覧から再生したい曲をクリック
5. 音楽プレーヤーで再生・一時停止・シークが可能

## 対応ファイル形式

- MP3 (.mp3)
- M4A (.m4a)
- WAV (.wav)
- OGG (.ogg)
- FLAC (.flac)
- AAC (.aac)
- WMA (.wma)

## 技術スタック

- **Next.js 14** - Reactフレームワーク
- **TypeScript** - 型安全性
- **Google Drive API** - ファイルアクセス
- **CSS Modules** - スタイリング

## 注意事項

- このアプリケーションは読み取り専用で、Google Driveのファイルを変更することはありません
- 認証トークンはCookieに保存されます（本番環境では、より安全な方法を推奨）
- 大きなファイルのストリーミングには時間がかかる場合があります

## ライセンス

MIT

