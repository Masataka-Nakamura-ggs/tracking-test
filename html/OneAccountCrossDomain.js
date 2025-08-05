/**
 * OneAccountCrossDomain.js - OneAccount Cross-Domain Tracking Support Script
 *
 * このスクリプトは、ドメインをまたいでトラッキングパラメータを引き継ぐための機能を提供します。
 * ページロード時に自動的に実行されます。
 *
 * @version 1.2.1 (separated)
 */
(function(window, document) {
    // 'use strict'モードを有効にし、より厳格なエラーチェックを行います。
    'use strict';

    /**
     * ログ出力を制御するロガーオブジェクトを取得します。
     * scriptタグに `data-oneaccountstoplog="1"` がある場合、ログ出力を停止します。
     * @returns {{info: Function, error: Function}} ログ出力用の関数を持つオブジェクト
     */
    const getLogger = () => {
        const scriptTag = document.querySelector('script[src*="oneAccountSales.js"], script[src*="SampleTrackingScript.js"], script[src*="OneAccountCrossDomain.js"]');
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
            let cookieStr = `${name}=; Max-Age=-99999999;path=/`;
            if (!/^(localhost|(\d{1,3}\.){3}\d{1,3})$/.test(domain)) {
                cookieStr += `;domain=${domain}`;
            }
            document.cookie = cookieStr;
        }
    };


    // --- ここからクロスドメイン機能 ---

    /**
     * クロスドメイン間でパラメータを引き渡すための機能を提供するオブジェクトです。
     * ページロード時に自動的に実行されます。
     */
    const CROSS_DOMAIN = {
        // クロスドメイン連携用の一時Cookieのキー名
        COOKIE_KEY: 'ONEACCOUNT_DELIVERY',
        // URLから取得するパラメータ名
        PARAM_KEY: 'oneAccount',
        // 処理対象を限定するためのCSSクラス名
        TARGET_CLASS: 'oneAccountCrossDomain',
        // 処理対象のHTMLタグ
        TARGET_TAGS: ['a', 'form'],

        /**
         * <a>タグのリンク(href)にoneAccountパラメータを付与します。
         * @param {HTMLAnchorElement} anchor - 処理対象のaタグ
         * @param {string} oneAccountValue - 付与するoneAccountパラメータの値
         */
        updateAnchorHref: (anchor, oneAccountValue) => {
            const href = anchor.href;
            // hrefがない、または同一ドメインのリンクは対象外
            if (!href || anchor.hostname === window.location.hostname) return;
            // 既にoneAccountパラメータが付与されている場合は何もしない
            if (href.includes(`${CROSS_DOMAIN.PARAM_KEY}=`)) return;

            let newHref = href;
            const hashIndex = href.indexOf('#');
            let hash = '';
            // URLにハッシュ(#)がある場合、分離して後で結合する
            if (hashIndex !== -1) {
                hash = href.substring(hashIndex);
                newHref = href.substring(0, hashIndex);
            }

            // URLに ? があるかどうかに応じて、& または ? を使ってパラメータを結合
            newHref += (newHref.includes('?') ? '&' : '?') + `${CROSS_DOMAIN.PARAM_KEY}=${oneAccountValue}`;
            anchor.href = newHref + hash;
            logger.info(`クロスドメインリンクを更新: ${anchor.href}`);
        },

        /**
         * <form>タグにoneAccountパラメータを送信するためのhidden要素を追加します。
         * @param {HTMLFormElement} form - 処理対象のformタグ
         * @param {string} oneAccountValue - 設定するoneAccountパラメータの値
         */
        addHiddenInputToForm: (form, oneAccountValue) => {
            // 既にoneAccountパラメータのinput要素がある場合は何もしない
            if (form.querySelector(`input[name="${CROSS_DOMAIN.PARAM_KEY}"]`)) return;
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = CROSS_DOMAIN.PARAM_KEY;
            input.value = oneAccountValue;
            form.appendChild(input);
            logger.info(`フォームにoneAccountパラメータを追加: ${form.action || 'current page'}`);
        },

        /**
         * クロスドメイン処理を初期化し、実行します。
         * 1. URLからパラメータを取得
         * 2. あれば一時Cookieに保存
         * 3. 一時Cookieがあれば、それを使ってページ内のリンクとフォームを書き換え
         */
        init: () => {
            const params = new URLSearchParams(window.location.search);
            const oneAccountParamFromUrl = params.get(CROSS_DOMAIN.PARAM_KEY);
            const rootDomain = getRootDomain();

            // 1. URLにoneAccountパラメータがあれば、クロスドメイン連携用の一時Cookieに保存
            if (oneAccountParamFromUrl) {
                // 不正な値でないか簡易チェック
                if (/^[A-Za-z0-9\-_.]+$/.test(oneAccountParamFromUrl)) {
                    // 有効期限1日でCookieを設定
                    CookieUtil.set(CROSS_DOMAIN.COOKIE_KEY, oneAccountParamFromUrl, 1, rootDomain);
                    logger.info(`クロスドメイン用Cookieを保存: ${CROSS_DOMAIN.COOKIE_KEY}`);
                }
            }

            // 2. 一時Cookieが存在する場合のみ、リンクとフォームの書き換え処理を実行
            const oneAccountValueFromCookie = CookieUtil.get(CROSS_DOMAIN.COOKIE_KEY);
            if (!oneAccountValueFromCookie) return; // Cookieがなければここで処理終了

            // 3. 書き換え対象の要素を決定
            // oneAccountCrossDomainクラスが指定された要素があればそれを優先、なければページ内の全対象タグを取得
            let targetElements = Array.from(document.querySelectorAll(`.${CROSS_DOMAIN.TARGET_CLASS}`));
            if (targetElements.length === 0) {
                targetElements = Array.from(document.querySelectorAll(CROSS_DOMAIN.TARGET_TAGS.join(',')));
            }

            // 4. 対象要素をループして、タグに応じた書き換え処理を実行
            targetElements.forEach(el => {
                const tagName = el.tagName.toLowerCase();
                if (tagName === 'a') {
                    CROSS_DOMAIN.updateAnchorHref(el, oneAccountValueFromCookie);
                } else if (tagName === 'form') {
                    CROSS_DOMAIN.addHiddenInputToForm(el, oneAccountValueFromCookie);
                }
            });
        }
    };

    // ページの全リソース（画像など）が読み込み完了した時点で、クロスドメイン処理を実行します。
    window.addEventListener('load', CROSS_DOMAIN.init);

})(window, document);