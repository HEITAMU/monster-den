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
        g.fillColor = rgba('#071616', 120);
        g.roundRect(-width / 2 + 2, -height / 2 - 8, width, height, radius);
        g.fill();
        g.fillColor = rgba(fill, opacity);
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = rgba(edge, 160);
        g.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
        g.stroke();
        g.lineWidth = 1;
        g.strokeColor = rgba(edge, 35);
        g.roundRect(-width / 2 + 7, -height / 2 + 7, width - 14, height - 14, Math.max(3, radius - 5));
        g.stroke();
        return n;
    }
    exports_1("panel", panel);
    function button(parent, text, x, y, width, height, action, accent = true) {
        const node = panel(parent, width, height, x, y, accent ? '#dba456' : '#294345', accent ? '#ffe2a1' : '#839b84', 20, 255);
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
    return {
        setters: [
            function (cc_1_1) {
                cc_1 = cc_1_1;
            }
        ],
        execute: function () {
            exports_1("PALETTE", PALETTE = { ink: '#172a2c', deep: '#0f2023', panel: '#263d3e', gold: '#e5b76c', cream: '#fff0c9', muted: '#aec0ad', mint: '#87d5ae', danger: '#e87962' });
        }
    };
});
