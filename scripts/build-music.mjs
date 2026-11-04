// 离线改编：保留原曲旋律与音高，用节拍跟随的和弦、低音和芯片音色重配。
// 需要系统已有 FFmpeg/ffprobe；不安装 Python 或 npm 音频依赖。
// node scripts/build-music.mjs [--analyze] [--source-bpm 120]
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = resolve(root, '.verify/audio');
const output = resolve(root, 'public/audio/orchard-futurebass.mp3');
const source = resolve(root, 'archive/prototype-2026-11-04/public/audio/bgm.mp3');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const tempoRatio = 1.25;
const sr = 44100;
const analysisRate = 11025;
const nfft = 2048;
const hop = 256;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const ffmpeg = argv => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { maxBuffer: 8 * 1024 * 1024 });
await mkdir(temp, { recursive: true });
await mkdir(dirname(output), { recursive: true });
ffmpeg(['-i', source, '-ac', '1', '-ar', String(analysisRate), '-f', 'f32le', resolve(temp, 'source.f32')]);
const sourceBytes = await readFile(resolve(temp, 'source.f32'));
const mono = new Float32Array(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength / 4);

// 固定小FFT只负责离线节拍/和声分析，不进入浏览器运行包。
const reverse = new Uint16Array(nfft);
for (let i = 0; i < nfft; i++) { let value = i, out = 0; for (let b = 0; b < 11; b++) { out = (out << 1) | (value & 1); value >>>= 1; } reverse[i] = out; }
const window = Float64Array.from({ length: nfft }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (nfft - 1)));
const real = new Float64Array(nfft), imag = new Float64Array(nfft);
function spectrum(offset) {
  for (let i = 0; i < nfft; i++) { real[reverse[i]] = (mono[offset + i] ?? 0) * window[i]; imag[reverse[i]] = 0; }
  for (let size = 2; size <= nfft; size *= 2) {
    const half = size / 2, step = -2 * Math.PI / size;
    for (let base = 0; base < nfft; base += size) for (let j = 0; j < half; j++) {
      const c = Math.cos(step * j), s = Math.sin(step * j), a = base + j, b = a + half;
      const tr = real[b] * c - imag[b] * s, ti = real[b] * s + imag[b] * c;
      real[b] = real[a] - tr; imag[b] = imag[a] - ti; real[a] += tr; imag[a] += ti;
    }
  }
  const mag = new Float64Array(nfft / 2);
  for (let i = 1; i < mag.length; i++) mag[i] = Math.hypot(real[i], imag[i]);
  return mag;
}
const chromaFrames = [], novelty = [];
let previous = new Float64Array(nfft / 2);
for (let offset = 0; offset + nfft < mono.length; offset += hop) {
  const mag = spectrum(offset), chroma = new Float64Array(12);
  let flux = 0;
  for (let k = 8; k < Math.min(mag.length, 900); k++) {
    const value = Math.log1p(mag[k] * 2);
    flux += Math.max(0, value - previous[k]); previous[k] = value;
  }
  for (let note = 40; note <= 88; note++) {
    const bin = 440 * 2 ** ((note - 69) / 12) * nfft / analysisRate;
    const index = Math.round(bin);
    const strength = Math.max(mag[index - 1] ?? 0, mag[index] ?? 0, mag[index + 1] ?? 0);
    chroma[note % 12] += strength ** 0.7 / (1 + (note - 40) * 0.018);
  }
  chromaFrames.push(chroma); novelty.push(flux);
}
const noveltyMean = novelty.reduce((a, b) => a + b, 0) / novelty.length;
const onset = novelty.map((value, i) => Math.max(0, value - Math.max(noveltyMean * 0.55, (novelty[i - 1] ?? value) * 0.28)));
const frameRate = analysisRate / hop;
function autocorrelation(lag) {
  let total = 0, aa = 0, bb = 0;
  for (let i = Math.ceil(lag); i < onset.length; i++) {
    const at = i - lag, low = Math.floor(at), fraction = at - low;
    const a = onset[i], b = onset[low] * (1 - fraction) + (onset[low + 1] ?? 0) * fraction;
    total += a * b; aa += a * a; bb += b * b;
  }
  return total / Math.sqrt(aa * bb || 1);
}
const tempoCandidates = [];
for (let bpm = 72; bpm <= 180; bpm += 0.1) {
  const lag = 60 * frameRate / bpm;
  const score = autocorrelation(lag) + 0.6 * autocorrelation(lag * 2) + 0.25 * autocorrelation(lag * 4);
  tempoCandidates.push({ bpm: Number(bpm.toFixed(1)), score });
}
tempoCandidates.sort((a, b) => b.score - a.score);
const peaks = tempoCandidates.filter((candidate, i, list) => !list.slice(0, i).some(other => Math.abs(other.bpm - candidate.bpm) < 1.5)).slice(0, 8);
const detectedBpm = tempoCandidates[0].bpm;
// 有限窗造成的小数误差接近整拍时归整；仍保存全部原始候选用于复核。
const sourceBpm = Number(option('--source-bpm') ?? (Math.abs(detectedBpm - Math.round(detectedBpm)) < 0.25 ? Math.round(detectedBpm) : detectedBpm));
const sourceBeat = 60 / sourceBpm;
// 短窗低频起音校准鼓网；长窗全频谱的新颖度容易被旋律起音拉偏。
ffmpeg(['-i', source, '-ac', '1', '-ar', String(analysisRate), '-af', 'lowpass=f=180', '-f', 'f32le', resolve(temp, 'low-frequency.f32')]);
const lowBytes = await readFile(resolve(temp, 'low-frequency.f32'));
const lowSource = new Float32Array(lowBytes.buffer, lowBytes.byteOffset, lowBytes.byteLength / 4);
const lowHop = Math.round(analysisRate * 0.01), lowFrameRate = analysisRate / lowHop, lowOnsets = [];
let lastRms = 0;
for (let start = 0; start + lowHop < lowSource.length; start += lowHop) {
  let energy = 0; for (let n = start; n < start + lowHop; n++) energy += lowSource[n] ** 2;
  const value = Math.sqrt(energy / lowHop);
  lowOnsets.push(Math.max(0, value - lastRms)); lastRms = value;
}
let phase = 0, phaseScore = -Infinity;
for (let t = 0; t < sourceBeat; t += 0.002) {
  let score = 0;
  for (let beat = 0; beat < 256; beat++) {
    const index = Math.round((t + beat * sourceBeat) * lowFrameRate);
    score += lowOnsets[index] ?? 0;
  }
  if (score > phaseScore) { phaseScore = score; phase = t; }
}
const sourceDuration = mono.length / analysisRate;
console.log(JSON.stringify({ sourceDuration, estimatedSourceBpm: sourceBpm, targetBpm: sourceBpm * tempoRatio, phase, tempoCandidates: peaks }, null, 2));
if (args.includes('--analyze')) {
  await Promise.all(['source.f32', 'low-frequency.f32'].map(name => unlink(resolve(temp, name))));
  process.exit(0);
}

