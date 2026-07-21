export async function captureTabAudio(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  if (stream.getAudioTracks().length === 0) {
    stopMediaStream(stream);
    throw new Error("오디오 공유가 허용되지 않았습니다.");
  }

  for (const videoTrack of stream.getVideoTracks()) {
    videoTrack.stop();
  }

  return stream;
}

export function stopMediaStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
