/**
 * メインアプリケーションロジック
 * 問題表示、回答管理、レビューフロー制御
 */

const QuizApp = {
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    correctAnswerIndex: null, // シャッフル後の正解のインデックス
    reviewerName: '',
    category: '',
    quizPath: '',
    currentReviewId: null, // 現在の回答のレビューID

    /**
     * アプリケーション初期化
     */
    async init() {
        // localStorageから情報を取得
        this.reviewerName = localStorage.getItem('current_reviewer');
        this.category = localStorage.getItem('current_category');
        this.quizPath = localStorage.getItem('current_quiz_path');

        // 必須情報がない場合はホームにリダイレクト
        if (!this.reviewerName || !this.category || !this.quizPath) {
            alert('レビューアー情報が見つかりません。ホーム画面から開始してください。');
            window.location.href = 'index.html';
            return;
        }

        // UIの初期化
        this.setupUI();

        // 問題データの読み込み
        await this.loadQuestions();
    },

    /**
     * UIの初期化
     */
    setupUI() {
        // ヘッダー情報の設定
        document.getElementById('quiz-set-name').textContent = this.category;
        document.getElementById('reviewer-name').textContent = this.reviewerName;

        // イベントリスナーの設定
        document.getElementById('submit-btn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('complete-btn').addEventListener('click', () => this.completeReview());

        // ホームに戻るボタン
        document.getElementById('back-home-btn').addEventListener('click', () => this.goHome());
        document.getElementById('error-home-btn').addEventListener('click', () => this.goHome(false));

        // 再試行ボタン
        document.getElementById('retry-btn').addEventListener('click', () => this.loadQuestions());
    },

    /**
     * 問題データの読み込み
     */
    async loadQuestions() {
        this.showLoading();

        try {
            const data = await GitHubLoader.fetch(this.quizPath);

            // データが配列かどうか確認
            if (!Array.isArray(data)) {
                throw new Error('問題データの形式が不正です（配列である必要があります）');
            }

            // データの検証
            if (data.length === 0) {
                throw new Error('問題データが空です');
            }

            // カテゴリでフィルタリング
            const filteredQuestions = data.filter(q => q.category === this.category);

            if (filteredQuestions.length === 0) {
                throw new Error(`カテゴリ「${this.category}」の問題が見つかりませんでした`);
            }

            // 問題をシャッフル
            this.questions = this.shuffleArray(filteredQuestions);
            this.currentIndex = 0;

            // 問題数の表示
            document.getElementById('total-questions').textContent = this.questions.length;

            // 最初の問題を表示
            this.showQuestion();
            this.hideLoading();

        } catch (error) {
            console.error('問題読み込みエラー:', error);
            this.showError(error.message);
        }
    },

    /**
     * 問題を表示
     */
    showQuestion() {
        const question = this.questions[this.currentIndex];

        // 問題情報の表示
        document.getElementById('question-id').textContent = question.questionID;
        document.getElementById('question-text').textContent = question.question;
        document.getElementById('question-category').textContent = question.category;

        // キーワードの表示（あれば）
        const keywordEl = document.getElementById('question-keyword');
        if (question.keyword) {
            keywordEl.textContent = question.keyword;
            keywordEl.style.display = 'inline-block';
        } else {
            keywordEl.style.display = 'none';
        }

        // 年代の表示（あれば）
        const yearEl = document.getElementById('question-year');
        if (question.year) {
            yearEl.textContent = question.year;
            yearEl.style.display = 'inline-block';
        } else {
            yearEl.style.display = 'none';
        }

        // 参考URLの表示（あれば）
        const referenceEl = document.getElementById('question-reference');
        if (question.reference_url) {
            document.getElementById('reference-link').href = question.reference_url;
            referenceEl.style.display = 'block';
        } else {
            referenceEl.style.display = 'none';
        }

        // 進捗の更新
        document.getElementById('current-question').textContent = this.currentIndex + 1;
        const progress = ((this.currentIndex + 1) / this.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // 状態のリセット
        this.selectedAnswer = null;
        this.currentReviewId = null;
        document.getElementById('comment-input').value = '';
        document.getElementById('comment-section').style.display = 'none'; // コメント欄を非表示
        document.getElementById('result-section').style.display = 'none';
        document.getElementById('submit-btn').disabled = true;
        document.getElementById('submit-btn').style.display = 'block';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('complete-btn').style.display = 'none';

        // 選択肢の生成（シャッフルされ、correctAnswerIndexが設定される）
        this.renderChoices(question.choice);

        // トップにスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 選択肢を描画
     * @param {Array} choices - 選択肢の配列（正解は常にインデックス0）
     */
    renderChoices(choices) {
        const container = document.getElementById('choices-container');
        container.innerHTML = '';

        // 選択肢を元のインデックスと共に配列化
        const choicesWithIndex = choices.map((choice, index) => ({
            text: choice,
            originalIndex: index
        }));

        // 選択肢をシャッフル
        const shuffledChoices = this.shuffleArray(choicesWithIndex);

        // 正解の新しい位置を見つける（元のインデックス0が正解）
        this.correctAnswerIndex = shuffledChoices.findIndex(c => c.originalIndex === 0);

        // シャッフルされた選択肢を表示
        shuffledChoices.forEach((choiceObj, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = choiceObj.text;
            button.dataset.index = index;

            button.addEventListener('click', () => this.selectAnswer(index));

            container.appendChild(button);
        });
    },

    /**
     * 回答を選択
     * @param {number} index - 選択肢のインデックス
     */
    selectAnswer(index) {
        // 既に提出済みの場合は選択できない
        if (this.selectedAnswer !== null && document.getElementById('result-section').style.display !== 'none') {
            return;
        }

        this.selectedAnswer = index;

        // すべての選択肢からselectedクラスを削除
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // 選択した選択肢にselectedクラスを追加
        document.querySelector(`.choice-btn[data-index="${index}"]`).classList.add('selected');

        // 提出ボタンを有効化
        document.getElementById('submit-btn').disabled = false;
    },

    /**
     * 回答を提出
     */
    submitAnswer() {
        if (this.selectedAnswer === null || this.correctAnswerIndex === null) {
            return;
        }

        const question = this.questions[this.currentIndex];
        const isCorrect = this.selectedAnswer === this.correctAnswerIndex;

        // 画面に表示されている選択肢のテキストを取得
        const choiceButtons = document.querySelectorAll('.choice-btn');
        const selectedText = choiceButtons[this.selectedAnswer].textContent;
        const correctText = choiceButtons[this.correctAnswerIndex].textContent;

        // 結果を保存（コメントは空で保存）
        this.currentReviewId = StorageManager.saveResult({
            questionId: question.questionID,
            questionSet: this.category,
            questionIndex: this.currentIndex,
            keyword: question.keyword,
            category: question.category,
            questionText: question.question,
            reviewerName: this.reviewerName,
            answer: this.selectedAnswer,
            correctAnswer: this.correctAnswerIndex,
            isCorrect: isCorrect,
            comment: '' // コメントは後で入力
        });

        // 結果表示
        this.showResult(isCorrect, selectedText, correctText);

        // 選択肢に色をつける
        this.highlightChoices(this.correctAnswerIndex);

        // ボタンの切り替え
        document.getElementById('submit-btn').style.display = 'none';

        if (this.currentIndex < this.questions.length - 1) {
            document.getElementById('next-btn').style.display = 'block';
        } else {
            document.getElementById('complete-btn').style.display = 'block';
        }

        // 選択肢を無効化
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.disabled = true;
        });

        // コメント欄を表示して入力可能にする
        document.getElementById('comment-section').style.display = 'block';
        document.getElementById('comment-input').disabled = false;
        document.getElementById('comment-input').focus();
    },

    /**
     * 結果を表示
     * @param {boolean} isCorrect - 正解かどうか
     * @param {string} yourAnswer - 選択した回答
     * @param {string} correctAnswer - 正解
     */
    showResult(isCorrect, yourAnswer, correctAnswer) {
        const resultSection = document.getElementById('result-section');
        const resultHeader = document.getElementById('result-header');
        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');

        // 正誤に応じた表示
        if (isCorrect) {
            resultHeader.className = 'result-header correct';
            resultIcon.textContent = '✓';
            resultTitle.textContent = '正解！';
        } else {
            resultHeader.className = 'result-header incorrect';
            resultIcon.textContent = '✗';
            resultTitle.textContent = '不正解';
        }

        // 回答の表示
        document.getElementById('your-answer').textContent = yourAnswer;
        document.getElementById('correct-answer').textContent = correctAnswer;

        resultSection.style.display = 'block';

        // 結果セクションにスムーススクロール
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    },

    /**
     * 選択肢をハイライト
     * @param {number} correctIndex - 正解のインデックス
     */
    highlightChoices(correctIndex) {
        document.querySelectorAll('.choice-btn').forEach((btn, index) => {
            if (index === correctIndex) {
                btn.classList.add('correct');
            } else if (index === this.selectedAnswer) {
                btn.classList.add('incorrect');
            }
        });
    },

    /**
     * 次の問題へ
     */
    nextQuestion() {
        // コメントを保存
        if (this.currentReviewId) {
            const comment = document.getElementById('comment-input').value.trim();
            StorageManager.updateComment(this.currentReviewId, comment);
        }

        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.showQuestion();
        }
    },

    /**
     * レビュー完了
     */
    completeReview() {
        // コメントを保存
        if (this.currentReviewId) {
            const comment = document.getElementById('comment-input').value.trim();
            StorageManager.updateComment(this.currentReviewId, comment);
        }

        const stats = StorageManager.getStatistics();
        const reviewerStats = stats.byReviewer[this.reviewerName];

        const message = `
レビューが完了しました！

📊 あなたの成績:
正解数: ${reviewerStats.correct} / ${reviewerStats.total}
正解率: ${reviewerStats.accuracy}%

お疲れさまでした！
        `.trim();

        alert(message);

        // ホームに戻る
        window.location.href = 'index.html';
    },

    /**
     * ホームに戻る
     * @param {boolean} confirm - 確認ダイアログを表示するか
     */
    goHome(confirm = true) {
        if (confirm) {
            const userConfirm = window.confirm('ホームに戻りますか？レビューの進捗は保存されていますが、途中から再開することはできません。');
            if (!userConfirm) {
                return;
            }
        }

        window.location.href = 'index.html';
    },

    /**
     * 配列をシャッフル（Fisher-Yatesアルゴリズム）
     * @param {Array} array - シャッフルする配列
     * @returns {Array} シャッフルされた配列
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * ローディング表示
     */
    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error-container').style.display = 'none';
        document.getElementById('question-container').style.display = 'none';
    },

    /**
     * ローディング非表示
     */
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('question-container').style.display = 'block';
    },

    /**
     * エラー表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('question-container').style.display = 'none';
        document.getElementById('error-container').style.display = 'block';
        document.getElementById('error-message').textContent = message;
    }
};

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    QuizApp.init();
});
