type AudioByteArray = Uint8Array<ArrayBuffer>;

export type AudioFrame = {
  timeDomain: AudioByteArray;
  frequency: AudioByteArray;
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  pulse: number;
};

export type AudioAnalyzer = {
  getFrame: () => AudioFrame;
  connectMediaElement: (audio: HTMLAudioElement) => void;
  connectMediaStream: (stream: MediaStream) => void;
  disconnect: () => void;
  resume: () => Promise<void>;
};
