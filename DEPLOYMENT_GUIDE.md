# デプロイメントガイド

このガイドでは、SakuraQA foodレビューアプリケーションをGitHub Pagesにデプロイし、レビュー結果をAWS S3に保存する環境を構築する手順を説明します。

## 目次

1. [GitHub Pagesへのデプロイ](#1-github-pagesへのデプロイ)
2. [AWS S3の設定](#2-aws-s3の設定)
3. [AWS Cognitoの設定](#3-aws-cognitoの設定)
4. [アプリケーションの設定](#4-アプリケーションの設定)
5. [動作確認](#5-動作確認)

---

## 1. GitHub Pagesへのデプロイ

### 1.1 リポジトリの準備

リポジトリがGitHubにプッシュされていることを確認してください。

```bash
git status
git add .
git commit -m "Prepare for GitHub Pages deployment"
git push origin main
```

### 1.2 GitHub Pagesの有効化

1. GitHubリポジトリページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーから **Pages** を選択
4. **Source** セクションで以下を選択：
   - Branch: `main`
   - Folder: `/ (root)`
5. **Save** をクリック

数分後、以下のようなURLでアプリケーションにアクセスできます：
```
https://<username>.github.io/<repository-name>/
```

### 1.3 ベースURLの設定（必要に応じて）

リポジトリ名がパスに含まれる場合、`index.html`と`review.html`内のパスを調整する必要があります。

例：`https://username.github.io/qareview_notimg/`の場合

**修正が必要な箇所**：
- CSS/JSファイルのパス
- 問題ファイルのパス（`QUESTIONS_PATH`）

---

## 2. AWS S3の設定

レビュー結果をS3に保存するための設定を行います。

### 2.1 S3バケットの作成

1. AWS Management Consoleにログイン
2. **S3** サービスに移動
3. **バケットを作成** をクリック

**バケット設定**：
- **バケット名**: `sakuraqa-food-review-results`（任意のユニークな名前）
- **リージョン**: `ap-northeast-1`（東京リージョン推奨）
- **パブリックアクセスをブロック**: すべてチェック（セキュリティのため）

4. **バケットを作成** をクリック

### 2.2 CORS設定

S3バケットにブラウザからアクセスできるようにCORSを設定します。

1. 作成したバケットを選択
2. **アクセス許可** タブをクリック
3. **クロスオリジンリソース共有 (CORS)** セクションまでスクロール
4. **編集** をクリックして以下のJSON設定を追加：

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST"
        ],
        "AllowedOrigins": [
            "https://<username>.github.io",
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**注意**: `<username>.github.io`を実際のGitHub PagesのURLに置き換えてください。

5. **変更を保存** をクリック

### 2.3 バケットポリシーの設定（オプション）

Cognito認証されたユーザーのみがアクセスできるように設定します（次のセクションで設定）。

---

## 3. AWS Cognitoの設定

匿名ユーザーがS3に結果をアップロードできるよう、Cognito Identity Poolを設定します。

### 3.1 Identity Poolの作成

1. AWS Management Consoleで **Amazon Cognito** サービスに移動
2. **IDプールの管理** をクリック
3. **新しいIDプールの作成** をクリック

**IDプール設定**：
- **IDプール名**: `SakuraQA_Food_Review_Pool`
- **認証されていないIDに対してアクセスを有効にする**: ✅ チェック

4. **プールの作成** をクリック

### 3.2 IAMロールの設定

Cognitoが自動的に2つのIAMロールを作成します。**認証されていないロール**を編集します。

1. 作成された **Cognito_SakuraQA_Food_Review_PoolUnauth_Role** をクリック
2. IAMコンソールに移動
3. **許可を追加** → **ポリシーをアタッチ** をクリック
4. **ポリシーの作成** をクリック

以下のJSON形式のポリシーを作成：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::sakuraqa-food-review-results/*"
        }
    ]
}
```

**ポリシー名**: `SakuraQA_S3_Upload_Policy`

5. ポリシーを作成して、先ほどのロールにアタッチ

### 3.3 必要な情報を控える

以下の情報をメモしてください（次のステップで使用）：

- **Identity Pool ID**: `ap-northeast-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **リージョン**: `ap-northeast-1`
- **S3バケット名**: `sakuraqa-food-review-results`

---

## 4. アプリケーションの設定

### 4.1 AWS SDK for JavaScriptの追加

`review.html`に以下のスクリプトタグを追加（`</body>`の直前）：

```html
<!-- AWS SDK -->
<script src="https://sdk.amazonaws.com/js/aws-sdk-2.1000.0.min.js"></script>
```

### 4.2 AWS設定ファイルの作成

プロジェクトルートに`js/aws-config.js`ファイルを作成し、以下の内容を記述：

```javascript
const AWS_CONFIG = {
    region: 'ap-northeast-1',
    identityPoolId: 'ap-northeast-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // 実際のIDに置き換え
    bucketName: 'sakuraqa-food-review-results' // 実際のバケット名に置き換え
};
```

**重要**: `identityPoolId`は実際のCognito Identity Pool IDに置き換えてください。

### 4.3 .gitignoreの設定（セキュリティ）

実際の環境では、AWS設定を`.gitignore`に追加してGitにコミットしないようにします：

```bash
echo "js/aws-config.js" >> .gitignore
```

代わりに、`js/aws-config.example.js`をテンプレートとして作成し、README等で設定方法を説明します。

### 4.4 S3アップロード機能の有効化

`review.html`で`js/aws-config.js`を読み込みます（`js/storage.js`の前に）：

```html
<script src="js/aws-config.js"></script>
<script src="js/github.js"></script>
<script src="js/storage.js"></script>
<script src="js/app.js"></script>
```

---

## 5. 動作確認

### 5.1 ローカルでのテスト

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

http://127.0.0.1:8000 にアクセスして、以下を確認：

1. レビューアー名を入力
2. カテゴリを選択
3. 問題に回答
4. ブラウザの開発者ツールのコンソールで「S3にアップロード成功」メッセージを確認

### 5.2 S3バケットの確認

AWS Management Console → S3 → バケット内に以下のようなファイルが保存されているか確認：

```
results/
  ├── 田中太郎_食_20251031_123456.json
  └── 山田花子_日本の食文化(現代)_20251031_140000.json
```

### 5.3 GitHub Pagesでの確認

GitHub Pagesのデプロイが完了したら、URLにアクセスして同様に動作を確認します。

---

## トラブルシューティング

### CORSエラーが発生する場合

**症状**: コンソールに「Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy」

**解決策**:
1. S3バケットのCORS設定を確認
2. `AllowedOrigins`に正しいGitHub PagesのURLが含まれているか確認
3. ブラウザのキャッシュをクリアして再試行

### 認証エラーが発生する場合

**症状**: 「The security token included in the request is invalid」

**解決策**:
1. Cognito Identity Pool IDが正しいか確認
2. IAMロールの権限設定を確認
3. S3バケット名が正しいか確認

### ファイルがアップロードされない

**解決策**:
1. ブラウザの開発者ツールのコンソールでエラーメッセージを確認
2. IAMロールに`s3:PutObject`権限があるか確認
3. バケット名とリージョンが正しいか確認

---

## セキュリティに関する注意事項

### 1. 認証情報の管理

- `aws-config.js`には機密情報（認証情報）を含めないでください
- Cognito Identity Poolを使用して、一時的な認証情報を取得してください
- 本番環境では環境変数や別の設定管理サービスを検討してください

### 2. S3アクセス制限

- S3バケットは必ずプライベートに設定してください
- IAMポリシーは最小権限の原則に従ってください（PutObjectのみ）
- 必要に応じてバケットポリシーで追加の制限を設定してください

### 3. データ保護

- S3に保存されるデータには個人情報が含まれる可能性があります
- 適切なデータ保護方針に従ってください
- 必要に応じてS3サーバー側暗号化（SSE）を有効にしてください

---

## 費用について

### GitHub Pages
- 無料（パブリックリポジトリの場合）
- 帯域制限: 月100GB
- ビルド時間制限: 月10時間

### AWS S3
- 最初の5GB: 無料（12ヶ月間）
- ストレージ: ~$0.025/GB/月
- リクエスト: PUT/POST ~$0.005/1,000リクエスト

### AWS Cognito
- 月間アクティブユーザー50,000人まで無料

---

## 次のステップ

- [ ] 定期的なS3バケットのバックアップ設定
- [ ] CloudFrontを使用したコンテンツ配信の高速化
- [ ] データ分析のためのAmazon Athenaの設定
- [ ] CI/CDパイプラインの構築（GitHub Actions）

---

## 参考リンク

- [GitHub Pages Documentation](https://docs.github.com/ja/pages)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS Cognito Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
