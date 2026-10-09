// FameShare – Capacitor-Plugin (iOS)
// Instagram "Sharing to Stories" und TikTok Share Kit für die Fame-Card.
// Gerüst: vor dem Einsatz gegen die aktuelle Doku von Meta und TikTok prüfen.

import Capacitor
import Photos
import TikTokOpenShareSDK   // Swift Package: github.com/tiktok/tiktok-opensdk-ios (TikTokOpenShareSDK)
import UIKit

@objc(FameSharePlugin)
public class FameSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FameSharePlugin"
    public let jsName = "FameShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "instagramStory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tiktok", returnType: CAPPluginReturnPromise),
    ]

    // Meta App ID (developers.facebook.com) – Pflicht für Sharing to Stories
    private let metaAppId = "DEINE_META_APP_ID"
    // Redirect-URI aus dem TikTok Developer Portal
    private let tiktokRedirectUri = "https://fame.app/tiktok/callback"

    // { stickerImage: base64-PNG, backgroundTopColor: "#ff8a1f", backgroundBottomColor: "#070708", contentUrl }
    @objc func instagramStory(_ call: CAPPluginCall) {
        guard let b64 = call.getString("stickerImage"), let sticker = Data(base64Encoded: b64) else {
            return call.reject("stickerImage fehlt")
        }
        guard let url = URL(string: "instagram-stories://share?source_application=\(metaAppId)") else { return }
        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(url) else { return call.reject("Instagram ist nicht installiert") }
            let item: [String: Any] = [
                "com.instagram.sharedSticker.stickerImage": sticker,
                "com.instagram.sharedSticker.backgroundTopColor": call.getString("backgroundTopColor") ?? "#141416",
                "com.instagram.sharedSticker.backgroundBottomColor": call.getString("backgroundBottomColor") ?? "#070708",
                "com.instagram.sharedSticker.contentURL": call.getString("contentUrl") ?? "",
            ]
            UIPasteboard.general.setItems([item], options: [.expirationDate: Date().addingTimeInterval(300)])
            UIApplication.shared.open(url) { ok in ok ? call.resolve() : call.reject("Instagram ließ sich nicht öffnen") }
        }
    }

    // { image: base64-PNG (9:16) } – TikTok braucht das Bild in der Fotomediathek.
    @objc func tiktok(_ call: CAPPluginCall) {
        guard let b64 = call.getString("image"), let data = Data(base64Encoded: b64), let image = UIImage(data: data) else {
            return call.reject("image fehlt")
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { return call.reject("Kein Zugriff auf Fotos") }
            var localId: String?
            PHPhotoLibrary.shared().performChanges({
                localId = PHAssetChangeRequest.creationRequestForAsset(from: image).placeholderForCreatedAsset?.localIdentifier
            }) { ok, _ in
                guard ok, let id = localId else { return call.reject("Bild konnte nicht gespeichert werden") }
                DispatchQueue.main.async {
                    let request = TikTokShareRequest(localIdentifiers: [id], mediaType: .image, redirectURI: self.tiktokRedirectUri)
                    request.send { response in
                        guard let r = response as? TikTokShareResponse, r.errorCode == .noError else {
                            return call.reject("TikTok-Teilen abgebrochen")
                        }
                        call.resolve()
                    }
                }
            }
        }
    }
}
