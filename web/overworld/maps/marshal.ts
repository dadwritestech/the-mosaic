export type MarshalValue =
  | null | boolean | number | string
  | { __symbol: string }
  | MarshalValue[]
  | { __class: string; ivars: Record<string, MarshalValue> }
  | { __userClass: string; data: Uint8Array }
  | { [key: string]: MarshalValue };

export function readMarshal(buf: Uint8Array): MarshalValue {
  const r = new Reader(buf);
  if (r.u8() !== 0x04 || r.u8() !== 0x08) throw new Error('not Marshal 4.8');
  return r.value();
}

class Reader {
  pos = 0;
  symbols: string[] = [];
  constructor(public b: Uint8Array) {}
  u8(): number { return this.b[this.pos++]; }

  /** Ruby Marshal compact integer ("long"). */
  long(): number {
    const c = (this.u8() << 24) >> 24; // sign-extend first byte
    if (c === 0) return 0;
    if (c > 0) {
      if (c > 4) return c - 5;
      let n = 0;
      for (let i = 0; i < c; i++) n |= this.u8() << (8 * i);
      return n;
    }
    if (c < -4) return c + 5;
    let n = -1;
    for (let i = 0; i < -c; i++) { n &= ~(0xff << (8 * i)); n |= this.u8() << (8 * i); }
    return n;
  }

  bytes(n: number): Uint8Array { const s = this.b.subarray(this.pos, this.pos + n); this.pos += n; return s; }
  rawString(): string { const n = this.long(); return new TextDecoder('latin1').decode(this.bytes(n)); }

  symbol(): { __symbol: string } { const s = this.rawString(); this.symbols.push(s); return { __symbol: s }; }
  symlink(): { __symbol: string } { return { __symbol: this.symbols[this.long()] }; }

  value(): MarshalValue {
    const t = this.u8();
    switch (t) {
      case 0x30: return null;        // '0'
      case 0x54: return true;        // 'T'
      case 0x46: return false;       // 'F'
      case 0x69: return this.long(); // 'i'
      case 0x3a: return this.symbol();   // ':'
      case 0x3b: return this.symlink();  // ';'
      case 0x22: return this.rawString();// '"' bare string
      case 0x49: { const s = this.value(); this.skipIvars(); return s; } // 'I' ivar-wrapped
      case 0x5b: { const n = this.long(); const a: MarshalValue[] = []; for (let i = 0; i < n; i++) a.push(this.value()); return a; } // '['
      case 0x7b: { const n = this.long(); const h: Record<string, MarshalValue> = {}; for (let i = 0; i < n; i++) { const k = this.value(); h[this.keyStr(k)] = this.value(); } return h; } // '{'
      case 0x6f: return this.object();   // 'o'
      case 0x75: return this.userdef();  // 'u'
      default: throw new Error('unhandled marshal tag 0x' + t.toString(16) + ' @' + (this.pos - 1));
    }
  }

  skipIvars(): void { const n = this.long(); for (let i = 0; i < n; i++) { this.value(); this.value(); } }

  keyStr(k: MarshalValue): string {
    if (typeof k === 'number') return String(k);
    if (k && typeof k === 'object' && '__symbol' in k) return (k as { __symbol: string }).__symbol;
    return String(k);
  }

  object(): MarshalValue {
    const cls = this.symOrLink();
    const n = this.long();
    const ivars: Record<string, MarshalValue> = {};
    for (let i = 0; i < n; i++) { const key = this.symOrLink(); ivars[key] = this.value(); }
    return { __class: cls, ivars };
  }

  userdef(): MarshalValue {
    const cls = this.symOrLink();
    const len = this.long();
    return { __userClass: cls, data: this.bytes(len).slice() };
  }

  symOrLink(): string {
    const t = this.u8();
    if (t === 0x3a) return this.symbol().__symbol;
    if (t === 0x3b) return this.symbols[this.long()];
    throw new Error('expected symbol, got 0x' + t.toString(16));
  }
}
