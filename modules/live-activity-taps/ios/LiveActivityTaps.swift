import ExpoModulesCore
import UIKit

// expo-widgets runs the Live Activity's button intent in Barry's process and posts this notification, which reaches
// JavaScript only while a listener is attached. A tap that relaunches Barry arrives before the JavaScript has loaded,
// so the taps are kept here from launch until the JavaScript takes them.
final class LiveActivityTaps {
  static let shared = LiveActivityTaps()
  static let tapped = Notification.Name("barry.liveActivityTapped")

  private let key = "barry.liveActivityTaps"
  private let lock = NSLock()
  private var backgroundTask = UIBackgroundTaskIdentifier.invalid

  func observe() {
    NotificationCenter.default.addObserver(
      forName: Notification.Name("onExpoWidgetsUserInteraction"), object: nil, queue: nil
    ) { [weak self] notification in
      guard let data = notification.userInfo?["eventData"] as? [String: Any],
            let target = data["target"] as? String else { return }
      let at = (data["timestamp"] as? Double) ?? Date().timeIntervalSince1970 * 1000
      self?.record(["target": target, "at": at])
    }
  }

  private func record(_ tap: [String: Any]) {
    lock.lock()
    UserDefaults.standard.set(pending() + [tap], forKey: key)
    lock.unlock()
    DispatchQueue.main.async {
      // The intent returns at once, so Barry asks for time to send the Check-in before iOS suspends it.
      if self.backgroundTask == .invalid {
        self.backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "barry.checkIn") { self.finish() }
      }
      NotificationCenter.default.post(name: LiveActivityTaps.tapped, object: nil)
    }
  }

  private func pending() -> [[String: Any]] {
    UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
  }

  func take() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let taps = pending()
    UserDefaults.standard.removeObject(forKey: key)
    return taps
  }

  func finish() {
    DispatchQueue.main.async {
      guard self.backgroundTask != .invalid else { return }
      UIApplication.shared.endBackgroundTask(self.backgroundTask)
      self.backgroundTask = .invalid
    }
  }
}

public class LiveActivityTapsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    LiveActivityTaps.shared.observe()
    return true
  }
}

public class LiveActivityTapsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("LiveActivityTaps")

    Events("onTap")

    OnStartObserving("onTap") {
      self.observer = NotificationCenter.default.addObserver(forName: LiveActivityTaps.tapped, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onTap")
      }
    }

    OnStopObserving("onTap") {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }

    // The taps not taken yet, oldest first, each with its target and the time of the tap in milliseconds.
    Function("take") { LiveActivityTaps.shared.take() }

    // Ends the background time a tap asked for, once its Check-in is queued and sent or waiting for signal.
    Function("finish") { LiveActivityTaps.shared.finish() }
  }
}
