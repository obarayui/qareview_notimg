/**
 * AWS設定ファイル（テンプレート）
 *
 * このファイルをコピーして `aws-config.js` という名前で保存してください。
 * 実際の値を設定してからお使いください。
 *
 * コピーコマンド:
 *   cp js/aws-config.example.js js/aws-config.js
 */

const AWS_CONFIG = {
    // AWSリージョン（例: ap-northeast-1 = 東京リージョン）
    region: 'ap-northeast-1',

    // Cognito Identity Pool ID
    // AWS Console → Cognito → IDプールの管理 → IDプールの編集 で確認できます
    // 形式: ap-northeast-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    identityPoolId: 'YOUR_IDENTITY_POOL_ID',

    // S3バケット名
    // 結果を保存するS3バケットの名前
    bucketName: 'YOUR_BUCKET_NAME',

    // S3アップロード機能を有効化するか（true/false）
    // falseの場合はlocalStorageのみに保存されます
    enableS3Upload: true
};

// グローバルスコープに公開
window.AWS_CONFIG = AWS_CONFIG;
