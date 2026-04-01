let audioContext: AudioContext | null = null

export function playMessageNotificationTone() {
  if (typeof window === "undefined") return

  const AudioContextConstructor =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) return

  if (!audioContext) {
    audioContext = new AudioContextConstructor()
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }

  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  const now = audioContext.currentTime

  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(660, now)
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12)

  gainNode.gain.setValueAtTime(0.0001, now)
  gainNode.gain.exponentialRampToValueAtTime(0.018, now + 0.03)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.3)
}
