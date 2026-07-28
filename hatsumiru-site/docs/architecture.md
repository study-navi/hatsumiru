# ハツミル - Architecture

## リポジトリ構成

```
/
├── index.html        トップページ（サービス紹介）
├── styles.css
├── script.js
├── mvp/
│   └── index.html    MVPプロトタイプ（体験用）
├── docs/
│   ├── vision.md
│   ├── roadmap.md
│   └── architecture.md
└── supabase/
    └── schema.sql     DBスキーマ
```

## 公開先

- リポジトリ: `study-navi/hatsumiru`
- 公開URL: `https://study-navi.github.io/hatsumiru/`
- GitHub Pages設定: Deploy from branch（`main` / `/root`）

## 技術スタック（想定）

- フロントエンド: React + Supabase（他プロジェクトと共通方針）
- 現MVPは単一HTMLファイルのプロトタイプ（ダミーデータで動作）
- DB: Supabase（PostgreSQL、RLS有効）

## データモデル（現時点）

- `creators` … 活動者（ジャンル、活動フェーズ、レーダー評価をjsonbで保持）
- `milestones` … はじめて記録（活動者に紐づく）
- `reactions` … milestoneへの絵文字リアクション（CPの元データ）

MVP段階では読み書きとも公開ポリシー（誰でも可）。
本人確認・認証を実装する段階でinsert/updateポリシーを絞る予定。

## 今後の技術的論点

- 認証方式（活動者側の本人確認、視聴者側はsessionIDのみで参加可能にする方針）
- CPの算出ロジックと不正対策
- レーダーチャート軸のジャンル別可変設計（`GENRE_AXES`）をSupabase側にどう持たせるか
