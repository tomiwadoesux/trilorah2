import type { CSSProperties } from "react";
import "./libraryEmptyArt.css";

/** Approved open Bible, curved pages, and suspended cross bookmark. */
export function BibleBookmarkArt() {
  return (
    <svg className="tri-library-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
      <g transform="translate(0 -20)">
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M126 123.75L197.25 164.38 268.5 195 174 242.25 102.75 211.62 31.5 171Z" fill="#121212" stroke="#ededed" strokeOpacity="0.45" strokeWidth="0.8"/>
          <g transform="translate(0 7)">
          <path d="M126 115.5C144.75 106.88 176.25 122.62 193.5 154.25L106.5 197.75C89.25 166.12 57.75 150.38 39 159Z" fill="#171717" stroke="#ededed" strokeOpacity="0.5" strokeWidth="0.8"/>
          </g>
          <g transform="translate(0 5)">
          <path d="M39 159C57.75 150.38 89.25 166.12 106.5 197.75" fill="none" stroke="#ededed" strokeOpacity="0.35" strokeWidth="0.55"/>
          </g>
          <g transform="translate(0 3)">
          <path d="M39 159C57.75 150.38 89.25 166.12 106.5 197.75" fill="none" stroke="#ededed" strokeOpacity="0.35" strokeWidth="0.55"/>
          </g>
          <g className="tri-library-art__motion" style={{ "--library-y": "-5px" } as CSSProperties}>
          <path d="M126 115.5C144.75 106.88 176.25 122.62 193.5 154.25L106.5 197.75C89.25 166.12 57.75 150.38 39 159Z" fill="#1c1c1c" stroke="#ededed" strokeOpacity="0.78" strokeWidth="0.8"/>
          <path d="M126.75 116.12L56.25 151.38" fill="none" stroke="#ededed" strokeOpacity="0.16" strokeWidth="0.6"/>
          <path d="M126 115.5C144.75 106.88 176.25 122.62 193.5 154.25" fill="none" stroke="#ededed" strokeOpacity="0.8" strokeWidth="0.8"/>
          </g>
          <g transform="translate(0 7)">
          <path d="M193.5 154.25C210.75 139.88 242.25 155.62 261 183L174 226.5C155.25 199.12 123.75 183.38 106.5 197.75Z" fill="#171717" stroke="#ededed" strokeOpacity="0.5" strokeWidth="0.8"/>
          </g>
          <g transform="translate(0 5)">
          <path d="M106.5 197.75C123.75 183.38 155.25 199.12 174 226.5" fill="none" stroke="#ededed" strokeOpacity="0.35" strokeWidth="0.55"/>
          </g>
          <g transform="translate(0 3)">
          <path d="M106.5 197.75C123.75 183.38 155.25 199.12 174 226.5" fill="none" stroke="#ededed" strokeOpacity="0.35" strokeWidth="0.55"/>
          </g>
          <g className="tri-library-art__motion" style={{ "--library-y": "-7px" } as CSSProperties}>
          <path d="M193.5 154.25C210.75 139.88 242.25 155.62 261 183L174 226.5C155.25 199.12 123.75 183.38 106.5 197.75Z" fill="#1c1c1c" stroke="#ededed" strokeOpacity="0.78" strokeWidth="0.8"/>
          <path d="M243.75 174.62L173.25 209.88" fill="none" stroke="#ededed" strokeOpacity="0.16" strokeWidth="0.6"/>
          <path d="M193.5 154.25C210.75 139.88 242.25 155.62 261 183" fill="none" stroke="#ededed" strokeOpacity="0.8" strokeWidth="0.8"/>
          </g>
          <path d="M193.5 154.25L106.5 197.75" fill="none" stroke="#ededed" strokeOpacity="0.37" strokeWidth="0.7"/>
          <g className="tri-library-art__motion" style={{ "--library-y": "-13px" } as CSSProperties}>
          <path d="M167.25 103.12L165 104.25 165 152.25 167.25 151.12Z" fill="#141414" stroke="#ededed" strokeOpacity="0.47" strokeWidth="0.7"/>
          <path d="M148.5 96L165 104.25 165 152.25 156.75 140.12 148.5 144Z" fill="#242424" stroke="#ededed" strokeOpacity="0.87" strokeWidth="0.8"/>
          <path d="M152.25 98.88L161.25 103.38" fill="none" stroke="#ededed" strokeOpacity="0.35" strokeWidth="0.5"/>
          <path d="M156.75 110.12L156.75 127.12" fill="none" stroke="#ededed" strokeOpacity="0.8" strokeWidth="0.9"/>
          <path d="M152.62 114.06L160.88 118.19" fill="none" stroke="#ededed" strokeOpacity="0.8" strokeWidth="0.9"/>
          </g>
          </g>

      </g>
    </svg>
  );
}
