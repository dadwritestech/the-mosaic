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

  value(): MarshalValue {
    const t = this.u8();
    switch (t) {
      case 0x30: return null;        // '0'
      case 0x54: return true;        // 'T'
      case 0x46: return false;       // 'F'
      case 0x69: return this.long(); // 'i'
      default: throw new Error('unhandled marshal tag 0x' + t.toString(16) + ' @' + (this.pos - 1));
    }
  }
}
