System.register([], function (exports_1, context_1) {
    "use strict";
    var alphabet;
    var __moduleName = context_1 && context_1.id;
    function bytesFromBase64(text) {
        const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
        if (text.length % 4)
            throw new Error('Invalid mesh byte encoding');
        const out = new Uint8Array(text.length / 4 * 3 - padding);
        let at = 0;
        for (let i = 0; i < text.length; i += 4) {
            const a = alphabet.indexOf(text[i]), b = alphabet.indexOf(text[i + 1]), c = text[i + 2] === '=' ? 0 : alphabet.indexOf(text[i + 2]), d = text[i + 3] === '=' ? 0 : alphabet.indexOf(text[i + 3]);
            if (Math.min(a, b, c, d) < 0)
                throw new Error('Invalid mesh byte encoding');
            const n = (a << 18) | (b << 12) | (c << 6) | d;
            if (at < out.length)
                out[at++] = (n >> 16) & 255;
            if (at < out.length)
                out[at++] = (n >> 8) & 255;
            if (at < out.length)
                out[at++] = n & 255;
        }
        return out;
    }
    /** Renderer-independent decoder. No browser globals are required on WeChat. */
    function decodeMesh(data) {
        if (!('encoding' in data))
            return data;
        if (data.encoding !== 'q16-n8-c8-v1' || !Number.isInteger(data.vertexCount) || data.vertexCount <= 0 || !Number.isInteger(data.indexCount) || data.indexCount % 3 || ![2, 4].includes(data.indexBytes))
            throw new Error('Invalid packed mesh');
        const n = data.vertexCount, bytes = bytesFromBase64(data.data), expected = n * (13 + (data.hasUV ? 8 : 0)) + data.indexCount * data.indexBytes;
        if (bytes.length !== expected || data.min.length !== 3 || data.span.length !== 3 || [...data.min, ...data.span].some(x => !Number.isFinite(x)))
            throw new Error('Invalid mesh buffer size or bounds');
        const view = new DataView(bytes.buffer), positions = [], normals = [], colors = [], uvs = [], indices = [];
        let at = 0;
        for (let i = 0; i < n * 3; i++, at += 2)
            positions.push(data.min[i % 3] + view.getUint16(at, true) / 65535 * data.span[i % 3]);
        for (let i = 0; i < n * 3; i++, at++)
            normals.push(view.getInt8(at) / 127);
        for (let i = 0; i < n * 4; i++, at++)
            colors.push(view.getUint8(at) / 255);
        for (let i = 0; i < n * 2; i++) {
            uvs.push(data.hasUV ? view.getFloat32(at, true) : 0);
            if (data.hasUV)
                at += 4;
        }
        for (let i = 0; i < data.indexCount; i++, at += data.indexBytes) {
            const value = data.indexBytes === 2 ? view.getUint16(at, true) : view.getUint32(at, true);
            if (value >= n)
                throw new Error('Mesh index out of range');
            indices.push(value);
        }
        return { positions, normals, colors, uvs, indices };
    }
    exports_1("decodeMesh", decodeMesh);
    return {
        setters: [],
        execute: function () {
            alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        }
    };
});
