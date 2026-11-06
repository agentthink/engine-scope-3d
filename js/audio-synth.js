/**
 * Web Audio API 实时程序化直列四缸涡轮增压发动机声浪合成器
 * 精确匹配四缸四冲程点火基频 f = (RPM / 60) * 2，叠加谐波排气共鸣与涡轮增压叶轮高频哨音
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  class EngineAudioSynth {
    constructor() {
      this.ctx = null;
      this.enabled = false;
      this.masterGain = null;
      this.oscPrimary = null;
      this.oscSub = null;
      this.exhaustFilter = null;
      this.turboOsc = null;
      this.turboGain = null;
      this.mechNoiseGain = null;
    }

    init() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.0;
      this.masterGain.connect(ctx.destination);

      // 排气管共振低通滤波器
      this.exhaustFilter = ctx.createBiquadFilter();
      this.exhaustFilter.type = 'lowpass';
      this.exhaustFilter.frequency.value = 220;
      this.exhaustFilter.Q.value = 3.2;
      this.exhaustFilter.connect(this.masterGain);

      // 四缸点火基频锯齿波 (f = RPM / 30)
      this.oscPrimary = ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';
      this.oscPrimary.frequency.value = 28;
      const g1 = ctx.createGain();
      g1.gain.value = 0.45;
      this.oscPrimary.connect(g1);
      g1.connect(this.exhaustFilter);

      // 曲轴一阶低频浑厚底音 (f = RPM / 60)
      this.oscSub = ctx.createOscillator();
      this.oscSub.type = 'triangle';
      this.oscSub.frequency.value = 14;
      const g2 = ctx.createGain();
      g2.gain.value = 0.38;
      this.oscSub.connect(g2);
      g2.connect(this.exhaustFilter);

      // 涡轮增压叶轮高频哨音 (Turbo Spool Whistle)
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 1600;
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0.0;
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);

      // GDI高压油泵与配气门机械质感白噪声
      const bufSize = ctx.sampleRate * 1.5;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const out = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        out[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 2400;
      band.Q.value = 1.8;

      this.mechNoiseGain = ctx.createGain();
      this.mechNoiseGain.gain.value = 0.03;

      noiseSrc.connect(band);
      band.connect(this.mechNoiseGain);
      this.mechNoiseGain.connect(this.masterGain);

      this.oscPrimary.start();
      this.oscSub.start();
      this.turboOsc.start();
      noiseSrc.start();
    }

    toggle() {
      if (!this.ctx) this.init();
      if (!this.ctx) return false;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.enabled = !this.enabled;
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.16 : 0.0, now, 0.08);
      return this.enabled;
    }

    update(rpm, boostBar) {
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime;

      if (rpm < 25) {
        // 教学超慢速或停机状态静音排气轰鸣
        this.masterGain.gain.setTargetAtTime(0.005, now, 0.08);
        return;
      }

      this.masterGain.gain.setTargetAtTime(0.14 + Math.min(0.10, (rpm / 6000) * 0.10), now, 0.06);

      const firingFreq = Math.max(12, (rpm / 60) * 2.0);
      this.oscPrimary.frequency.setTargetAtTime(firingFreq, now, 0.04);
      this.oscSub.frequency.setTargetAtTime(firingFreq * 0.5, now, 0.04);

      const cutoff = 135 + Math.pow(rpm / 6000, 1.35) * 1250;
      this.exhaustFilter.frequency.setTargetAtTime(cutoff, now, 0.05);

      // 涡轮增压正压起压后发出迷人的涡轮高频哨音!
      const spoolRatio = Math.max(0, Math.min(1, (boostBar + 0.2) / 1.65));
      this.turboOsc.frequency.setTargetAtTime(1450 + spoolRatio * 2650, now, 0.06);
      this.turboGain.gain.setTargetAtTime(spoolRatio * 0.042, now, 0.06);

      this.mechNoiseGain.gain.setTargetAtTime(0.015 + (rpm / 6000) * 0.045, now, 0.06);
    }
  }

  ns.EngineAudioSynth = EngineAudioSynth;
})(window.EngineApp);
