(function() {
    'use strict';

    // デバッグ情報を表示するボックスのスタイルを設定
    const style = document.createElement('style');
    style.textContent = `
        #debug-info {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 15px;
            background-color: rgba(255, 255, 224, 0.95);
            border: 2px solid #f0ad4e;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            z-index: 9999;
            max-width: 400px;
            word-break: break-all;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        #debug-info h4 {
            margin: 0 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid #ccc;
            font-size: 16px;
        }
        #debug-info div {
            margin-bottom: 5px;
        }
    `;
    document.head.appendChild(style);

    // ページの読み込み完了時にデバッグ情報を表示
    window.addEventListener('load', () => {
        const debugBox = document.getElementById('debug-info');
        if (!debugBox) return;

        let content = '<h4>🐞 デバッグ情報</h4>';

        // URLパラメータの表示
        const params = new URLSearchParams(window.location.search);
        content += '<div><b>URLパラメータ:</b></div>';
        if (Array.from(params).length === 0) {
            content += '<div>(なし)</div>';
        } else {
            params.forEach((value, key) => {
                content += `<div>- ${key}: ${value}</div>`;
            });
        }
        
        // Cookieの表示
        content += '<div style="margin-top:10px;"><b>Cookie:</b></div>';
        if (document.cookie === '') {
            content += '<div>(なし)</div>';
        } else {
            document.cookie.split(';').forEach(cookie => {
                content += `<div>- ${cookie.trim()}</div>`;
            });
        }

        debugBox.innerHTML = content;
    });
})();