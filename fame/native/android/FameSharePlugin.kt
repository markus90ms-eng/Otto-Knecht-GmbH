// FameShare – Capacitor-Plugin (Android)
// Instagram "Sharing to Stories" und TikTok Share Kit für die Fame-Card.
// Gerüst: vor dem Einsatz gegen die aktuelle Doku von Meta und TikTok prüfen.

package app.fame.share

import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.tiktok.open.sdk.share.Format
import com.tiktok.open.sdk.share.MediaType
import com.tiktok.open.sdk.share.ShareApi
import com.tiktok.open.sdk.share.ShareRequest
import com.tiktok.open.sdk.share.model.MediaContent
import java.io.File

@CapacitorPlugin(name = "FameShare")
class FameSharePlugin : Plugin() {

    private val metaAppId = "DEINE_META_APP_ID"          // developers.facebook.com
    private val tiktokClientKey = "DEIN_TIKTOK_CLIENT_KEY" // TikTok Developer Portal

    // Base64-PNG in den Cache schreiben und über den FileProvider freigeben
    private fun saveImage(b64: String, name: String): Uri {
        val file = File(context.cacheDir, "share/$name").apply { parentFile?.mkdirs() }
        file.writeBytes(Base64.decode(b64, Base64.DEFAULT))
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    // { stickerImage, backgroundTopColor, backgroundBottomColor, contentUrl }
    @PluginMethod
    fun instagramStory(call: PluginCall) {
        val sticker = call.getString("stickerImage") ?: return call.reject("stickerImage fehlt")
        val uri = saveImage(sticker, "fame-sticker.png")
        val intent = Intent("com.instagram.share.ADD_TO_STORY").apply {
            putExtra("source_application", metaAppId)
            type = "image/png"
            putExtra("interactive_asset_uri", uri)
            putExtra("top_background_color", call.getString("backgroundTopColor") ?: "#141416")
            putExtra("bottom_background_color", call.getString("backgroundBottomColor") ?: "#070708")
            putExtra("content_url", call.getString("contentUrl") ?: "")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.grantUriPermission("com.instagram.android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (activity.packageManager.resolveActivity(intent, 0) == null) return call.reject("Instagram ist nicht installiert")
        activity.startActivity(intent)
        call.resolve()
    }

    // { image } – Story-Bild 9:16 an den TikTok-Editor übergeben
    @PluginMethod
    fun tiktok(call: PluginCall) {
        val image = call.getString("image") ?: return call.reject("image fehlt")
        val uri = saveImage(image, "fame-tiktok.png")
        listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill").forEach {
            activity.grantUriPermission(it, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val request = ShareRequest(
            clientKey = tiktokClientKey,
            mediaContent = MediaContent(mediaType = MediaType.IMAGE, mediaPaths = arrayListOf(uri.toString())),
            shareFormat = Format.DEFAULT,
            packageName = activity.packageName,
            resultActivityFullPath = "${activity.packageName}.TikTokShareResultActivity",
        )
        ShareApi(activity).share(request)
        call.resolve()
    }
}
