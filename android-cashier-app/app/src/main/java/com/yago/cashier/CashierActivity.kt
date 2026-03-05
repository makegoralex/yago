package com.yago.cashier

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class CashierActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val baseUrl: String = BuildConfig.BASE_URL.trimEnd('/')
    private val posUrl: String = baseUrl + BuildConfig.POS_PATH
    private val loginUrl: String = "$baseUrl/login"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cashier)

        webView = findViewById(R.id.webView)
        val btnPosHome = findViewById<Button>(R.id.btnPosHome)
        val btnReload = findViewById<Button>(R.id.btnReload)
        val btnLogout = findViewById<Button>(R.id.btnLogout)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = "$userAgentString YagoCashierAndroid"
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (!url.startsWith(baseUrl)) {
                    return true
                }

                if (url.contains("/admin") || url.contains("/super-admin")) {
                    view?.loadUrl(posUrl)
                    return true
                }

                return false
            }
        }

        btnPosHome.setOnClickListener { webView.loadUrl(posUrl) }
        btnReload.setOnClickListener { webView.reload() }
        btnLogout.setOnClickListener { showLogoutDialog() }

        if (savedInstanceState == null) {
            webView.loadUrl(posUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun showLogoutDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.logout_confirm_title)
            .setMessage(R.string.logout_confirm_message)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.action_logout) { _, _ ->
                webView.loadUrl("javascript:window.localStorage.clear();window.sessionStorage.clear();")
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
                webView.clearHistory()
                webView.clearCache(true)
                webView.loadUrl(loginUrl)
            }
            .show()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }
        super.onBackPressed()
    }
}
