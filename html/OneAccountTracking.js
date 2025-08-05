/**
 * OneAccountTracking.js - OneAccount Tracking Script
 *
 * このスクリプトは、トラッキング仕様書に基づいて実装されています。
 * oneAccountSales()関数による成果計測機能を提供します。
 *
 * @version 1.2.1 (separated)
 */
(function(window, document) {
    // 'use strict'モードを有効にし、より厳格なエラーチェックを行います。
    'use strict';

    // OneAccountの成果計測サーバーURL（実際のものに置き換えてください）
    const ONEACCOUNT_SALES_SERVER_URL = 'https://px.oneaccount.net/oneaccountfly/sales';

    /**
     * ログ出力を制御するロガーオブジェクトを取得します。
     * scriptタグに `data-oneaccountstoplog="1"` がある場合、ログ出力を停止します。
     * @returns {{info: Function, error: Function}} ログ出力用の関数を持つオブジェクト
     */
    const getLogger = () => {
        const scriptTag = document.querySelector('script[src*="oneAccountSales.js"], script[src*="SampleTrackingScript.js"], script[src*="OneAccountTracking.js"]');
        const stopLog = scriptTag && scriptTag.dataset.oneaccountstoplog === '1'; // htmlのScriptタグにdata-oneaccountstoplog="1"が定義されていたらログ出力なし
        return {
            info: (message) => !stopLog && console.info(`[oneAccountSales] ${message}`),
            error: (message) => !stopLog && console.error(`[oneAccountSales][ERROR] ${message}`),
        };
    };

    // スクリプト全体で利用するロガーインスタンスを作成します。
    const logger = getLogger();

    /**
     * 現在のホスト名からルートドメインを取得します。
     * 'co.jp'のようなセカンドレベルドメイン(SLD)を考慮し、正しくルートドメインを判定します。
     * @returns {string} ルートドメイン (例: 'example.com')
     */
    const getRootDomain = () => {
        const hostname = window.location.hostname;
        // localhostやIPアドレスの場合はそのまま返します。
        if (/^(localhost|(\d{1,3}\.){3}\d{1,3})$/.test(hostname)) {
            return hostname;
        }
        const parts = hostname.split('.');
        if (parts.length <= 2) return hostname;
        const slds = ['co', 'ne', 'or', 'go', 'ac', 'ad', 'ed', 'gr', 'com', 'net', 'org', 'gov', 'edu', 'uk', 'au', 'ca', 'de', 'fr', 'kr'];
        if (slds.includes(parts[parts.length - 2]) && parts.length > 2) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    };

    /**
     * Cookieの操作（設定、取得、削除）を行うためのユーティリティオブジェクトです。
     */
    const CookieUtil = {
        /**
         * Cookieを設定します。
         * @param {string} name - Cookie名
         * @param {string} value - Cookieの値
         * @param {number} days - 有効期限（日数）
         * @param {string} domain - 設定するドメイン
         */
        set: (name, value, days, domain) => {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            let cookieStr = `${name}=${value};${expires};path=/`;
            if (!/^(localhost|(\d{1,3}\.){3}\d{1,3})$/.test(domain)) {
                cookieStr += `;domain=${domain}`;
            }
            document.cookie = cookieStr;
        },
        /**
         * 指定された名前のCookieを取得します。
         * @param {string} name - Cookie名
         * @returns {string|null} Cookieの値。存在しない場合はnull。
         */
        get: (name) => {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i].trim();
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        },
        /**
         * 指定された名前のCookieを削除します。
         * @param {string} name - Cookie名
         * @param {string} domain - 設定されているドメイン
         */
        delete: (name, domain) => {
            let cookieStr = `${name}=; Max-Age=-99999999;path=/`;   // 有効期限を過去に設定
            if (!/^(localhost|(\d{1,3}\.){3}\d{1,3})$/.test(domain)) {
                cookieStr += `;domain=${domain}`;
            }
            document.cookie = cookieStr;    // Cookieを上書き（結果として削除される）
        }
    };


    /**
     * OneAccountの成果計測を実行するメイン関数。
     * この関数をグローバルスコープに公開することで、HTMLから直接呼び出せるようになります。
     * 例: oneAccountSales({ pid: 's000000...', items: [...] });
     *
     * @param {object} dataObject - 成果データを含むオブジェクト
     * @param {string} dataObject.pid - プログラムID (必須, 15文字)
     * @param {Array<object>} dataObject.items - 商品情報の配列 (必須)
     * @param {string} [dataObject.order_number] - 注文番号 (任意)
     * @param {string} [dataObject.currency] - 通貨コード (任意, デフォルト'JPY')
     * @param {number} [dataObject.total_price] - 注文合計金額 (任意)
     * @param {boolean} [dataObject.repeat] - リピート成果判定 (任意)
     * @param {string} [dataObject.amount_priority] - 金額の優先指定 (任意)
     * @param {string} [dataObject.coupon] - クーポンコード (任意)
     */
    window.oneAccountSales = function(dataObject) {
        // --- フェーズ1: バリデーション ---
        // 成果データを送信するためのimgタグを設置するコンテナ要素が存在するかチェック
        if (!document.getElementById('oneAccountSales')) {
            logger.error('spanタグ(#oneAccountSales)が存在しません。処理を終了します。');
            return;
        }

        // 引数オブジェクトと必須プロパティの存在と型をチェック
        const errors = [];
        if (!dataObject || typeof dataObject !== 'object') {
            errors.push('引数がオブジェクトではありません。');
        } else {
            if (typeof dataObject.pid !== 'string' || dataObject.pid.length !== 15) {
                errors.push(`pidが文字列(15byte)ではありません。`);
            }
            if (!Array.isArray(dataObject.items) || dataObject.items.length === 0) {
                errors.push('itemsが配列ではないか、空です。');
            } else {
                dataObject.items.forEach((item, index) => {
                    if (typeof item.price !== 'number') errors.push(`items[${index}].priceが数値ではありません。`);
                    if (typeof item.quantity !== 'number') errors.push(`items[${index}].quantityが数値ではありません。`);
                });
            }
        }

        // バリデーションエラーがあればログに出力して処理終了
        if (errors.length > 0) {
            errors.forEach(msg => logger.error(msg));
            return;
        }

        // --- フェーズ2: クリック識別子の取得 ---
        const pid = dataObject.pid;
        const rootDomain = getRootDomain();
        const cookieName = `_oneAccount_${pid}`;

        const params = new URLSearchParams(window.location.search);
        const oneAccountParamFromUrl = params.get('oneAccount');
        let oneAccountValue = null;

        console.log(`[CV側で受信] value: ${oneAccountParamFromUrl}, length: ${oneAccountParamFromUrl ? oneAccountParamFromUrl.length : 0}`);

        // URLにoneAccountパラメータがあれば、それを最優先で利用し、永続Cookieに保存
        if (oneAccountParamFromUrl) {
            // パラメータの値と長さを検証
            if (/^[A-Za-z0-9\-_.]+$/.test(oneAccountParamFromUrl) && oneAccountParamFromUrl.length >= 92 && oneAccountParamFromUrl.length <= 500) {
                CookieUtil.set(cookieName, oneAccountParamFromUrl, 3653, rootDomain); // 3653日(約10年)保存
                oneAccountValue = oneAccountParamFromUrl;
            } else {
                logger.error(`URLのoneAccountパラメータが仕様の範囲外または不正な文字を含みます。`);
            }
        } else {
            // URLにパラメータがなければ、Cookieから値を取得
            oneAccountValue = CookieUtil.get(cookieName);
        }

        // クリック識別子が最終的に取得できなければ処理終了
        if (!oneAccountValue) {
            logger.error('クリック識別子(oneAccountパラメータ)が取得できませんでした。処理を終了します。');
            return;
        }

        // --- フェーズ3: データの整形（デフォルト値の設定） ---
        const data = { ...dataObject }; // 元のオブジェクトを壊さないようにコピー
        // 注文番号がなければ、自動生成
        data.order_number = (typeof data.order_number === 'string' && data.order_number.length > 0) ?
            data.order_number.substring(0, 50) : `null-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        
        // 通貨コードが不正または未指定なら'JPY'に
        const validCurrencies = ['JPY', 'AUD', 'CHF'];
        data.currency = (typeof data.currency === 'string' && validCurrencies.includes(data.currency.toUpperCase())) ?
            data.currency.toUpperCase() : 'JPY';
        
        // 商品配列の各アイテムを整形
        data.items = data.items.map(item => ({
            code: (typeof item.code === 'string' && item.code.length > 0) ? item.code.substring(0, 50) : 'oneAccount', // 商品コードがなければ'oneAccount'
            price: Number(item.price) || 0,
            quantity: (Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 9999) ? item.quantity : 1, // 個数が不正なら1に
        }));

        // 合計金額が未指定なら、商品配列から自動計算
        if (typeof data.total_price !== 'number') {
            data.total_price = data.items.reduce((total, item) => total + (item.price * item.quantity), 0);
            if (data.currency === 'JPY') {
                data.total_price = Math.floor(data.total_price); // 日本円の場合は小数点以下を切り捨て
            }
        }

        // --- フェーズ4: 最終成果金額の確定 ---
        // amount_priorityが'total_price'の場合、自動計算された金額ではなく、引数で渡されたtotal_priceを優先する
        let finalAmount = data.total_price;
        if (data.amount_priority === "total_price" && typeof dataObject.total_price === 'number') {
            finalAmount = dataObject.total_price;
        }

        // --- フェーズ5: 成果通知URLの構築 ---
        const query = {
            pid: data.pid,
            oneAccount: oneAccountValue,
            o: data.order_number,
            c: data.currency,
            p: finalAmount
        };
        // 商品情報をパラメータに追加
        data.items.forEach((item, index) => {
            query[`i[${index}][sc]`] = item.code;
            query[`i[${index}][p]`] = item.price;
            query[`i[${index}][q]`] = item.quantity;
        });
        // オプショナルなパラメータを追加
        if (data.coupon) {
            query['coupon'] = String(data.coupon).substring(0, 50);
        }
        if (data.repeat === true) {
            query['repeat'] = '1';
        }
        
        // クエリオブジェクトをURLクエリ文字列に変換
        const queryString = Object.keys(query).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`).join('&');
        const trackingUrl = `${ONEACCOUNT_SALES_SERVER_URL}?${queryString}`;

        // --- フェーズ6: 成果通知の送信 ---
        // 1x1ピクセルの非表示画像を生成し、そのsrcに成果通知URLを設定することでサーバーにデータを送信します（イメージビーコン方式）。
        const container = document.getElementById('oneAccountSales');
        let img = container.querySelector('img');
        if (!img) { // 既にimg要素があれば再利用
            img = document.createElement('img');
            img.width = 1;
            img.height = 1;
            img.alt = "";
            img.style.display = "none";
            container.appendChild(img);
        }

        // 動作確認のためにコメントアウト
        // 成果通知URLをimgのsrcに設定して送信
        // img.src = trackingUrl;
        // logger.info(`成果通知を送信しました。URL=${trackingUrl}`);

        // ▼▼▼ ここから動作確認ようの成果通知処理を追記 ▼▼▼

        // 2. ASPへの成果通知（ポストバック）
        const aspPostbackContainer = document.body; // ASP用タグはbodyの末尾に追加
        const aspImg = document.createElement('img');
        // 実際にはASPのポストバックURLを指定する（ASPサーバのAPIの受け口を指定する）
        const aspPostbackUrl = new URL('http://asp-site.local:8080/asp-conversion-pixel.gif');

        // ASPに渡したい情報をパラメータとして付与
        aspPostbackUrl.searchParams.append('click_id', oneAccountValue); // ASPが発行したクリックID
        aspPostbackUrl.searchParams.append('order_total', finalAmount); // 成果金額
        aspPostbackUrl.searchParams.append('order_number', data.order_number); // 注文番号

        aspImg.width = 1;
        aspImg.height = 1;
        aspImg.alt = "";
        aspImg.style.display = "none";
        aspImg.src = aspPostbackUrl.toString();
        
        aspPostbackContainer.appendChild(aspImg);

        logger.info(`ASPへの成果通知を送信しました。URL=${aspImg.src}`);

        // ▲▲▲ ここまで追記 ▲▲▲

        // --- フェーズ7: Cookieの削除 ---
        // リピート成果でない場合、一度利用したクリック識別子のCookieを削除します。
        if (data.repeat !== true) {
            CookieUtil.delete(cookieName, rootDomain);
            logger.info(`クリック識別子のCookieを削除しました: ${cookieName}`);
        }
        // 役割を終えた中継用のCookieも削除する
        CookieUtil.delete('ONEACCOUNT_DELIVERY', rootDomain);
        logger.info(`中継用Cookieを削除しました: ONEACCOUNT_DELIVERY`);
    };

})(window, document);