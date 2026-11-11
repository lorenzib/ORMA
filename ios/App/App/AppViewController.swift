import UIKit
import Capacitor

// The app's web view, with ORMA's own native plugins registered on it.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthWalksPlugin())
    }
}
