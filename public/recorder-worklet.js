// Captures raw microphone samples with the exact audio-clock frame they arrived on.
class MqRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.buf = [];
    this.size = 0;
    this.first = -1;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.first = -1; }
      if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ type: 'done' }); }
    };
  }
  flush() {
    if (!this.size) return;
    const out = new Float32Array(this.size);
    let o = 0;
    for (const b of this.buf) { out.set(b, o); o += b.length; }
    this.port.postMessage({ type: 'chunk', data: out }, [out.buffer]);
    this.buf = []; this.size = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (this.on && ch) {
      if (this.first < 0) { this.first = currentFrame; this.port.postMessage({ type: 'first', frame: currentFrame }); }
      this.buf.push(new Float32Array(ch));
      this.size += ch.length;
      if (this.size >= 8192) this.flush();
    }
    return true;
  }
}
registerProcessor('mq-recorder', MqRecorder);
