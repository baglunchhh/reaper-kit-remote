/*
spec-export.jsx

Run via File > Scripts > Other Script... in Illustrator.

Walks every distinctly-named item on the first artboard — layers, groups,
paths, compound paths, and text frames alike — and records its geometric
bounds as a percentage of the artboard, its fill color, its stroke color
and width, and (for text frames) its text/font/size. Writes the result as
JSON next to the .ai file, keyed by each item's own name.

Illustrator auto-generated default names (<Path>, <Group>, "Layer 1", etc.)
are skipped so the output isn't flooded with unnamed sub-elements; only
things you've deliberately renamed in the Layers panel get an entry.

Notes on units:
- Illustrator's scripting DOM always reports geometricBounds in points,
  regardless of the ruler unit shown in the UI. Since Illustrator defines
  1 pixel == 1 point, this is already pixel-equivalent as long as the
  document's ruler unit is set to Pixels for on-screen sanity checks.
- Bounds are computed relative to the artboard's own artboardRect, so
  the current ruler origin does not affect the result (both the artboard
  and the items shift together).
- geometricBounds format is [left, top, right, bottom] with Illustrator's
  y-up convention (top is the larger/less-negative value, bottom is the
  smaller/more-negative value). Percent-top is computed as the distance
  down from the artboard's top edge, flipping that convention into a
  normal CSS-style top percentage.
*/