ffmpeg(['-i', source, '-af', `atempo=${tempoRatio},highpass=f=85,lowpass=f=15500`, '-ar', String(sr), '-ac', '2', '-f', 'f32le', resolve(temp, 'retimed.f32')]);
const retimedBytes = await readFile(resolve(temp, 'retimed.f32'));
const retimed = new Float32Array(retimedBytes.buffer, retimedBytes.byteOffset, retimedBytes.byteLength / 4);
const bpm = sourceBpm * tempoRatio, beatDuration = 60 / bpm, barDuration = beatDuration * 4;
const offsetSeconds = phase / tempoRatio;
const barCount = Math.floor((retimed.length / (sr * 2) - offsetSeconds) / barDuration);
const duration = barCount * barDuration;
const frameCount = Math.round(duration * sr);
const audio = new Float32Array(frameCount * 2);
const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const chords = [];
let previousRoot = -1;
for (let bar = 0; bar < barCount; bar++) {
  const start = phase + bar * sourceBeat * 4;
  const chroma = new Float64Array(12);
  for (let i = Math.round(start * frameRate); i < Math.round((start + sourceBeat * 4) * frameRate); i++) for (let n = 0; n < 12; n++) chroma[n] += chromaFrames[i]?.[n] ?? 0;
  const candidates = [];
  for (let rootNote = 0; rootNote < 12; rootNote++) for (const minor of [false, true]) {
    const third = minor ? 3 : 4;
    const score = chroma[rootNote] + chroma[(rootNote + third) % 12] * 0.85 + chroma[(rootNote + 7) % 12] * 0.8 + (previousRoot === rootNote ? chroma[rootNote] * 0.06 : 0);
    candidates.push({ root: rootNote, minor, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chord = candidates[0]; previousRoot = chord.root;
  // 只有源和声确实支持时才加七/九音，避免把属七擅自改成大七。
  const primaryStrength = Math.max(chroma[chord.root], chroma[(chord.root + (chord.minor ? 3 : 4)) % 12], chroma[(chord.root + 7) % 12]);
  const seventh = chroma[(chord.root + 10) % 12] > chroma[(chord.root + 11) % 12] ? 10 : 11;
  const supportedSeventh = chroma[(chord.root + seventh) % 12] > primaryStrength * 0.55 ? seventh : 12;
  const supportedNinth = chroma[(chord.root + 2) % 12] > primaryStrength * 0.55;
  const suffix = chord.minor ? (supportedSeventh === 10 ? 'm7' : supportedSeventh === 11 ? 'm(maj7)' : 'm') : supportedSeventh === 10 ? '7' : supportedSeventh === 11 ? 'maj7' : '';
  chords.push({ ...chord, seventh: supportedSeventh, ninth: supportedNinth, name: notes[chord.root] + suffix + (supportedNinth ? '(add9)' : '') });
}

let noiseSeed = 0x1234abcd;
const noise = () => { noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0; return noiseSeed / 2147483648 - 1; };
const midiHz = note => 440 * 2 ** ((note - 69) / 12);
const pulse = (phase, width = 0.5) => (phase % 1 < width ? 1 : -1);
const saw = phase => 2 * (phase % 1) - 1;
const triangle = phase => 1 - 4 * Math.abs((phase % 1) - 0.5);
const pi2 = Math.PI * 2;
let lowL = 0, lowR = 0, lastNoise = 0, bassPhase = 0;
const phaseLA = Float64Array.from({ length: 5 }, (_, i) => i * 0.173);
const phaseLB = Float64Array.from({ length: 5 }, (_, i) => i * 0.237);
const phaseRA = Float64Array.from({ length: 5 }, (_, i) => i * 0.317);
const phaseRB = Float64Array.from({ length: 5 }, (_, i) => i * 0.113);
const phaseTriangle = Float64Array.from({ length: 5 }, (_, i) => i * 0.193);
const frequencyByBar = chords.map(chord => {
  const rootMidi = 48 + chord.root;
  return { root: midiHz(rootMidi - 24), chord: [0, chord.minor ? 3 : 4, 7, chord.seventh, chord.ninth ? 14 : 19].map(interval => midiHz(rootMidi + interval)), arp: [12, 19, chord.minor ? 15 : 16, chord.ninth ? 26 : 24, 19, 24, chord.seventh === 12 ? 24 : chord.seventh + 12, 19].map(interval => midiHz(rootMidi + interval)) };
});
const lowpassCoefficient = 1 - Math.exp(-pi2 * 2700 / sr);
// 原旋律主体走芯片湿声；低频保留干净，抑制降采样镜像而不让全频失真。
const sourceRetro = { cleanLowCutoffHz: 300, melodyLowpassHz: 3200, wetLowpassHz: 5800, sampleHoldFrames: 4, sampleRateHz: sr / 4, bitDepth: 8, melodyWet: 0.92, melodyDry: 0.08, cleanLow: 0.85, highAir: 0.08, pulseLeadGain: 0.04 };
const sourceLowCoefficient = 1 - Math.exp(-pi2 * sourceRetro.cleanLowCutoffHz / sr);
const sourceMelodyCoefficient = 1 - Math.exp(-pi2 * sourceRetro.melodyLowpassHz / sr);
const sourceWetCoefficient = 1 - Math.exp(-pi2 * sourceRetro.wetLowpassHz / sr);
const sourceLowA = new Float64Array(2), sourceLowB = new Float64Array(2);
const sourceMelodyA = new Float64Array(2), sourceMelodyB = new Float64Array(2);
const heldMelody = new Float64Array(2), smoothedWetA = new Float64Array(2), smoothedWetB = new Float64Array(2);
const sourceEnergy = { wetMelody: 0, dryMelody: 0, cleanLow: 0, highAir: 0 };
function chipSource(value, channel, sampleIndex) {
  sourceLowA[channel] += sourceLowCoefficient * (value - sourceLowA[channel]);
  sourceLowB[channel] += sourceLowCoefficient * (sourceLowA[channel] - sourceLowB[channel]);
  sourceMelodyA[channel] += sourceMelodyCoefficient * (value - sourceMelodyA[channel]);
  sourceMelodyB[channel] += sourceMelodyCoefficient * (sourceMelodyA[channel] - sourceMelodyB[channel]);
  const low = sourceLowB[channel], melody = sourceMelodyB[channel] - low;
  if (sampleIndex % sourceRetro.sampleHoldFrames === 0) {
    const driven = Math.tanh(melody * 2.6) / 2.6;
    heldMelody[channel] = Math.round(clamp(driven, -1, 127 / 128) * 128) / 128;
  }
  smoothedWetA[channel] += sourceWetCoefficient * (heldMelody[channel] - smoothedWetA[channel]);
  smoothedWetB[channel] += sourceWetCoefficient * (smoothedWetA[channel] - smoothedWetB[channel]);
  const wet = smoothedWetB[channel] * sourceRetro.melodyWet, dry = melody * sourceRetro.melodyDry;
  const clean = low * sourceRetro.cleanLow, air = (value - sourceMelodyB[channel]) * sourceRetro.highAir;
  sourceEnergy.wetMelody += wet * wet; sourceEnergy.dryMelody += dry * dry;
  sourceEnergy.cleanLow += clean * clean; sourceEnergy.highAir += air * air;
  return clean + wet + dry + air;
}
const sourceOffset = Math.round(offsetSeconds * sr);
const loopFade = Math.round(sr * 0.008);
for (let i = 0; i < frameCount; i++) {
  const t = i / sr, beat = t / beatDuration, barIndex = Math.min(barCount - 1, Math.floor(beat / 4));
  const barBeat = beat % 4, beatPhase = beat % 1, beatIndex = Math.floor(beat), eighth = (beat * 2) % 1;
  const bar = frequencyByBar[barIndex], section = barIndex % 32;
  const drop = section >= 4 && section < 16 || section >= 20 && section < 30;
  const build = section < 4 || section >= 30;
  const intensity = drop ? 1 : build ? 0.62 : 0.4;
  // 泵感作用于和弦与低音，原曲旋律只轻微让位，保留原有可辨识度。
  const duck = 1 - 0.72 * Math.exp(-beatPhase * 9);
  const chordGate = 0.12 + 0.88 * Math.exp(-eighth * (drop ? 3.2 : 2));
  let padL = 0, padR = 0;
  for (let n = 0; n < bar.chord.length; n++) {
    const freq = bar.chord[n], wobble = 0.004 * Math.sin(pi2 * t * 0.33 + n);
    // 积分瞬时频率，不能把 t 直接乘时变失谐量，否则后半曲会产生不断扩大的跑调。
    phaseLA[n] = (phaseLA[n] + freq * (0.997 + wobble) / sr) % 1;
    phaseLB[n] = (phaseLB[n] + freq * 1.003 / sr) % 1;
    phaseRA[n] = (phaseRA[n] + freq * (1.004 + wobble) / sr) % 1;
    phaseRB[n] = (phaseRB[n] + freq * 0.996 / sr) % 1;
    phaseTriangle[n] = (phaseTriangle[n] + freq * 0.5 / sr) % 1;
    padL += saw(phaseLA[n]) * 0.42 + saw(phaseLB[n]) * 0.32 + triangle(phaseTriangle[n]) * 0.26;
    padR += saw(phaseRA[n]) * 0.42 + saw(phaseRB[n]) * 0.32 + triangle(phaseTriangle[n]) * 0.26;
  }
  lowL += lowpassCoefficient * (padL / 5 - lowL); lowR += lowpassCoefficient * (padR / 5 - lowR);
  const chordGain = 0.28 * intensity * duck * chordGate;
  bassPhase = (bassPhase + bar.root / sr) % 1;
  const bass = (Math.sin(pi2 * bassPhase) * 0.78 + triangle(bassPhase * 2) * 0.22) * 0.15 * intensity * duck;
  // 方波琶音补充前景芯片音色，原曲主体本身也经过分频采样保持/8bit量化。
  const arpIndex = Math.floor(beat * 2) % 8, arpFreq = bar.arp[arpIndex];
  const arpEnvelope = Math.exp(-eighth * 7) * Math.min(1, eighth * 80);
  const arp = pulse(t * arpFreq, 0.25) * arpEnvelope * sourceRetro.pulseLeadGain * (drop ? 1 : 0.65);
  const from = (i + sourceOffset) * 2;
  const originalL = retimed[from] ?? 0, originalR = retimed[from + 1] ?? 0;
  const chipSourceL = chipSource(originalL, 0, i), chipSourceR = chipSource(originalR, 1, i);
  // 鼓声跟随同一拍网，半拍军鼓保留future bass的松弛感。
  const kickBeat = barBeat >= 2.75 ? 2.75 : barBeat >= 1.5 ? 1.5 : 0;
  const kickTime = (barBeat - kickBeat) * beatDuration;
  const kick = Math.sin(pi2 * (46 * kickTime + 4.6 * (1 - Math.exp(-kickTime * 28)))) * Math.exp(-kickTime * 24) * 0.19 * intensity;
  const random = noise(), highNoise = random - lastNoise * 0.8; lastNoise = random;
  const snarePhase = barBeat - 2;
  const snareTime = snarePhase >= 0 && snarePhase < 1 ? snarePhase * beatDuration : 10;
  const snare = (highNoise * 0.8 + Math.sin(pi2 * 185 * snareTime) * 0.2) * Math.exp(-snareTime * 25) * 0.12 * intensity;
  const hatTime = eighth * beatDuration / 2;
  const hat = highNoise * Math.exp(-hatTime * 140) * 0.022 * intensity * (beatIndex % 2 ? 0.8 : 1);
  const originalGain = 0.72 * (1 - 0.1 * Math.exp(-beatPhase * 8));
  let l = chipSourceL * originalGain + lowL * chordGain + bass + arp * (arpIndex % 2 ? 0.85 : 1) + kick + snare + hat;
  let r = chipSourceR * originalGain + lowR * chordGain + bass + arp * (arpIndex % 2 ? 1 : 0.85) + kick + snare + hat;
  // 温和饱和后再由FFmpeg作响度/真峰值限制；两端8ms去点击，不改拍速。
  const fade = Math.min(1, i / loopFade, (frameCount - 1 - i) / loopFade);
  audio[i * 2] = Math.tanh(l * 1.05) * fade;
  audio[i * 2 + 1] = Math.tanh(r * 1.05) * fade;
}
const rendered = resolve(temp, 'futurebass-mix.f32');
await writeFile(rendered, Buffer.from(audio.buffer));
ffmpeg(['-f', 'f32le', '-ar', String(sr), '-ac', '2', '-i', rendered, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', String(sr), '-codec:a', 'libmp3lame', '-b:a', '192k', '-metadata', 'title=幸存兔 · Orchard Future Bass 8bit', '-metadata', 'comment=Offline remix; tempo ratio 1.25; pitch-preserving time stretch', output]);
ffmpeg(['-i', output, '-ss', String(Math.min(20, duration / 4)), '-t', '30', '-codec:a', 'libmp3lame', '-b:a', '192k', resolve(temp, 'futurebass-preview.mp3')]);
const loudness = spawnSync('ffmpeg', ['-hide_banner', '-i', output, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (loudness.status !== 0) throw new Error(loudness.stderr);
const measuredLoudness = JSON.parse(loudness.stderr.slice(loudness.stderr.lastIndexOf('{'), loudness.stderr.lastIndexOf('}') + 1));
const measure = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=sample_rate,channels', '-of', 'json', output], { encoding: 'utf8' });
ffmpeg(['-i', output, '-f', 'f32le', '-ac', '2', '-ar', String(sr), resolve(temp, 'encoded-check.f32')]);
const checkBytes = await readFile(resolve(temp, 'encoded-check.f32'));
const check = new Float32Array(checkBytes.buffer, checkBytes.byteOffset, checkBytes.byteLength / 4);
let sumSquares = 0, samplePeak = 0, clippedSamples = 0;
for (const value of check) { sumSquares += value * value; samplePeak = Math.max(samplePeak, Math.abs(value)); if (Math.abs(value) >= 1) clippedSamples++; }
const measurements = { decodedDuration: check.length / (2 * sr), samplePeakDbFS: 20 * Math.log10(samplePeak), rmsDbFS: 10 * Math.log10(sumSquares / check.length), clippedSamples, loopBoundaryStep: Math.max(Math.abs(check[0] - check[check.length - 2]), Math.abs(check[1] - check[check.length - 1])) };
if (clippedSamples > 0 || !Number.isFinite(measurements.rmsDbFS) || Math.abs(measurements.decodedDuration - duration) > 1 / sr) throw new Error('编码后削波、静音或循环长度不符合预期');
const sourceBranchRmsDbFS = Object.fromEntries(Object.entries(sourceEnergy).map(([name, energy]) => [name, 10 * Math.log10(energy / (frameCount * 2))]));
const stats = { source: 'archive/prototype-2026-11-04/public/audio/bgm.mp3', output: 'public/audio/orchard-futurebass.mp3', tempoRatio, sourceDuration, rawDetectedBpm: detectedBpm, estimatedSourceBpm: sourceBpm, targetBpm: bpm, beatPhaseSourceSeconds: phase, loopBars: barCount, loopSeconds: duration, trimmedToBarBoundary: true, sourceTempoCandidates: peaks, chords: chords.map((chord, bar) => ({ bar: bar + 1, name: chord.name })), sourceRetro, sourceBranchRmsDbFS, encoded: JSON.parse(measure), measuredLoudness, measurements, processing: ['FFmpeg atempo=1.25, pitch preserved', 'Source-supported supersaw chord voicings; seventh/ninth only with chroma support', 'Beat-synchronized sidechain ducking and sub bass', 'Original melodic band: 92% wet 8bit / 11.025kHz sample hold, 8% dry; clean low band and reduced high air', 'Stronger 25%-duty pulse arpeggio lead', 'Synthesized kick, half-time snare and hats', '8ms edge de-click and -16 LUFS / -1.5 dBTP target'], verification: 'Tempo analysis is an estimate; no human listening assertion. Exact speed ratio comes from atempo.', loudnessCommand: 'ffmpeg -i public/audio/orchard-futurebass.mp3 -af loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json -f null -' };
await mkdir(resolve(root, 'art/audio'), { recursive: true });
await writeFile(resolve(root, 'art/audio/remix.json'), JSON.stringify(stats, null, 2) + '\n');
// 仅保留小型试听，成功后移除较大的PCM中间文件。
await Promise.all(['source.f32', 'low-frequency.f32', 'retimed.f32', 'futurebass-mix.f32', 'encoded-check.f32'].map(name => unlink(resolve(temp, name))));
console.log(JSON.stringify({ output, bpm, barCount, duration, encoded: stats.encoded }, null, 2));
