System.register(["cc"], function (exports_1, context_1) {
    "use strict";
    var cc_1, PALETTE;
    var __moduleName = context_1 && context_1.id;
    function rgba(hex, alpha = 255) {
        const h = hex.replace('#', '');
        return new cc_1.Color(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha);
    }
    exports_1("rgba", rgba);
    function uiNode(name, parent, width, height, x = 0, y = 0) {
        const n = new cc_1.Node(name);
        n.layer = cc_1.Layers.Enum.UI_2D;
        n.parent = parent;
        n.addComponent(cc_1.UITransform).setContentSize(width, height);
        n.setPosition(x, y, 0);
        return n;
    }
    exports_1("uiNode", uiNode);
    function label(parent, text, size, x, y, width = 650, height = size * 1.7, color = PALETTE.cream, bold = false) {
        const n = uiNode('Text', parent, width, height, x, y);
        const l = n.addComponent(cc_1.Label);
        l.string = text;
        l.fontSize = size;
        l.lineHeight = size * 1.35;
        l.isBold = bold;
        l.horizontalAlign = cc_1.Label.HorizontalAlign.CENTER;
        l.verticalAlign = cc_1.Label.VerticalAlign.CENTER;
        l.overflow = cc_1.Label.Overflow.SHRINK;
        l.color = rgba(color);
        l.fontFamily = 'Arial';
        const outline = n.addComponent(cc_1.LabelOutline);
        outline.color = rgba('#0a1b1c', 190);
        outline.width = 1.5;
        return l;
    }
    exports_1("label", label);
    function panel(parent, width, height, x, y, fill = PALETTE.panel, edge = PALETTE.gold, radius = 24, opacity = 246) {
        const n = uiNode('Panel', parent, width, height, x, y), g = n.addComponent(cc_1.Graphics);
        g.fillColor = rgba('#050e18', 165);
        g.roundRect(-width / 2 + 1, -height / 2 - 7, width, height, radius);
        g.fill();
        g.fillColor = rgba(fill, opacity);
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();
        g.fillColor = rgba('#ffffff', 8);
        g.roundRect(-width / 2 + 4, 2, width - 8, height / 2 - 6, Math.max(5, radius - 3));
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = rgba(edge, 175);
        g.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
        g.stroke();
        g.lineWidth = 1;
        g.strokeColor = rgba(edge, 45);
        g.roundRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, Math.max(3, radius - 5));
        g.stroke();
        if (width > 380 && height > 110) {
            for (const side of [-1, 1])
                for (const end of [-1, 1]) {
                    const xx = side * (width / 2 - 14), yy = end * (height / 2 - 14);
                    g.fillColor = rgba('#07131c', 150);
                    g.circle(xx, yy - 1, 3.7);
                    g.fill();
                    g.fillColor = rgba(edge, 180);
                    g.circle(xx, yy, 2.3);
                    g.fill();
                }
        }
        return n;
    }
    exports_1("panel", panel);
    function button(parent, text, x, y, width, height, action, accent = true) {
        const node = panel(parent, width, height, x, y, accent ? '#dba555' : '#294853', accent ? '#ffdfa3' : '#6f9a9d', Math.min(18, height * .28), 255);
        label(node, text, 28, 0, 1, width - 20, height, accent ? '#2a251d' : PALETTE.cream, true);
        node.on(cc_1.Node.EventType.TOUCH_START, (event) => { event.propagationStopped = true; cc_1.tween(node).stop(); node.setScale(.97, .97, 1); });
        node.on(cc_1.Node.EventType.TOUCH_END, (event) => { event.propagationStopped = true; cc_1.tween(node).to(.12, { scale: new cc_1.Vec3(1, 1, 1) }, { easing: 'backOut' }).start(); action(); });
        node.on(cc_1.Node.EventType.TOUCH_CANCEL, () => { node.setScale(1, 1, 1); });
        return node;
    }
    exports_1("button", button);
    function separator(parent, width, x, y) {
        const n = uiNode('Rule', parent, width, 2, x, y), g = n.addComponent(cc_1.Graphics);
        g.strokeColor = rgba(PALETTE.gold, 80);
        g.lineWidth = 1;
        g.moveTo(-width / 2, 0);
        g.lineTo(width / 2, 0);
        g.stroke();
        return n;
    }
    exports_1("separator", separator);
    /** Small engraved equipment badges, drawn in the same brass/leather UI palette. */
    function toolIcon(parent, tool, x, y, size = 64) {
        const n = uiNode('ToolBadge', parent, 64, 64, x, y);
        n.setScale(size / 64, size / 64, 1);
        const g = n.addComponent(cc_1.Graphics);
        g.fillColor = rgba('#0a1b24');
        g.circle(0, -2, 30);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = rgba('#d4a466', 210);
        g.circle(0, 0, 28);
        g.stroke();
        g.lineWidth = 1;
        g.strokeColor = rgba('#91c9bc', 55);
        g.circle(0, 0, 23);
        g.stroke();
        if (tool === 'heavy') {
            g.fillColor = rgba('#a66b38');
            g.roundRect(-16, -9, 32, 27, 8);
            g.fill();
            g.fillColor = rgba('#f1c078');
            g.roundRect(-14, -5, 27, 25, 7);
            g.fill();
            for (const xx of [-9, 0, 9]) {
                g.fillColor = rgba('#ffe0a0');
                g.roundRect(xx - 3, 8, 6, 10, 2);
                g.fill();
            }
            g.fillColor = rgba('#654632');
            g.roundRect(-13, -18, 26, 11, 3);
            g.fill();
            g.fillColor = rgba('#cf9b5a');
            g.roundRect(-8, -17, 16, 6, 2);
            g.fill();
            g.lineWidth = 2;
            g.strokeColor = rgba('#825b39');
            g.moveTo(-10, 1);
            g.lineTo(10, 1);
            g.stroke();
        }
        else if (tool === 'grip') {
            g.fillColor = rgba('#4b9a89');
            g.roundRect(-12, -12, 24, 22, 7);
            g.fill();
            for (const [xx, yy] of [[-13, 12], [-3, 17], [7, 16]]) {
                g.lineWidth = 7;
                g.strokeColor = rgba('#8bd8b7');
                g.moveTo(xx, -1);
                g.lineTo(xx, yy);
                g.stroke();
                g.fillColor = rgba('#e1b978');
                g.circle(xx, yy, 3);
                g.fill();
            }
            g.lineWidth = 7;
            g.strokeColor = rgba('#65bca0');
            g.moveTo(7, -7);
            g.lineTo(17, 3);
            g.stroke();
            g.fillColor = rgba('#c79555');
            g.roundRect(-11, -19, 22, 8, 3);
            g.fill();
        }
        else if (tool === 'return') {
            g.lineWidth = 7;
            g.strokeColor = rgba('#e1b573');
            g.arc(0, 0, 16, -.3, Math.PI * 1.48, false);
            g.stroke();
            g.fillColor = rgba('#ffe0a0');
            g.moveTo(0, -21);
            g.lineTo(2, -7);
            g.lineTo(-10, -15);
            g.close();
            g.fill();
            g.fillColor = rgba('#83cdb7');
            g.circle(0, 0, 7);
            g.fill();
            g.fillColor = rgba('#18373e');
            g.circle(0, 0, 3);
            g.fill();
        }
        else {
            g.lineWidth = 3;
            g.strokeColor = rgba(PALETTE.muted, 150);
            g.moveTo(-10, 0);
            g.lineTo(10, 0);
            g.stroke();
        }
        return n;
    }
    exports_1("toolIcon", toolIcon);
    function joystick(parent, x, y) {
        const root = uiNode('Joystick', parent, 244, 244, x, y), g = root.addComponent(cc_1.Graphics);
        const circle = (r, color, alpha = 255, yy = 0) => { g.fillColor = rgba(color, alpha); g.circle(0, yy, r); g.fill(); };
        circle(114, '#030d16', 160, -7);
        circle(111, '#966d40');
        circle(107, '#e2b779');
        circle(101, '#243d47');
        circle(96, '#0a1a25');
        circle(84, '#203944');
        g.lineWidth = 1.5;
        g.strokeColor = rgba('#9ed5cc', 35);
        g.circle(0, 0, 76);
        g.stroke();
        for (let i = 0; i < 24; i++) {
            const a = i * Math.PI / 12, major = i % 6 === 0;
            g.lineWidth = major ? 3 : 1.5;
            g.strokeColor = rgba(major ? '#d9b881' : '#7b9999', major ? 180 : 95);
            g.moveTo(Math.cos(a) * 88, Math.sin(a) * 88);
            g.lineTo(Math.cos(a) * (major ? 97 : 93), Math.sin(a) * (major ? 97 : 93));
            g.stroke();
        }
        for (const [xx, yy] of [[-72, -72], [72, -72], [-72, 72], [72, 72]]) {
            g.fillColor = rgba('#111e26');
            g.circle(xx, yy - 1, 4.5);
            g.fill();
            g.fillColor = rgba('#c69455');
            g.circle(xx, yy, 3);
            g.fill();
        }
        const glow = uiNode('StickGlow', root, 220, 220), gg = glow.addComponent(cc_1.Graphics);
        gg.lineWidth = 3;
        gg.strokeColor = rgba(PALETTE.mint, 180);
        gg.circle(0, 0, 102);
        gg.stroke();
        glow.active = false;
        const meter = uiNode('StickPower', root, 220, 220).addComponent(cc_1.Graphics);
        const thumb = uiNode('StickThumb', root, 84, 84), t = thumb.addComponent(cc_1.Graphics);
        t.fillColor = rgba('#020b13', 160);
        t.circle(0, -6, 42);
        t.fill();
        t.fillColor = rgba('#bf884b');
        t.circle(0, 0, 41);
        t.fill();
        t.fillColor = rgba('#ffe0a3');
        t.circle(0, 2, 37);
        t.fill();
        t.fillColor = rgba('#38626b');
        t.circle(0, 1, 32);
        t.fill();
        t.fillColor = rgba('#447985');
        t.circle(0, 6, 28);
        t.fill();
        t.lineWidth = 2;
        t.strokeColor = rgba('#91c9c5', 120);
        t.arc(0, 2, 26, .3, Math.PI - .3, false);
        t.stroke();
        t.fillColor = rgba('#e8d2a0');
        t.moveTo(0, 20);
        t.lineTo(6, 9);
        t.lineTo(-6, 9);
        t.close();
        t.fill();
        for (const yy of [-9, -3, 3]) {
            t.lineWidth = 2;
            t.strokeColor = rgba('#123c49', 165);
            t.moveTo(-10, yy);
            t.lineTo(10, yy);
            t.stroke();
        }
        const caption = label(root, '推动瞄准', 21, 0, -135, 255, 34, PALETTE.muted, true);
        return { root, thumb, meter, caption, glow };
    }
    exports_1("joystick", joystick);
    return {
        setters: [
            function (cc_1_1) {
                cc_1 = cc_1_1;
            }
        ],
        execute: function () {
            exports_1("PALETTE", PALETTE = { ink: '#152b35', deep: '#10212b', panel: '#233d47', gold: '#efbd72', cream: '#fff0cf', muted: '#a7c0bc', mint: '#81e5d2', danger: '#f08369' });
        }
    };
});
