/* Silnik formuł arkusza Devicelist QD77 (IF, HEX2DEC, DEC2HEX, CONCATENATE, RIGHT) */
(function (root) {
  function IF(c, a, b) { return c ? a : b; }
  function HEX2DEC(h) { var n = parseInt(String(h).trim() || '0', 16); return isNaN(n) ? NaN : n; }
  function DEC2HEX(n, places) { var s = Math.round(Number(n)).toString(16).toUpperCase(); if (places) while (s.length < places) s = '0' + s; return s; }
  function CAT() { return Array.prototype.join.call(arguments, ''); }
  function RIGHT(s, n) { s = String(s); n = n === undefined ? 1 : n; return s.slice(Math.max(0, s.length - n)); }
  function num(v) { if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v); return v; }

  function Sheet(cells) {
    this.cells = cells; this.over = {}; this.memo = {}; this.fns = {};
  }
  Sheet.prototype.set = function (ref, v) { this.over[ref] = v; this.memo = {}; };
  Sheet.prototype.get = function (ref) {
    if (ref in this.memo) return this.memo[ref];
    var c = ref in this.over ? this.over[ref] : this.cells[ref];
    var v;
    if (c && typeof c === 'object' && 'f' in c) {
      var fn = this.fns[ref];
      if (!fn) {
        fn = this.fns[ref] = new Function('g', 'IF', 'HEX2DEC', 'DEC2HEX', 'CAT', 'RIGHT', 'return (' + c.f + ');');
      }
      var self = this;
      this.memo[ref] = '#CYCLE';
      try { v = fn(function (r) { return num(self.get(r)); }, IF, HEX2DEC, DEC2HEX, CAT, RIGHT); }
      catch (e) { v = '#ERR'; }
    } else v = c === undefined || c === null ? 0 : c;
    this.memo[ref] = v;
    return v;
  };
  root.QDSheet = Sheet;
})(typeof window !== 'undefined' ? window : globalThis);
