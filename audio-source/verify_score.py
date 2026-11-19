#!/usr/bin/env python3
"""Check editable MIDI structure and that game MP3s match the analyzed masters.

This is artifact integrity checking, not an automated claim about musical taste.
No MIDI packages, audio device, sample bank or network connection are needed.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'audio-source'
EXPECTED_ASSET_PATHS = {
    'music-camp.mp3': 'assets/music-camp/music-camp.mp3',
    'music-explore.mp3': 'assets/music-explore/music-explore.mp3',
    'music-boss.mp3': 'assets/music-boss/music-boss.mp3',
    'win.mp3': 'assets/sound/win.mp3',
    'lose.mp3': 'assets/sound/lose.mp3',
}


def check_midi(path):
    data = path.read_bytes()
    assert data[:4] == b'MThd', f'{path.name}: missing MIDI header'
    header_size, kind, track_count, ppq = struct.unpack('>IHHH', data[4:14])
    assert header_size == 6 and kind == 1 and ppq == 960
    cursor = 14
    notes = 0
    last_ticks = []
    markers = []
    tempo = None

    def vlq(blob, at):
        value = 0
        for _ in range(4):
            byte = blob[at]
            at += 1
            value = (value << 7) | (byte & 127)
            if not byte & 128:
                return value, at
        raise AssertionError('Invalid variable-length MIDI integer')

    for track in range(track_count):
        assert data[cursor:cursor + 4] == b'MTrk'
        length = struct.unpack('>I', data[cursor + 4:cursor + 8])[0]
        blob = data[cursor + 8:cursor + 8 + length]
        assert len(blob) == length
        cursor += 8 + length
        at = tick = end_events = 0
        running_status = None
        held = Counter()
        while at < len(blob):
            delta, at = vlq(blob, at)
            tick += delta
            status = blob[at]
            if status >= 128:
                at += 1
                if status < 240:
                    running_status = status
            else:
                assert running_status is not None
                status = running_status
            if status == 255:
                meta_type = blob[at]
                at += 1
                size, at = vlq(blob, at)
                payload = blob[at:at + size]
                assert len(payload) == size
                at += size
                if meta_type == 0x51:
                    assert len(payload) == 3
                    tempo = int.from_bytes(payload, 'big')
                if meta_type == 6:
                    markers.append(payload.decode('utf-8'))
                if meta_type == 0x2f:
                    end_events += 1
                    assert at == len(blob), 'Events after End Of Track'
            elif status in (240, 247):
                size, at = vlq(blob, at)
                at += size
            else:
                assert 128 <= status < 240
                command, channel = status >> 4, status & 15
                size = 1 if command in (12, 13) else 2
                payload = blob[at:at + size]
                assert len(payload) == size and all(byte < 128 for byte in payload), 'Illegal MIDI channel data'
                at += size
                if command in (8, 9):
                    key, velocity = payload
                    if command == 9 and velocity:
                        held[channel, key] += 1
                        notes += 1
                    else:
                        held[channel, key] -= 1
                        assert held[channel, key] >= 0, 'Unmatched note-off'
        assert end_events == 1 and not any(held.values()), f'{path.name} track {track}: hanging notes'
        last_ticks.append(tick)
    assert cursor == len(data) and len(set(last_ticks)) == 1
    assert tempo is not None
    return {'tracks': track_count, 'notes': notes, 'seconds': last_ticks[0] / ppq * tempo / 1_000_000, 'markers': markers}


def main():
    manifest = json.loads((SOURCE / 'music-manifest.json').read_text())
    total = 0
    for track in manifest['tracks']:
        midi = check_midi(SOURCE / 'midi' / (Path(track['file']).stem + '.mid'))
        assert midi['notes'] == track['noteCount']
        assert abs(midi['seconds'] - track['durationSeconds']) < .001
        if track['loop']:
            assert 'LOOP_START' in midi['markers'] and 'LOOP_END' in midi['markers']
        assert track['assetPath'] == EXPECTED_ASSET_PATHS[track['file']], 'Unexpected music output route'
        asset = ROOT / track['assetPath']
        assert asset.is_file() and track['bundle'] == asset.parent.name
        matches = list((ROOT / 'assets').rglob(track['file']))
        assert len(matches) == 1, f"Expected one runtime file for {track['file']}, found {len(matches)}"
        assert matches[0] == asset, 'Duplicate or stale music resource outside the configured Bundle'
        payload = asset.read_bytes()
        assert hashlib.sha256(payload).hexdigest() == track['sha256']
        assert len(payload) == track['bytes'] and track['clippedSamples'] == 0
        total += len(payload)
        print(f"OK {track['file']}: {midi['notes']} MIDI notes; {track['durationSeconds']:.3f}s; SHA-256 and measured artifact match")
    assert len(manifest['tracks']) == 5
    print(f'5 scores verified, {total:,} MP3 bytes. Listening quality remains a separate review.')


if __name__ == '__main__':
    main()
