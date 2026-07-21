import type { AudioAnalyzer, AudioFrame } from "./types";

export function createAudioAnalyzer(): AudioAnalyzer {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  let mediaElementSource: MediaElementAudioSourceNode | null = null;
  let currentSource: AudioNode | null = null;
  let previousBass = 0;

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;

  const frame: AudioFrame = {
    timeDomain: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
    frequency: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    pulse: 0,
  };

  function getBandAverage(startRatio: number, endRatio: number): number {
    const start = Math.floor(frame.frequency.length * startRatio);
    const end = Math.max(
      start + 1,
      Math.floor(frame.frequency.length * endRatio),
    );
    let total = 0;

    for (let index = start; index < end; index += 1) {
      total += frame.frequency[index] / 255;
    }

    return total / (end - start);
  }

  function getVolume(): number {
    let total = 0;

    for (const value of frame.timeDomain) {
      const sample = (value - 128) / 128;
      total += sample * sample;
    }

    return Math.min(1, Math.sqrt(total / frame.timeDomain.length) * 2.2);
  }

  function getFrame(): AudioFrame {
    analyser.getByteTimeDomainData(frame.timeDomain);
    analyser.getByteFrequencyData(frame.frequency);

    frame.bass = getBandAverage(0, 0.12);
    frame.mid = getBandAverage(0.12, 0.5);
    frame.treble = getBandAverage(0.5, 1);
    frame.volume = getVolume();
    frame.pulse = Math.min(
      1,
      Math.max(0, frame.bass - previousBass) * 8 + frame.bass * 0.45,
    );
    previousBass = previousBass * 0.82 + frame.bass * 0.18;

    return frame;
  }

  async function resume() {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  function connectSource(source: AudioNode, outputToSpeakers: boolean) {
    currentSource?.disconnect();
    analyser.disconnect();

    source.connect(analyser);

    if (outputToSpeakers) {
      analyser.connect(audioContext.destination);
    }

    currentSource = source;
  }

  function connectMediaElement(mediaElement: HTMLAudioElement) {
    if (!mediaElementSource) {
      mediaElementSource = audioContext.createMediaElementSource(mediaElement);
    }

    connectSource(mediaElementSource, true);
  }

  function connectMediaStream(stream: MediaStream) {
    const streamSource = audioContext.createMediaStreamSource(stream);
    connectSource(streamSource, false);
  }

  function disconnect() {
    currentSource?.disconnect();
    analyser.disconnect();
    currentSource = null;
  }

  return {
    getFrame,
    connectMediaElement,
    connectMediaStream,
    disconnect,
    resume,
  };
}
