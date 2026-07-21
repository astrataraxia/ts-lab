import { createAudioAnalyzer } from "./audio/analyzer";
import { captureTabAudio, stopMediaStream } from "./audio/capture";
import type { AudioAnalyzer } from "./audio/types";
import { mountVisualizerPage } from "./page";
import {
  createWaveCanvas,
  VISUALIZER_MODES,
  type VisualizerMode,
} from "./visualizer/wave-canvas";

export function mountVisualizer(root: HTMLDivElement) {
  const elements = mountVisualizerPage(root);
  const visualizer = createWaveCanvas(elements.canvas);
  const analyzer: AudioAnalyzer = createAudioAnalyzer();

  let objectUrl: string | null = null;
  let captureStream: MediaStream | null = null;
  let animationFrame = 0;

  const onFileChange = () => {
    const file = elements.fileInput.files?.[0];

    if (!file) {
      return;
    }

    stopTabCapture();
    analyzer.connectMediaElement(elements.audio);

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);
    elements.audio.src = objectUrl;
    elements.audio.load();
    elements.playButton.disabled = false;
    elements.status.textContent = `${file.name}을(를) 준비했습니다.`;
  };

  const onPlayClick = async () => {
    try {
      if (elements.audio.paused) {
        await analyzer.resume();
        await elements.audio.play();
      } else {
        elements.audio.pause();
      }
    } catch {
      elements.status.textContent = "파일을 재생할 수 없습니다.";
    }
  };

  const onCaptureClick = async () => {
    try {
      elements.audio.pause();
      stopTabCapture();

      const stream = await captureTabAudio();
      captureStream = stream;
      analyzer.connectMediaStream(stream);
      await analyzer.resume();

      elements.captureButton.disabled = true;
      elements.stopCaptureButton.disabled = false;
      elements.playButton.disabled = true;
      elements.status.textContent = "탭 오디오를 시각화하고 있습니다.";

      stream.getAudioTracks()[0]?.addEventListener("ended", stopTabCapture);
    } catch {
      elements.status.textContent =
        "탭 오디오 공유가 취소되었거나 지원되지 않습니다.";
    }
  };

  const onAudioPlay = () => {
    elements.playButton.textContent = "일시정지";
    elements.status.textContent = "음악을 시각화하고 있습니다.";
  };

  const onAudioPause = () => {
    elements.playButton.textContent = "재생";
  };

  const onAudioEnded = () => {
    elements.playButton.textContent = "재생";
    elements.status.textContent = "재생이 끝났습니다.";
  };

  const onModeClick = (button: HTMLButtonElement) => {
    const nextMode = button.dataset.mode;

    if (!isVisualizerMode(nextMode)) {
      return;
    }

    visualizer.setMode(nextMode);

    for (const modeButton of elements.modeButtons) {
      modeButton.classList.toggle("is-active", modeButton === button);
    }
  };

  const onResize = () => visualizer.resize();

  function render() {
    visualizer.draw(analyzer.getFrame());
    animationFrame = requestAnimationFrame(render);
  }

  function stopTabCapture() {
    if (!captureStream) {
      return;
    }

    const stream = captureStream;
    captureStream = null;
    stopMediaStream(stream);
    analyzer.disconnect();
    elements.captureButton.disabled = false;
    elements.stopCaptureButton.disabled = true;
  }

  elements.fileInput.addEventListener("change", onFileChange);
  elements.playButton.addEventListener("click", onPlayClick);
  elements.captureButton.addEventListener("click", onCaptureClick);
  elements.stopCaptureButton.addEventListener("click", stopTabCapture);
  elements.audio.addEventListener("play", onAudioPlay);
  elements.audio.addEventListener("pause", onAudioPause);
  elements.audio.addEventListener("ended", onAudioEnded);
  window.addEventListener("resize", onResize);

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => onModeClick(button));
  }

  visualizer.resize();
  render();

  return () => {
    cancelAnimationFrame(animationFrame);
    stopTabCapture();
    analyzer.disconnect();
    elements.audio.pause();
    elements.fileInput.removeEventListener("change", onFileChange);
    elements.playButton.removeEventListener("click", onPlayClick);
    elements.captureButton.removeEventListener("click", onCaptureClick);
    elements.stopCaptureButton.removeEventListener("click", stopTabCapture);
    elements.audio.removeEventListener("play", onAudioPlay);
    elements.audio.removeEventListener("pause", onAudioPause);
    elements.audio.removeEventListener("ended", onAudioEnded);
    window.removeEventListener("resize", onResize);

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
}

function isVisualizerMode(value: string | undefined): value is VisualizerMode {
  return (
    value !== undefined && VISUALIZER_MODES.includes(value as VisualizerMode)
  );
}
