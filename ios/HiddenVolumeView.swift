import UIKit
import MediaPlayer

class HiddenVolumeView: UIView {
    private var systemVolumeView: MPVolumeView!
    private var volumeSlider: UISlider?

    override init(frame: CGRect) {
        super.init(frame: frame)
        self.translatesAutoresizingMaskIntoConstraints = false
        self.isUserInteractionEnabled = false
        setupSystemVolumeView()
        setupVolumeSlider()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupSystemVolumeView() {
        // Create an invisible MPVolumeView
        systemVolumeView = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 1, height: 1))
        systemVolumeView.alpha = 0.01
        addSubview(systemVolumeView)
    }

    private func setupVolumeSlider() {
        // Extract the UISlider from the MPVolumeView
        for subview in systemVolumeView.subviews {
            if let slider = subview as? UISlider {
                volumeSlider = slider
                break
            }
        }

        // Hide the slider and add it to the view hierarchy for programmatic control
        if let volumeSlider = volumeSlider {
            addSubview(volumeSlider)
            volumeSlider.translatesAutoresizingMaskIntoConstraints = false
            volumeSlider.isHidden = true

            NSLayoutConstraint.activate([
                volumeSlider.leadingAnchor.constraint(equalTo: self.leadingAnchor, constant: 8),
                volumeSlider.trailingAnchor.constraint(equalTo: self.trailingAnchor, constant: -8),
                volumeSlider.centerYAnchor.constraint(equalTo: self.centerYAnchor),
                self.heightAnchor.constraint(equalToConstant: 44)
            ])
        }
    }

    /// Get the current system volume
    func getVolume() -> Double {
        return Double(volumeSlider?.value ?? 0.0)
    }

    /// Set the system volume
    func setVolume(_ value: Double) {
        volumeSlider?.value = Float(value)
        volumeSlider?.sendActions(for: .valueChanged) // Trigger the system volume change
    }
}
