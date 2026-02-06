package com.yago.evotor

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.auth.LoginActivity
import com.yago.evotor.auth.SessionStorage

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionStorage = SessionStorage(this)
        val session = sessionStorage.loadSession()
        if (session == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        val statusText = findViewById<TextView>(R.id.statusText)
        val logoutButton = findViewById<Button>(R.id.logoutButton)

        statusText.text = getString(R.string.pos_ready_message, session.organizationId ?: "—")
        logoutButton.setOnClickListener {
            sessionStorage.clear()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }
}
