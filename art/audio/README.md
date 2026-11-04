# 果园BGM离线改编

成品：`public/audio/orchard-futurebass.mp3`。源音乐保留在 `archive/prototype-2026-11-04/public/audio/bgm.mp3`。

在已安装Node.js与FFmpeg/ffprobe的开发机运行：

```sh
node scripts/build-music.mjs
node scripts/build-music.mjs --analyze
```

脚本先测原曲频谱起音周期与低频鼓点，再用FFmpeg `atempo=1.25`保持音高加速；估计原拍速约120 BPM，编曲网格150 BPM。可通过 `--source-bpm` 明确覆盖节拍估计。

原曲主体采用分频芯片处理：300Hz以下低频保留干净，旋律带先限至约3.2kHz，再以11.025kHz采样保持和8bit量化处理，湿/干比例92%/8%；湿声经过5.8kHz低通缓和镜像，高频空气感仅保留8%。脉冲琶音增益由0.026提高到0.04（约1.54倍），原旋律本身有明显的采样保持/位深色彩，避免只靠背景琶音表现8bit。

手写DSP还叠加跟随源音和声的失谐锯齿/三角和弦、低音、侧链泵感与半拍鼓组；扩展七/九音只在源chroma支持时加入。和弦属于自动伴奏推断，不是精确转录。

成品裁到76个完整4拍小节，时长121.6秒，首尾8ms去点击。FFmpeg将其归一至约−16 LUFS，并限制真峰值。实际编码后指标、节拍候选与自动和弦记录在 `remix.json`。循环接缝幅度可以测量，和声自然度仍应试听判断；没有伪称完成真人试听。

分析PCM与混音中间文件临时写入 `.verify/audio/`，成功后清理，只保留30秒试听；这些文件不发布。成品直接入库，浏览器只播放MP3，CI无需安装FFmpeg或现场合成。
