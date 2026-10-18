import { describe, expect, it } from 'vitest';
import { CommentRef, Events, ScratchProject } from '../src/model';

/** IMA ADPCM WAV header (format tag 0x11, mono, 22050 Hz, 4-bit) + one 512-byte block. */
function adpcmWav(factSampleCount?: number): Buffer {
  const fmt = Buffer.alloc(8 + 20);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(20, 4);
  fmt.writeUInt16LE(0x11, 8); // audio format = IMA ADPCM
  fmt.writeUInt16LE(1, 10); // num channels
  fmt.writeUInt32LE(22_050, 12); // sample rate
  fmt.writeUInt32LE(11_100, 16); // byte rate
  fmt.writeUInt16LE(512, 20); // block align
  fmt.writeUInt16LE(4, 22); // bits per sample
  fmt.writeUInt16LE(2, 24); // extra size
  fmt.writeUInt16LE(1017, 26); // samples per block
  const chunks = [fmt];
  if (factSampleCount !== undefined) {
    const fact = Buffer.alloc(12);
    fact.write('fact', 0, 'ascii');
    fact.writeUInt32LE(4, 4);
    fact.writeUInt32LE(factSampleCount, 8);
    chunks.push(fact);
  }
  const data = Buffer.alloc(8 + 512);
  data.write('data', 0, 'ascii');
  data.writeUInt32LE(512, 4);
  chunks.push(data);
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WAVE', 8, 'ascii');
  return Buffer.concat([header, body]);
}

describe('addSound', () => {
  it('stores with explicit rate + sampleCount', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const idx = sprite.addSound('beep', Buffer.from('rawbytes'), 'mp3', 22_050, 1024);

    expect(idx).toBe(0);
    const sound = sprite.data().sounds[0];
    expect(sound.name).toBe('beep');
    expect(sound.dataFormat).toBe('mp3');
    expect(sound.rate).toBe(22_050);
    expect(sound.sampleCount).toBe(1024);
    expect(project.assets.has(sound.md5ext)).toBe(true);
  });

  it('parses WAV header for rate + sampleCount', () => {
    // Minimal PCM WAV: 22050 Hz, mono, 16-bit, 4 samples (8 bytes of data).
    const buf = Buffer.alloc(44);
    buf.write('RIFF', 0, 'ascii');
    buf.writeUInt32LE(36 + 8, 4);
    buf.write('WAVE', 8, 'ascii');
    buf.write('fmt ', 12, 'ascii');
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // audio format = PCM
    buf.writeUInt16LE(1, 22); // num channels
    buf.writeUInt32LE(22_050, 24); // sample rate
    buf.writeUInt32LE(44_100, 28); // byte rate
    buf.writeUInt16LE(2, 32); // block align
    buf.writeUInt16LE(16, 34); // bits per sample
    buf.write('data', 36, 'ascii');
    buf.writeUInt32LE(8, 40);

    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    sprite.addSound('beep', buf, 'wav');
    const sound = sprite.data().sounds[0];
    expect(sound.rate).toBe(22_050);
    expect(sound.sampleCount).toBe(4);
  });

  it('takes the sample count of a compressed WAV from its fact chunk', () => {
    const sprite = ScratchProject.create().addSprite('Cat');
    sprite.addSound('laugh', adpcmWav(1000), 'wav');
    const sound = sprite.data().sounds[0];
    expect(sound.rate).toBe(22_050);
    expect(sound.sampleCount).toBe(1000);
  });

  it('refuses to guess the sample count of a compressed WAV without a fact chunk', () => {
    const sprite = ScratchProject.create().addSprite('Cat');
    expect(() => sprite.addSound('laugh', adpcmWav(), 'wav')).toThrow(/pass sampleCount explicitly/);
    sprite.addSound('laugh', adpcmWav(), 'wav', undefined, 1017);
    const sound = sprite.data().sounds[0];
    expect(sound.rate).toBe(22_050);
    expect(sound.sampleCount).toBe(1017);
  });

  it('stage can add sounds', () => {
    const project = ScratchProject.create();
    const idx = project.stage().addSound('intro', Buffer.from('bytes'), 'mp3', 44_100, 100);
    expect(idx).toBe(0);
    expect(project.getStage().sounds).toHaveLength(1);
  });
});

describe('addComment', () => {
  it('adds a free-floating comment', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const comment = sprite.addComment('hello', { x: 10, y: 20 });

    expect(comment).toBeInstanceOf(CommentRef);
    expect(comment.text()).toBe('hello');
    expect(comment.blockId()).toBeNull();
  });

  it('anchors a comment to a block', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const hat = Events.whenFlagClicked();
    sprite.addScript(hat);
    const comment = sprite.addComment('explain', { blockId: hat.id });

    expect(comment.blockId()).toBe(hat.id);
    const found = sprite.findComments(hat.id);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(comment.id);
  });

  it('CommentRef setters mutate in place', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const comment = sprite.addComment('hi');

    comment.setText('updated').setPosition(5, 6).setSize(50, 60).setMinimized(true);

    const found = sprite.findComments();
    expect(found[0].text()).toBe('updated');
    const data = found[0].data();
    expect(data.x).toBe(5);
    expect(data.y).toBe(6);
    expect(data.width).toBe(50);
    expect(data.height).toBe(60);
    expect(data.minimized).toBe(true);
  });

  it('delete removes the comment', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const comment = sprite.addComment('temp');
    comment.delete();
    expect(sprite.findComments()).toHaveLength(0);
  });
});

describe('addBroadcast', () => {
  it('stores on the stage and returns a ref', () => {
    const project = ScratchProject.create();
    const ref = project.addBroadcast('start');
    expect(ref.name).toBe('start');
    expect(project.getStage().broadcasts[ref.id]).toBe('start');
  });

  it('findBroadcast by name', () => {
    const project = ScratchProject.create();
    const ref = project.addBroadcast('reset');
    const found = project.findBroadcast('reset');
    expect(found).toBeDefined();
    expect(found!.id).toBe(ref.id);
    expect(project.findBroadcast('unknown')).toBeUndefined();
  });
});
