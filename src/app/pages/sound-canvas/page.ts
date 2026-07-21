export type VisualizerElements = {
  canvas: HTMLCanvasElement;
  audio: HTMLAudioElement;
  fileInput: HTMLInputElement;
  playButton: HTMLButtonElement;
  captureButton: HTMLButtonElement;
  stopCaptureButton: HTMLButtonElement;
  backButton: HTMLAnchorElement;
  status: HTMLParagraphElement;
  modeButtons: HTMLButtonElement[];
};

export function mountVisualizerPage(root: HTMLDivElement): VisualizerElements {
  root.innerHTML = `
    <main class="visualizer-app">
      <canvas id="wave-canvas" aria-label="음악 시각화"></canvas>

      <section class="control-bar" aria-label="오디오와 시각화 컨트롤">
        <a class="back-button" href="#/home" aria-label="메인 화면으로 돌아가기">←</a>

        <div class="source-controls">
          <label class="control-button" for="audio-file">
            파일
            <input id="audio-file" type="file" accept="audio/*" />
          </label>
          <button id="play-button" type="button" disabled>재생</button>
          <button id="capture-button" type="button">탭 소리</button>
          <button id="stop-capture-button" type="button" disabled>중지</button>
        </div>

        <nav class="mode-grid" aria-label="시각화 모드">
          <button class="mode-button is-active" type="button" data-mode="aurora">오로라</button>
          <button class="mode-button" type="button" data-mode="waveform">파형</button>
          <button class="mode-button" type="button" data-mode="orb">구체</button>
          <button class="mode-button" type="button" data-mode="stars">별자리</button>
          <button class="mode-button" type="button" data-mode="radial">원형</button>
          <button class="mode-button" type="button" data-mode="mandala">만다라</button>
        </nav>

        <p id="status" class="sr-only" aria-live="polite"></p>
        <audio id="audio-player" preload="metadata"></audio>
      </section>
    </main>
  `;

  return {
    canvas: getElement(root, "#wave-canvas"),
    audio: getElement(root, "#audio-player"),
    fileInput: getElement(root, "#audio-file"),
    playButton: getElement(root, "#play-button"),
    captureButton: getElement(root, "#capture-button"),
    stopCaptureButton: getElement(root, "#stop-capture-button"),
    backButton: getElement(root, ".back-button"),
    status: getElement(root, "#status"),
    modeButtons: Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-mode]"),
    ),
  };
}

function getElement<T extends Element>(
  root: HTMLDivElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}