(function () {

  if (app.documents.length === 0) {
    alert("Open the Illustrator document first, then run this script.");
    return;
  }

  var doc = app.activeDocument;
  var ab = doc.artboards[0];
  var abRect = ab.artboardRect; // [left, top, right, bottom]
  var abLeft = abRect[0], abTop = abRect[1], abRight = abRect[2], abBottom = abRect[3];
  var abWidth = abRight - abLeft;
  var abHeight = abTop - abBottom;

  if (abWidth <= 0 || abHeight <= 0) {
    alert("Could not read a valid artboard size.");
    return;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function overlapsArtboard(b) {
    // b = [left, top, right, bottom]
    return !(b[2] < abLeft || b[0] > abRight || b[3] > abTop || b[1] < abBottom);
  }

  function boundsToPercent(b) {
    return {
      left: round2((b[0] - abLeft) / abWidth * 100),
      top: round2((abTop - b[1]) / abHeight * 100),
      width: round2((b[2] - b[0]) / abWidth * 100),
      height: round2((b[1] - b[3]) / abHeight * 100)
    };
  }

  function isUsable(item) {
    try {
      if (item.guides) return false;
      if (item.hidden) return false;
    } catch (e) {}
    return true;
  }

  // Illustrator's default auto-generated names: "<Path>", "<Group>",
  // "<Compound Path>", "<Text>", etc, and "Layer 1", "Layer 2", ...
  function isDefaultName(name) {
    if (!name) return true;
    if (/^<.*>$/.test(name)) return true;
    if (/^Layer \d+$/.test(name)) return true;
    return false;
  }

  function toHex2(n) {
    n = Math.max(0, Math.min(255, Math.round(n)));
    var s = n.toString(16);
    return s.length < 2 ? "0" + s : s;
  }

  function colorToHex(color) {
    if (!color) return null;
    switch (color.typename) {
      case "RGBColor":
        return "#" + toHex2(color.red) + toHex2(color.green) + toHex2(color.blue);
      case "CMYKColor":
        var r = 255 * (1 - color.cyan / 100) * (1 - color.black / 100);
        var g = 255 * (1 - color.magenta / 100) * (1 - color.black / 100);
        var bl = 255 * (1 - color.yellow / 100) * (1 - color.black / 100);
        return "#" + toHex2(r) + toHex2(g) + toHex2(bl);
      case "GrayColor":
        var v = 255 * (1 - color.gray / 100);
        return "#" + toHex2(v) + toHex2(v) + toHex2(v);
      default:
        return null; // gradient, spot color, pattern, none, etc. - not parsed
    }
  }

  // Collects an item itself plus all nested descendants (for GroupItems),
  // used to find a representative fill/stroke color for a named entry.
  function collectForStyle(it, out) {
    out.push(it);
    if (it.typename === "GroupItem") {
      var kids = it.pageItems;
      for (var i = 0; i < kids.length; i++) collectForStyle(kids[i], out);
    }
  }

  function findFillHex(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isUsable(it)) continue;
      if (it.typename === "PathItem" && it.filled && it.fillColor) {
        var hex = colorToHex(it.fillColor);
        if (hex) return hex;
      }
      if (it.typename === "CompoundPathItem" && it.pathItems.length) {
        var p = it.pathItems[0];
        if (p.filled && p.fillColor) {
          var hex2 = colorToHex(p.fillColor);
          if (hex2) return hex2;
        }
      }
    }
    return null;
  }

  function findStrokeInfo(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isUsable(it)) continue;
      if (it.typename === "PathItem" && it.stroked && it.strokeColor) {
        var hex = colorToHex(it.strokeColor);
        if (hex) return { color: hex, width: it.strokeWidth };
      }
      if (it.typename === "CompoundPathItem" && it.pathItems.length) {
        var p = it.pathItems[0];
        if (p.stroked && p.strokeColor) {
          var hex2 = colorToHex(p.strokeColor);
          if (hex2) return { color: hex2, width: p.strokeWidth };
        }
      }
    }
    return null;
  }

  function getTextInfo(tf) {
    var info = { text: null, fontFamily: null, fontSize: null };
    try { info.text = tf.contents; } catch (e) {}
    try {
      var attrs = tf.textRange.characterAttributes;
      info.fontFamily = attrs.textFont ? attrs.textFont.family : null;
      info.fontSize = attrs.size;
    } catch (e) {}
    return info;
  }

  // Bounds for a Layer (which has no geometricBounds of its own): union
  // over everything it directly contains, including nested groups.
  function collectAllItems(container, out) {
    var items = container.pageItems;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      out.push(it);
      if (it.typename === "GroupItem") collectAllItems(it, out);
    }
    if (container.typename === "Layer" && container.layers) {
      for (var j = 0; j < container.layers.length; j++) collectAllItems(container.layers[j], out);
    }
  }

  function boundsOfItems(items) {
    var b = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isUsable(it)) continue;
      var gb;
      try { gb = it.geometricBounds; } catch (e) { continue; }
      if (!gb) continue;
      if (!b) {
        b = gb.slice();
      } else {
        if (gb[0] < b[0]) b[0] = gb[0];
        if (gb[1] > b[1]) b[1] = gb[1];
        if (gb[2] > b[2]) b[2] = gb[2];
        if (gb[3] < b[3]) b[3] = gb[3];
      }
    }
    return b;
  }

  var results = {};
  var firstRaw = null; // for the sanity-check printout

  function uniqueKey(name) {
    var key = name;
    var n = 1;
    while (results.hasOwnProperty(key)) {
      n++;
      key = name + "_" + n;
    }
    return key;
  }

  function finalizeEntry(key, gb, styleItems, textFrame) {
    if (!overlapsArtboard(gb)) return;

    var pct = boundsToPercent(gb);
    var entry = { left: pct.left, top: pct.top, width: pct.width, height: pct.height };

    if (textFrame) {
      var info = getTextInfo(textFrame);
      entry.text = info.text;
      entry.fontFamily = info.fontFamily;
      entry.fontSize = info.fontSize;
    }

    if (styleItems) {
      var fillHex = findFillHex(styleItems);
      if (fillHex) entry.fill = fillHex;

      var strokeInfo = findStrokeInfo(styleItems);
      if (strokeInfo) {
        entry.stroke = strokeInfo.color;
        entry.strokeWidth = strokeInfo.width;
      }
    }

    results[key] = entry;

    if (!firstRaw) {
      firstRaw = { key: key, rawBoundsPt: gb, entry: entry };
    }
  }

  // Any named path, compound path, group, or text frame gets its own entry.
  function addEntryForItem(it) {
    var gb;
    try { gb = it.geometricBounds; } catch (e) { return; }
    if (!gb) return;

    var key = uniqueKey(it.name);

    if (it.typename === "TextFrame") {
      finalizeEntry(key, gb, null, it);
    } else {
      var styleItems = [];
      collectForStyle(it, styleItems);
      finalizeEntry(key, gb, styleItems, null);
    }
  }

  // A named sub-layer (rare in this file, but handled for robustness):
  // bounds/style come from the union of everything it contains.
  function addEntryForLayer(layer) {
    var items = [];
    collectAllItems(layer, items);
    var gb = boundsOfItems(items);
    if (!gb) return;
    var key = uniqueKey(layer.name);
    finalizeEntry(key, gb, items, null);
  }

  function walkItems(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isUsable(it)) continue;
      if (!isDefaultName(it.name)) addEntryForItem(it);
      if (it.typename === "GroupItem") walkItems(it.pageItems);
    }
  }

  function walkLayer(layer) {
    if (!layer.visible) return;
    if (!isDefaultName(layer.name)) addEntryForLayer(layer);
    walkItems(layer.pageItems);
    for (var j = 0; j < layer.layers.length; j++) walkLayer(layer.layers[j]);
  }

  for (var i = 0; i < doc.layers.length; i++) {
    walkLayer(doc.layers[i]);
  }

  // --- minimal JSON serializer (no dependency on a global JSON object) ---

  function jsonEscapeString(s) {
    s = String(s);
    s = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
         .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    return '"' + s + '"';
  }

  function jsonStringify(obj, indent) {
    indent = indent || "";
    var nextIndent = indent + "  ";
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "number") return isFinite(obj) ? String(obj) : "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "string") return jsonEscapeString(obj);
    if (obj instanceof Array) {
      if (!obj.length) return "[]";
      var items = [];
      for (var i = 0; i < obj.length; i++) items.push(nextIndent + jsonStringify(obj[i], nextIndent));
      return "[\n" + items.join(",\n") + "\n" + indent + "]";
    }
    var keys = [];
    for (var k in obj) if (obj.hasOwnProperty(k)) keys.push(k);
    if (!keys.length) return "{}";
    var parts = [];
    for (var j = 0; j < keys.length; j++) {
      parts.push(nextIndent + jsonEscapeString(keys[j]) + ": " + jsonStringify(obj[keys[j]], nextIndent));
    }
    return "{\n" + parts.join(",\n") + "\n" + indent + "}";
  }

  // --- write JSON next to the .ai document ---

  var docFile = doc.fullName;
  var baseName = docFile.name.replace(/\.[^.]+$/, "");
  var outFile = new File(docFile.path + "/" + baseName + "-spec.json");
  outFile.encoding = "UTF-8";
  outFile.open("w");
  outFile.write(jsonStringify(results));
  outFile.close();

  // --- sanity-check printout ---

  var msg = "Wrote " + outFile.fsName + "\n\n";
  if (firstRaw) {
    msg += "Sample entry: \"" + firstRaw.key + "\"\n" +
           "Raw geometricBounds (pt): " + firstRaw.rawBoundsPt.join(", ") + "\n" +
           "Computed entry:\n" + jsonStringify(firstRaw.entry);
  } else {
    msg += "No named items with content on the first artboard were found.";
  }

  $.writeln(msg);
  alert(msg);

})();
