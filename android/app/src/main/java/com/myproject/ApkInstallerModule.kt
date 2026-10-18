package com.myproject

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File

class ApkInstallerModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ApkInstaller"

    @ReactMethod
    fun installApk(path: String, promise: Promise) {

        try {

            val file = File(path)

            if (!file.exists()) {
                promise.reject("NOT_FOUND", "APK introuvable")
                return
            }

            val uri = FileProvider.getUriForFile(
                reactContext,
                reactContext.packageName + ".provider",
                file
            )

            val intent = Intent(Intent.ACTION_VIEW)

            intent.setDataAndType(
                uri,
                "application/vnd.android.package-archive"
            )

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

            reactContext.startActivity(intent)

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("INSTALL_ERROR", e)
        }

    }
}