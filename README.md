# 適性検査 練習（cabgab）

CAB 形式の適性検査（四則逆算・法則性・命令表・暗号）を練習するアプリです。問題はプログラムが毎回自動で作るオリジナルの練習問題で、実際の試験の問題ではありません。

- 生徒用：`index.html`（練習 10 問・解説つき／模試＝本番に近い問題数と時間）
- 先生用：`teacher/`（クラスを作る・生徒ごとの正答率・平均時間・模試の記録・CSV）

## 公開のしかた
1. GitHub の Settings → Pages で、Branch を `main`、フォルダを `/ (root)` にして保存
2. Supabase（SQL Practice と同じプロジェクト）の SQL Editor で `supabase/schema.sql` を実行
3. 先生は SQL Practice と同じアカウントでログイン（先生の一覧 `teachers` も共通）

## 開発
- 依存なしの ES Modules。ローカルでは `python3 -m http.server` などで開きます
- 問題のチェック：`node tools/check.mjs`（各科目 400 問を作り、選択肢が 5 つで正解が 1 つだけかを確かめます）
- `config.js` には公開してよい publishable key だけを書きます（secret key は書かない）
