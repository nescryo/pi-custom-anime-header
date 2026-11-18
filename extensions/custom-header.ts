/**
 * Custom Header Extension
 *
 * Replaces Pi's startup header with customizable terminal portraits on the left
 * (anti-aliased half-block chibi conversions from Braille art, raw Braille, or
 * the 42x34 Subaru half-block portrait) while preserving version info,
 * keybinding hints, and `ctrl+o` expand/collapse support on the right.
 */

import {
	type ExtensionAPI,
	type ExtensionContext,
	keyHint,
	keyText,
	rawKeyHint,
	type Theme,
	VERSION,
} from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	backgroundAnsi,
	type Component,
	foregroundAnsi,
	rgbColor,
	type TerminalColorMode,
	type TUI,
	truncateToWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

const RESET = "\x1b[0m";
const DEFAULT_BG = "\x1b[49m";

interface RgbPixel {
	key: string;
	r: number;
	g: number;
	b: number;
}

type PixelCell = RgbPixel | null;

type HeaderPreset = "chibi" | "chibi45" | "chibi68" | "line" | "line45" | "pi" | "braille" | "subaru";
type TextPosition = "below" | "side";

const BRAILLE_DOT_BITS: readonly (readonly [number, number])[] = [
	[0x01, 0x08],
	[0x02, 0x10],
	[0x04, 0x20],
	[0x40, 0x80],
];

// 34x15 Unicode Braille source (68x60 binary dot matrix).
const CHIBI_BRAILLE_ROWS: readonly string[] = [
	"⣿⣿⣿⣷⡉⠻⣿⣿⣿⣿⣿⣿⡿⠿⠿⠿⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣷⣤⣠⠭⠭⣭⣤⡬⠍⠉⠀⠀⠒⠒⠒⠦⢬⣍⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⡿⢋⠔⣫⣴⣏⣀⣤⣠⣴⣾⣷⣦⡐⣤⠀⠈⠒⢶⣍⡙⠻⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⠋⢀⣴⣾⣿⣿⠛⣿⣿⣿⣿⣿⣿⣿⡇⢰⣶⡄⠀⠈⢻⣿⣦⡈⢿⣿⣿⣿⣿",
	"⣿⣿⣿⡿⢁⣴⣿⣿⣿⣿⡏⢸⢳⣿⣿⣿⣿⣿⣿⣃⣾⣿⣿⣆⠀⠀⣿⣿⣷⡀⢻⣿⣿⣿",
	"⣿⣿⡟⢡⣿⣿⣿⣿⢋⣼⡇⢠⢸⣿⣿⣿⡏⢻⣿⣿⣿⣿⣿⣿⡀⡀⢸⣿⣿⣿⡄⢿⣿⣿",
	"⣿⣿⢃⣿⣿⣿⣿⢃⣾⠋⠀⠘⣼⣿⣿⣿⡇⢘⣿⣿⣿⣿⣿⣿⢣⡇⠰⣿⣿⣿⣷⠸⣿⣿",
	"⣿⡿⣼⣿⣿⣿⡟⡼⠃⠀⠀⠀⢻⣿⣿⣿⣧⠈⣿⠙⣿⣿⣿⣿⣿⡇⣸⢃⣿⣿⣿⢀⢿⣿",
	"⣿⡇⣿⣿⣿⣿⣆⠃⠀⠀⠀⠀⠀⠛⣿⣿⣿⡄⠘⡇⢹⣿⣿⣿⡟⠠⢡⣾⣿⣿⣿⣼⡘⣿",
	"⣿⠇⣿⣿⣿⣿⣏⠀⠀⠀⠀⢀⣀⣀⠙⢻⣿⣷⠀⠀⣹⣿⣿⠟⢀⣴⣿⣿⣿⣿⣿⣿⣧⢻",
	"⡿⢸⡟⢿⣿⣿⡇⠀⣠⣴⣿⣿⣿⣿⣿⣦⣍⣛⠇⣀⡸⣿⣷⣾⣿⣿⣿⣿⣿⣿⣿⠙⣿⡸",
	"⡇⣿⢡⢸⣿⣿⣷⠀⠻⣿⣿⣟⠿⠿⢿⣿⣿⣿⣷⣍⠃⣼⣿⣿⣿⣿⣿⣿⣿⡟⡿⢠⢿⢣",
	"⣧⢹⢸⡌⢿⣿⣿⢧⣀⠙⣿⣿⣿⣿⣿⣻⣿⣿⣿⠃⢸⡿⠋⣼⣿⣿⣿⣿⡟⠐⣡⡏⠞⣼",
	"⣿⣧⣜⣻⣤⡙⢿⡀⡌⢳⣄⣭⣩⣍⠉⣩⣴⡾⠃⠘⠀⠰⣾⣿⠟⠻⡿⠏⣤⣾⣏⣠⣾⣿",
	"⣿⣿⣿⣿⣿⣿⣶⣧⣜⣦⡙⠿⠿⣿⡆⠈⠁⠀⠀⠀⠀⠀⠩⣴⣂⣪⣵⣿⣿⣿⣿⣿⣿⣿",
];

// 42x34 RGB pixel rows (6 hex chars per pixel, 42 pixels per row).
const SUBARU_PIXEL_ROWS: readonly string[] = [
	"fffffffffffffefefeffffffe8e7ef908fb9736b9e7369986e65946c63956a61945b528a4e43829476a4c5aac0b197b3c9acc1c4aabd9578a0a184a987699985679a6d538b9078a1785f926d568c65508a58498862578d6e64937066957066956f65956e64986c609a7871b7adb3fcb8c1ffb2baffb0baffb0b9ffaeb7ff",
	"fffffffffffffffffffdfdfeffffffcbd6e86d689e6c63966e66957268966c63947366978b6fa0dbb5c9fff6e9ffefe5ffede3fff0e5ffece4fce3def6dbd9f0d6d6f5dcd9ffece4fbe2dcf6dddbeed8d7c8a4bf7560966a61926f65956a60956c62957067967167996c61a17871bd9d9eeab0b7fcb1baffafb8ffacb6ff",
	"fffffffffffffdfdfefefefef4f3f78c84b070669a7067976f6595675d8f584c869b85aab58cb2f6d7dbfdeae0fde5defee7e0fde6dffee7e1ffeadfffebe0ffece3ffebe3fee7e1ffeae0ffeae1fff0e3ffe2e0a47eab796a977367957066956f65956d63957267987268a88785d29193e0acb6fbb0bbffaeb7ffa9b4ff",
	"ffffffffffffffffffffffffaca5c672669b726a997167967166946d5d8e947ca2e0c3ceb78db2ffe8e1ffe8e0ffe8dfffe8e0ffe8e0ffe8e1ffe8dffee7e1fee7e2fee7e2ffe8e1ffe8e0ffe7dffde7defee8e3c297b8af93b37b6c9a7166957066956e65956e64986e63a0a0a3edbdc7ffb1bbffafb8ffadb6ffa3b1ff",
	"fffffff1f0f4e0dee8bcb6cf796d9f746a9a736996726796766794826998ebd0d6edd0d5c599b9ffede3fee7ddffe8deffe8dfffe8e1ffe8dfffe8dfffe8e2ffe8e2ffe8e2ffe8e2ffe8e1ffe8e1ffe8dfffeae2d4a8c3cbacc27463967265957166957066956e65976b609c8584cdb4befeafb8feaeb7ffa6b2ff9cabff",
	"fefefef8f7f9b4afcb796ea2776c9b736997726896756a986c5a8f8d72a1fff1e5f1d8d9dab3c6ffeae3fee7e0fee8defee7dfffe8e0ffe8dfffe8dfffe8e2ffe8e2ffe8e2ffe8e1ffe8e0ffe8e0ffe8deffeae1d7aec6eccdd39079a25a4b86786a997066957066976c629c7b74bbafb7ffafb8ffa9b2ffa0acff9aa7ff",
	"fefeffe9e8efa7a0c1776da0766c9a7369966f65946e6392564181bc9fb9fef3e6fbe4dcedced3ffe7e0ffeae0ffebe2ffece3ffeae1ffe8deffe8dfffe8e2ffe8e1ffe9e2ffeae1ffe9e0ffe8deffe8defee6dfdeb9c9f7dcdcdbc2cc54407f65598c7167967066956d63997068aba2a9f6acb5ffa2acfea0aaffa0abff",
	"fffffffbfbfcd9d6e3b3aec97b71a26a6295746898685b8d7f6695f9e3dffee9e0ffe9dffae2ddfce4dff9e1dff2d8daefd4d7f7dedcffe9e2ffe8e1ffe8deffe8dffde6dffae2defde5deffe9e0ffebe3ffe6dfe9ccd3f9e1ddffebe18065985c4e866c61917167956f65986b61a18886d6a8b2ffa1aafea4adffa7b0ff",
	"fffffffefeffffffffe4e1ec786ea074699a706393503f7ea588aefff3e6fde6ddfce5dffae2ddf9e2dcf4dbdaefd4d5eed3d5f4d9dbfbe3ddffe9e2ffe8e0ffe9e2f8e0dde9ced4e7cdd3ead0d6f1d8dafae4defbe3dffde6dffff0e6a187aa5a4984776a986c63956e64996c609c665faf898eeaa7b0ffaab3feaab3ff",
	"fefefffefefeededf38881b2655a945a4e8851407f543c7dcfb2c3feefe6fde7e1fee8e2fee8e0fde8deffeae0ffede2ffede3ffeae2fae1ddffe8e2ffe8e1ffe8e0ffe9e2ffebe2ffe9e1fce5dff8e0dcf6dddcf9e1ddfde6defff2e7c7aac14e3b7c6b5e90756a996760987c7ccb7f82da9499f2adb5ffacb5ffaab4ff",
	"fefefeffffffe5e3ee7167a05c518e9382a7decad19574a1f6ddddffeee3ffece1ffeee2ffefe3fff4e6ffede3fbe1dffee6e0ffe8dfffe9e0ffe8e0ffe8deffe8e0ffe8dfffeae0fee8e1ffe8e1ffeee4ffefe4ffeae2fde7e1fff0e6d4b7c6553e7e463879675c9172669a898adcafb9ffb0b8ffacb5ffacb5ffa9b2ff",
	"fdfdfeffffffdad6e4c8c4d8b5aac6e2bfd0eed1d8f1d6d9f9e2dcf5e4e5d5c9e4c4b7d9b09dcca693c2c7afcbeccdd6f5dadaffeae0ffe7e1ffe8e0ffe8e0ffe8dfffe9e2f5d8daf9dbdafee5e0f4dedef3dadcfde6e0ffebe1ffede3f8e0dd876797a390ae61528b5a4f8e675da47775ca9fa7f6adb6ffabb3ffa7b0ff",
	"fffffffefefff5f4f7d4d2e2a697bbd5a7cac894bcf9dfdfffede3f5e5e8eff2fdf0f2fdc2c2e67f6fb7a399d08e78b6f7e1deffebe3fee7e0ffe8e1ffe8e1ffe8e2ffeae2f4dbdaa98dbd8370b4a598cbaca1d3bcb1dcd2c6e3f7e5e3f9e2dde9cdd3ffe7e4bda3be4f44876d66b2969af0a8affcabb2ffa8b0ffa4aeff",
	"fefefffefefff8f8fa8b85b4a18eb8ddaecdc38fbbe6c3d1fff2e5f7e3e2f8f3f4fffffff1edf3c198bbe4d6e5d3d1ececd4dbffefe4fee7e0ffe9e1ffe8dffee7e0fff0e4dec7d5a9a2d7967eb9b79dc7f2f5fcf7f9fff0f0fbf9e8e6ffefe3f8dddec892bdddb4d06557945a4f9a8583d7a4acfca8affea4aeffa2abff",
	"fffffffffffffffffffdfefeeee5efd5a8cdc993bfe8c2d1fff0e4feebe4fcece8fef7f4fef8f5f6e1dcf3e4e7fffff9ffede4ffe9e2ffe8e0ffe8dfffe8dfffe9dfffeae1f9e9e6fffffff0dbdfc8a3bef3f1f7fffffff7ebecfde9e3fff0e5d9b2cbc68fbddcb3d1877ec25551b07c7cd5a1a8fba4acffa2abffa0aaff",
	"fffffffffffffeffffeff9ffd3dcfbd3acd5cc95c4f3d4daffede3feeae2ffede3ffede4ffede5ffefe7ffeee6fee9e2ffebe2ffe8e1ffe8e0ffe8e1ffe8dfffe9e1ffeae3ffede3fdede6fff1e9fff3edfff5f0fef3eefceae5ffede3fde7e2d6a5c6c793c1e2bad7bcbaffa6aeffabb3ffa5adffa2abffa0a9ff9ba6ff",
	"fffffffdffffe8f5ffc2d5ffaab7ffc7b3e7d19ac8f1d1dbffebe2ffe8e2ffeae2ffebe3ffeae2ffeae2ffeae2ffeae2ffe9e2ffe8deffe8deffe9dfffe8deffe8dfffe8e1ffe9e2ffebe2ffebe2ffebe3ffece4ffece4ffede3ffeae1fee9e1ddaeccca94c6d8bbe1a9adfda5acfea2a9fea1a9ff9fa8ff9ca5ff98a4ff",
	"fbffffe4f1ffb9ceffa6b6ffacb4ffbcb9fce1bddcd5a4cbf2d5dbffeae2ffe7deffe8e0ffe8e2ffe8e1ffe8e2ffe8e2ffe8e0ffe8e0ffe8e1ffe8e1ffe8e1ffe8dfffe8deffe8dfffe9e1ffe9e1ffe9e1ffeae1ffeae1ffeae1ffe7e1ffede3daaccfd1a2cebbb6f6a0a8ffa2a8ff9fa7ff9da6ff9ba5ff98a4ff94a2ff",
	"d9ebffb0c6ffa3b1ffabb2ffb0b6ffb0b2ffddccf3f7dbdfe9cbd8ffe9e2ffe8deffe8dfffe8e1ffe8e1ffe8e0ffe8deffe8dfffe8deffe8dfffe7e1ffe8dfffe8dfffe8deffe8deffe8dfffe8dfffe8deffe8deffe7deffe9e0fce4dfe2bcd4dba7ced3bdeda0a7ff9fa6ff9da5ff9ba5ff9ba5ff99a4ff94a0ff8d9dff",
	"a4bcff9dacffa5afffaab0ffadb2ffb1b5ffbab2fcefd9edfbe1e4fde5e2ffe9e1ffe8e1ffe8dfffe8e2ffe8e1ffe8e0ffe8e2ffe8e0ffe8e2ffebe2ffe8dfffe8dfffe7deffe7dfffe8e2ffe8e2ffe7deffe7deffe7deffebe2ecd1daeacad7ead0e8a9a6fe9da5ff9ca5ff9aa4ff99a3ff98a1ff949fff8e9cff889aff",
	"96a6ffa1aaffa4adffa6aeffa9b0ffabb1ffb0b0ffb9b3fdaa93dcefd4dbffece5fee7e0ffe8e0ffe8e1ffe9dfffe8e0ffe8e0ffe9e3fde5e1f3d6d8ffeadeffe7deffe8deffe8deffe8dfffe8dfffe8deffe7deffe8e0fee7e3fee4e5fee9ecb9aef99ca0fe9da4fe9aa2fe99a1fe979ffe949dff909aff8a98ff8395ff",
	"97a4ff9ba7ffa1aaffa4acffa6adffa5adffa5acfeb3b7ff7e6ed1d1b5d1fff2e9fde6e1ffe8e1ffe8e0ffe8e0ffe8e1ffe8e1ffe8dffee7dff7dcdcffe8deffe7deffe7deffe7deffe8deffe8dfffe7defee7e0ffebe5f3d8da9e7ebab2a5f99ea0ff99a0ff969eff949cff939cff929bff919aff8e97fe8594ff7e90ff",
	"91a2ff97a4ff9ca7ffa1a8ffa2aaffa3aaffa4acffa5acfe8f8bebcab6edffede5fee6e3ffe8dfffe9e0ffe8e1ffe8e0ffe8e2ffe8dfffe8dfffebe2ffe8deffe7deffe6deffe9e0ffe9e3ffe8e0ffe8dffde6e1fff2e6d1b5cf553ea49793ffa69efaac9cf1b29dedb19decaf9beda99bf19594fd8690ff828fff788cff",
	"8c9cff93a0ff99a3ff9ca5ff9ea6ff9fa6ffa0a7ffa1a8ffa9aeffb3a8fbf6dde7ffeae4fee7e1ffe8dfffe8deffe8dfffe9e1ffe9e1ffe8e2ffe8e0ffe9deffe8deffeae0fee3ddfee2ddffe9e0ffe8e1fee8e1fde8e6b6a2fba082d2d3a5b8f3bcabfcbfa1ffc1a0ffc29fffc1a0fcc0a3edb7b3ad98e37889ff7286fe",
	"8799ff8d9cff929eff98a1ff9ba2ff9ca3ff9da4fe9ea5fe9fa5fda3a1fecbb6f5ffede5fde6e1fee7e0ffeadff8e0dcf4dbdafae3defde6e1ffe8dffde6ddfce6dff8e1dfefbac4f7c4c6fee5defde6e1fff1e6e7c7dad8a8b6ffc89affc991ffc792ffc693ffc694ffc792ffc692fec595ffcb96e7b3be7783ff6b82fe",
	"8194ff8698ff8d9aff929dff989efe979fff949eff959fff97a0ffa3a8ff8c83e9c3a7d2fff5ebfee7e0ffe7e0ffe8dffde5e0fae2defde6e0ffe8e2fae2dcfbe3ddfce4dff9d5d2fbd7d4fde3defff6e9d8becdce9792ffce8dfec790fec692fec591ffc590fec58fffc590ffc690fdc591fec896dfaec0717eff667efe",
	"7a8fff8092ff8695ff8e98ff8f98ff9c9afab5a2e6c7a5d4d0a2c7d3a0bcc289a8c7879fd1aebffeece6ffe9e1fee7deffe9e1ffeae2ffe8e1ffe8e0ffe9dfffe9deffe8dfffe8e0ffeae2fff1e5d3b9c7ae728cc18189eba692f2b190fcbf8fffc78fffc690ffc891ffc690fdc290fdc392ffc994c8a1cd6576ff6177fe",
	"748bff7a8dff8190fe8490ffab9cebebadb1e2979dd18695cf8091cc7d8cce808dcd808a784c82cba6c1fdeae3ffebe1fee6dfffe8e0ffe8e1ffe8deffe7defee6defee6ddffece1fce7e1deb8cc6d4d88bc7988d3878ccb7e89d2828ad98c8de89f8df4b38ee69f8ddc8f8cd5878beaa591ffcb9aa58ee25d70ff5a6ffe",
	"6e86ff7288ff7c8bfe7d89ffd3a9c9ffc398f1b397ebaf92e8a991e2a08fdc958dcb858cb87387c687acdaadcbf6dbdaffeee1ffe8dfffe7e0ffe7ddffe6ddffeae0ffede1f2d5d9dbabc8ce93b7a66f8bb9788acb818ad18789d99289de978ce29b8ceeab8deeac8dd18589ca798aeea790fcc3a67d78f6566bff5067fe",
	"6981ff6d82ff7586fe7884ffcaa3ccffc996ffc893ffca90ffc990ffc990ffc78ffcc18ff1b08cda9e9ed29bbcd09cc4e7c5d5fbe7e5ffebe6ffece4ffede1f6dddde1bad0d09ac3d29bc5ca92b5cc8189d68e8aeaaa8dfac090ffc690ffc88fffca90ffc690ffcd90dd978cd5888affc692daabbf5e67ff5065fe435dff",
	"647bff687dff6f81fe7281ffb499deffc798fdc491fec48ffec48ffec48fffc58fffc68fffc990ffc78df7bc92eaaf9fe4a79fedbbaaf9d3bef2d1ccdcb2cad39cc1d59bb4dfa6abe8aea0efb495f4b78ffec390ffca90ffc790ffc58ffec48ffec48fffc58ffbc18ee29a8cf8ba92ffcd95b894d04b5dff465bfe3955ff",
	"6076ff6178ff697cfe6d7bff8f83f6fcc19effc690ffc590ffc58fffc58fffc58fffc58ffec48fffc48fffc78effc88cffc88cffc48afec28bf9be8debad97ecac99f9be8effc48cffcb8effcd8effcc90ffc78ffec48fffc48fffc58fffc58fffc48fffc690f7ba8efdc18efec793ffca94ae8dd33f53ff3c53fe3852ff",
	"5d72ff5e74fe5f74ff8782f0d69db7edad98ffc98ffec58fffc58fffc58fffc58fffc58fffc58fffc58fffc58ffec490fec490ffc590ffc690ffc78fffc98effc68dfabf8eeaa88de1988ee39a8ce89f8bf2ae8efdc290ffc590ffc58fffc58fffc68ffdc390fabe8dffc78ffcc393ffcb96a586d6354bff3d52fe3f56ff",
	"596dff5c6ffe576bffb495d4ffc394e8a794fcc290ffc590ffc58fffc58fffc58fffc58fffc58fffc58fffc58fffc58fffc58fffc58fffc58fffc48ffec48fffc58fffc78ffdc38ff0af8ce7a38cf0ac8cfbbd8dffc590ffc58fffc58fffc48fffc78ff4b38ff5b38ffcc290fdc494ffc99a8f78e0354bff4157fe4258ff",
];

const CHIBI_DARK_RGB = { r: 24, g: 27, b: 40 };
const CHIBI_LIGHT_RGB = { r: 214, g: 220, b: 238 };
const CHIBI_LINE_BASE_RGB = { r: 42, g: 47, b: 68 };
const CHIBI_LINE_INK_RGB = { r: 202, g: 211, b: 242 };
const CHIBI_CONTRAST_GAMMA = 1.35;

interface RgbColorTriplet {
	r: number;
	g: number;
	b: number;
}

function makeRgbPixel(r: number, g: number, b: number): RgbPixel {
	const cr = Math.max(0, Math.min(255, Math.round(r)));
	const cg = Math.max(0, Math.min(255, Math.round(g)));
	const cb = Math.max(0, Math.min(255, Math.round(b)));
	const key = `${cr.toString(16).padStart(2, "0")}${cg.toString(16).padStart(2, "0")}${cb.toString(16).padStart(2, "0")}`;
	return { key, r: cr, g: cg, b: cb };
}

function lerpRgbPixel(dark: RgbColorTriplet, light: RgbColorTriplet, t: number): RgbPixel {
	const clamped = Math.max(0, Math.min(1, t));
	return makeRgbPixel(
		dark.r + (light.r - dark.r) * clamped,
		dark.g + (light.g - dark.g) * clamped,
		dark.b + (light.b - dark.b) * clamped,
	);
}

function parseHexPixel(rowHex: string, col: number): RgbPixel {
	const offset = col * 6;
	const key = rowHex.slice(offset, offset + 6);
	const r = Number.parseInt(key.slice(0, 2), 16);
	const g = Number.parseInt(key.slice(2, 4), 16);
	const b = Number.parseInt(key.slice(4, 6), 16);
	return { key, r, g, b };
}

function parseHexGrid(hexRows: readonly string[]): RgbPixel[][] {
	const width = hexRows[0]?.length ? hexRows[0].length / 6 : 0;
	return hexRows.map((rowHex) => {
		const row: RgbPixel[] = [];
		for (let col = 0; col < width; col++) {
			row.push(parseHexPixel(rowHex, col));
		}
		return row;
	});
}

function decodeBrailleDotGrid(brailleRows: readonly string[]): number[][] {
	const rowCount = brailleRows.length;
	const colCount = brailleRows[0] ? [...brailleRows[0]].length : 0;
	const grid: number[][] = Array.from({ length: rowCount * 4 }, () => Array<number>(colCount * 2).fill(0));

	for (let r = 0; r < rowCount; r++) {
		const chars = [...brailleRows[r]];
		for (let c = 0; c < chars.length; c++) {
			const code = chars[c].codePointAt(0) ?? 0x2800;
			const bits = code >= 0x2800 && code <= 0x28ff ? code - 0x2800 : 0;
			for (let dy = 0; dy < 4; dy++) {
				for (let dx = 0; dx < 2; dx++) {
					grid[r * 4 + dy][c * 2 + dx] = bits & BRAILLE_DOT_BITS[dy][dx] ? 1 : 0;
				}
			}
		}
	}

	return grid;
}

/**
 * Seals 1px outline gaps before flood-filling from image borders so the outer
 * background separates cleanly without leaking into the face or hair.
 */
function computeOuterBgMask(dotGrid: readonly (readonly number[])[]): boolean[][] {
	const height = dotGrid.length;
	const width = dotGrid[0]?.length ?? 0;

	const dilatedDark: number[][] = Array.from({ length: height }, () => Array<number>(width).fill(1));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let hasDark = false;
			for (let dy = -1; dy <= 1 && !hasDark; dy++) {
				for (let dx = -1; dx <= 1 && !hasDark; dx++) {
					const ny = y + dy;
					const nx = x + dx;
					if (ny >= 0 && ny < height && nx >= 0 && nx < width && dotGrid[ny][nx] === 0) {
						hasDark = true;
					}
				}
			}
			dilatedDark[y][x] = hasDark ? 0 : 1;
		}
	}

	const outerSeeded: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
	const queue: [number, number][] = [];
	const pushIfOpen = (y: number, x: number) => {
		if (!outerSeeded[y][x] && dilatedDark[y][x] === 1) {
			outerSeeded[y][x] = true;
			queue.push([y, x]);
		}
	};

	for (let x = 0; x < width; x++) {
		pushIfOpen(0, x);
		pushIfOpen(height - 1, x);
	}
	for (let y = 0; y < height; y++) {
		pushIfOpen(y, 0);
		pushIfOpen(y, width - 1);
	}

	let head = 0;
	while (head < queue.length) {
		const [y, x] = queue[head++];
		if (y > 0) pushIfOpen(y - 1, x);
		if (y + 1 < height) pushIfOpen(y + 1, x);
		if (x > 0) pushIfOpen(y, x - 1);
		if (x + 1 < width) pushIfOpen(y, x + 1);
	}

	const outerBg: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (dotGrid[y][x] === 0) continue;
			const touchesOuter =
				outerSeeded[y][x] ||
				(y > 0 && outerSeeded[y - 1][x]) ||
				(y + 1 < height && outerSeeded[y + 1][x]) ||
				(x > 0 && outerSeeded[y][x - 1]) ||
				(x + 1 < width && outerSeeded[y][x + 1]);
			outerBg[y][x] = touchesOuter;
		}
	}

	return outerBg;
}

function sampleBoxCell(
	dotGrid: readonly (readonly number[])[],
	outerBg: readonly (readonly boolean[])[] | null,
	dstW: number,
	dstH: number,
	dx: number,
	dy: number,
): { totalArea: number; fgArea: number; fgLightSum: number; allLightSum: number } {
	const srcH = dotGrid.length;
	const srcW = dotGrid[0]?.length ?? 0;
	const sy0 = (dy * srcH) / dstH;
	const sy1 = ((dy + 1) * srcH) / dstH;
	const sx0 = (dx * srcW) / dstW;
	const sx1 = ((dx + 1) * srcW) / dstW;
	const yStart = Math.floor(sy0);
	const yEnd = Math.min(srcH - 1, Math.ceil(sy1) - 1);
	const xStart = Math.floor(sx0);
	const xEnd = Math.min(srcW - 1, Math.ceil(sx1) - 1);

	let totalArea = 0;
	let fgArea = 0;
	let fgLightSum = 0;
	let allLightSum = 0;

	for (let sy = yStart; sy <= yEnd; sy++) {
		const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy);
		if (wy <= 0) continue;
		for (let sx = xStart; sx <= xEnd; sx++) {
			const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx);
			if (wx <= 0) continue;
			const area = wx * wy;
			const val = dotGrid[sy][sx];
			totalArea += area;
			allLightSum += val * area;
			if (!outerBg?.[sy][sx]) {
				fgArea += area;
				fgLightSum += val * area;
			}
		}
	}

	return { totalArea, fgArea, fgLightSum, allLightSum };
}

function buildChibiCutoutGrid(cols: number, rows: number): PixelCell[][] {
	const dotGrid = decodeBrailleDotGrid(CHIBI_BRAILLE_ROWS);
	const outerBg = computeOuterBgMask(dotGrid);
	const dstH = rows * 2;
	const out: PixelCell[][] = [];

	for (let dy = 0; dy < dstH; dy++) {
		const row: PixelCell[] = [];
		for (let dx = 0; dx < cols; dx++) {
			const { totalArea, fgArea, fgLightSum } = sampleBoxCell(dotGrid, outerBg, cols, dstH, dx, dy);
			const alpha = totalArea > 0 ? fgArea / totalArea : 0;
			if (alpha < 0.35 || fgArea <= 0) {
				row.push(null);
				continue;
			}
			const coverage = fgLightSum / fgArea;
			const curved = coverage > 0 && coverage < 1 ? Math.pow(coverage, CHIBI_CONTRAST_GAMMA) : coverage;
			row.push(lerpRgbPixel(CHIBI_DARK_RGB, CHIBI_LIGHT_RGB, curved));
		}
		out.push(row);
	}

	return out;
}

function buildChibiLineGrid(cols: number, rows: number): PixelCell[][] {
	const dotGrid = decodeBrailleDotGrid(CHIBI_BRAILLE_ROWS);
	const dstH = rows * 2;
	const out: PixelCell[][] = [];

	for (let dy = 0; dy < dstH; dy++) {
		const row: PixelCell[] = [];
		for (let dx = 0; dx < cols; dx++) {
			const { totalArea, allLightSum } = sampleBoxCell(dotGrid, null, cols, dstH, dx, dy);
			const whiteCov = totalArea > 0 ? allLightSum / totalArea : 1;
			const darkCov = 1 - whiteCov;
			if (darkCov < 0.25) {
				row.push(null);
				continue;
			}
			const tone = (darkCov - 0.25) / 0.75;
			row.push(lerpRgbPixel(CHIBI_LINE_BASE_RGB, CHIBI_LINE_INK_RGB, tone));
		}
		out.push(row);
	}

	return out;
}

function renderHalfBlockLines(pixels: readonly (readonly PixelCell[])[], mode: TerminalColorMode): string[] {
	const lines: string[] = [];
	const width = pixels[0]?.length ?? 0;

	for (let row = 0; row < pixels.length; row += 2) {
		const topRow = pixels[row];
		const botRow = pixels[row + 1] ?? topRow;
		let out = "";
		let prevFgKey = "";
		let prevBgKey = "";

		const clearBg = () => {
			if (prevBgKey !== "") {
				out += DEFAULT_BG;
				prevBgKey = "";
			}
		};
		const setFg = (pixel: RgbPixel) => {
			if (prevFgKey !== pixel.key) {
				out += foregroundAnsi(rgbColor(pixel.r, pixel.g, pixel.b), mode);
				prevFgKey = pixel.key;
			}
		};
		const setBg = (pixel: RgbPixel) => {
			if (prevBgKey !== pixel.key) {
				out += backgroundAnsi(rgbColor(pixel.r, pixel.g, pixel.b), mode);
				prevBgKey = pixel.key;
			}
		};

		for (let col = 0; col < width; col++) {
			const top = topRow[col];
			const bot = botRow[col];
			if (!top && !bot) {
				clearBg();
				out += " ";
			} else if (top && !bot) {
				clearBg();
				setFg(top);
				out += "▀";
			} else if (!top && bot) {
				clearBg();
				setFg(bot);
				out += "▄";
			} else if (top && bot) {
				setFg(top);
				setBg(bot);
				out += "▀";
			}
		}

		lines.push(prevFgKey !== "" || prevBgKey !== "" ? `${out}${RESET}` : out);
	}

	return lines;
}

const PI_WORDMARK_WIDTH = 13;

// 13x10 pixel art for lowercase "pi" rendered as 13x5 white half-blocks.
const PI_WORDMARK_ROWS: readonly string[] = [
	"          mm ",
	"          mm ",
	"             ",
	" cccccc   cc ",
	" ss   ss  ss ",
	" bb   bb  bb ",
	" bbbbbbb  bb ",
	" vvvvvv   vv ",
	" pp          ",
	" pp          ",
];

const PI_WHITE_RGB: RgbColorTriplet = CHIBI_LIGHT_RGB;

const WHITE_LOGO_PALETTE: Record<string, RgbColorTriplet> = {
	c: PI_WHITE_RGB,
	s: PI_WHITE_RGB,
	b: PI_WHITE_RGB,
	v: PI_WHITE_RGB,
	p: PI_WHITE_RGB,
	m: PI_WHITE_RGB,
};

function parseCharPixelGrid(
	rows: readonly string[],
	palette: Readonly<Record<string, RgbColorTriplet>>,
): PixelCell[][] {
	return rows.map((row) =>
		[...row].map((ch) => {
			const rgb = palette[ch];
			return rgb ? makeRgbPixel(rgb.r, rgb.g, rgb.b) : null;
		}),
	);
}

const SUBARU_PIXEL_GRID = parseHexGrid(SUBARU_PIXEL_ROWS);
const CHIBI_34_CUTOUT_GRID = buildChibiCutoutGrid(34, 15);
const CHIBI_45_CUTOUT_GRID = buildChibiCutoutGrid(45, 20);
const CHIBI_68_CUTOUT_GRID = buildChibiCutoutGrid(68, 30);
const CHIBI_34_LINE_GRID = buildChibiLineGrid(34, 15);
const CHIBI_45_LINE_GRID = buildChibiLineGrid(45, 20);
const PI_WORDMARK_GRID = parseCharPixelGrid(PI_WORDMARK_ROWS, WHITE_LOGO_PALETTE);

const PRESET_SPECS: Record<
	HeaderPreset,
	{
		width: number;
		label: string;
		description: string;
		render: (theme: Theme, mode: TerminalColorMode) => string[];
	}
> = {
	chibi: {
		width: 34,
		label: "Chibi 34x15 (transparent cutout half-block)",
		description: "34x15 anti-aliased chibi cutout with transparent outer background",
		render: (_theme, mode) => renderHalfBlockLines(CHIBI_34_CUTOUT_GRID, mode),
	},
	chibi45: {
		width: 45,
		label: "Chibi 45x20 (transparent cutout half-block)",
		description: "45x20 anti-aliased chibi cutout with transparent outer background",
		render: (_theme, mode) => renderHalfBlockLines(CHIBI_45_CUTOUT_GRID, mode),
	},
	chibi68: {
		width: 68,
		label: "Chibi 68x30 (lossless cutout half-block)",
		description: "68x30 1:1 lossless chibi cutout with transparent outer background",
		render: (_theme, mode) => renderHalfBlockLines(CHIBI_68_CUTOUT_GRID, mode),
	},
	line: {
		width: 34,
		label: "Chibi 34x15 (line-art only, no white fill)",
		description: "34x15 transparent line-art only (all white background removed)",
		render: (_theme, mode) => renderHalfBlockLines(CHIBI_34_LINE_GRID, mode),
	},
	line45: {
		width: 45,
		label: "Chibi 45x20 (line-art only, no white fill)",
		description: "45x20 transparent line-art only (all white background removed)",
		render: (_theme, mode) => renderHalfBlockLines(CHIBI_45_LINE_GRID, mode),
	},
	pi: {
		width: PI_WORDMARK_WIDTH,
		label: "Pi 13x5 (white half-block wordmark)",
		description: "13x5 white half-block lowercase pi wordmark",
		render: (_theme, mode) => renderHalfBlockLines(PI_WORDMARK_GRID, mode),
	},
	braille: {
		width: 34,
		label: "Chibi 34x15 (original Braille)",
		description: "34x15 Braille art with ASCII spaces for U+2800",
		render: (theme) => CHIBI_BRAILLE_ROWS.map((row) => theme.fg("text", row.replaceAll("\u2800", " "))),
	},
	subaru: {
		width: 42,
		label: "Subaru 42x17 (half-block)",
		description: "42x17 Subaru half-block portrait",
		render: (_theme, mode) => renderHalfBlockLines(SUBARU_PIXEL_GRID, mode),
	},
};

function buildRightSideText(theme: Theme, expanded: boolean): string[] {
	const title = `${theme.fg("accent", "Pi")} ${theme.fg("dim", `v${VERSION}`)}`;

	if (!expanded) {
		const compactHints = [
			keyHint("app.interrupt", "interrupt"),
			rawKeyHint(`${keyText("app.clear")}/${keyText("app.exit")}`, "clear/exit"),
			rawKeyHint("/", "commands"),
			rawKeyHint("!", "bash"),
			keyHint("app.tools.expand", "more"),
		].join(theme.fg("muted", " · "));

		const expandNotice = theme.fg(
			"dim",
			`Press ${keyText("app.tools.expand")} to show full startup help.`,
		);

		return [title, compactHints, expandNotice];
	}

	const expandedHints = [
		keyHint("app.interrupt", "to interrupt"),
		keyHint("app.clear", "to clear"),
		rawKeyHint(`${keyText("app.clear")} twice`, "to exit"),
		keyHint("app.exit", "to exit (empty)"),
		keyHint("app.suspend", "to suspend"),
		keyHint("tui.editor.deleteToLineEnd", "to delete to end"),
		keyHint("app.thinking.cycle", "to cycle thinking level"),
		rawKeyHint(
			`${keyText("app.model.cycleForward")}/${keyText("app.model.cycleBackward")}`,
			"to cycle models",
		),
		keyHint("app.model.select", "to select model"),
		keyHint("app.tools.expand", "to expand tools"),
		keyHint("app.thinking.toggle", "to expand thinking"),
		keyHint("app.editor.external", "for external editor"),
		rawKeyHint("/", "for commands"),
		rawKeyHint("!", "to run bash"),
		rawKeyHint("!!", "to run bash (no context)"),
		keyHint("app.message.followUp", "to queue follow-up"),
		keyHint("app.message.dequeue", "to edit all queued messages"),
		keyHint("app.clipboard.pasteImage", "to paste files on macOS, images, or text"),
		rawKeyHint("drop files", "to attach"),
	];

	return [title, ...expandedHints];
}

function wrapLogicalLines(lines: string[], maxWidth: number): string[] {
	const safeWidth = Math.max(1, maxWidth);
	const wrapped: string[] = [];
	for (const line of lines) {
		if (line === "") {
			wrapped.push("");
		} else {
			wrapped.push(...wrapTextWithAnsi(line, safeWidth));
		}
	}
	return wrapped;
}

function composeSideBySide(
	leftLines: readonly string[],
	leftPad: string,
	leftWidth: number,
	gap: string,
	rightLines: readonly string[],
	topOffset: number,
	maxWidth: number,
): string[] {
	const totalRows = Math.max(leftLines.length, topOffset + rightLines.length);
	const blankLeftPad = " ".repeat(leftPad.length + leftWidth);
	const output: string[] = [];

	for (let i = 0; i < totalRows; i++) {
		const leftPart = i < leftLines.length ? `${leftPad}${leftLines[i]}` : blankLeftPad;
		const rightIdx = i - topOffset;
		const rightPart = rightIdx >= 0 && rightIdx < rightLines.length ? rightLines[rightIdx] : "";
		const combined = rightPart ? `${leftPart}${gap}${rightPart}` : leftPart;
		output.push(truncateToWidth(combined, maxWidth));
	}

	return output;
}

function createCustomHeaderComponent(
	_tui: TUI,
	theme: Theme,
	preset: HeaderPreset,
	showLogo: boolean,
	showText: boolean,
	textPosition: TextPosition,
): Component & { setExpanded(expanded: boolean): void } {
	const spec = PRESET_SPECS[preset];
	const artWidth = spec.width;
	const hasSideLogo = showLogo && preset !== "pi";
	let expanded = false;
	let cachedWidth: number | undefined;
	let cachedExpanded: boolean | undefined;
	let cachedColorMode: TerminalColorMode | undefined;
	let cachedArtLines: string[] | undefined;
	let cachedLogoLines: string[] | undefined;
	let cachedLines: string[] | undefined;

	return {
		setExpanded(nextExpanded: boolean): void {
			if (expanded === nextExpanded) return;
			expanded = nextExpanded;
			cachedLines = undefined;
		},

		invalidate(): void {
			cachedWidth = undefined;
			cachedExpanded = undefined;
			cachedColorMode = undefined;
			cachedArtLines = undefined;
			cachedLogoLines = undefined;
			cachedLines = undefined;
		},

		render(width: number): string[] {
			const safeWidth = Math.max(1, width);
			const colorMode = theme.getColorMode();

			if (
				cachedLines &&
				cachedWidth === safeWidth &&
				cachedExpanded === expanded &&
				cachedColorMode === colorMode
			) {
				return cachedLines;
			}

			if (!cachedArtLines || cachedColorMode !== colorMode) {
				cachedArtLines = spec.render(theme, colorMode);
				cachedLogoLines = hasSideLogo ? renderHalfBlockLines(PI_WORDMARK_GRID, colorMode) : undefined;
			}

			const artLines = cachedArtLines;
			const logoLines = cachedLogoLines ?? [];
			const leftPad = safeWidth >= artWidth + 2 ? " " : "";
			const padLines = (lines: readonly string[]): string[] =>
				lines.map((line) => (line ? truncateToWidth(`${leftPad}${line}`, safeWidth) : ""));
			const gap = "  ";
			const leftBlockWidth = leftPad.length + artWidth + gap.length;
			const rightRawText = showText ? buildRightSideText(theme, expanded) : [];
			let output: string[];

			if (showText && textPosition === "side") {
				const rightMinWidth = Math.max(hasSideLogo ? PI_WORDMARK_WIDTH : 0, 28);
				const buildRightLines = (rightWidth: number): string[] => {
					const wrappedText = wrapLogicalLines(rightRawText, rightWidth);
					if (!hasSideLogo) return wrappedText;
					const clippedLogo = logoLines.map((line) => truncateToWidth(line, rightWidth));
					return [...clippedLogo, "", ...wrappedText];
				};

				if (safeWidth >= leftBlockWidth + rightMinWidth) {
					const rightWidth = safeWidth - leftBlockWidth;
					const rightLines = buildRightLines(rightWidth);
					const topOffset =
						!hasSideLogo && !expanded && rightLines.length < artLines.length
							? Math.floor((artLines.length - rightLines.length) / 2)
							: 0;
					output = composeSideBySide(artLines, leftPad, artWidth, gap, rightLines, topOffset, safeWidth);
				} else {
					const stackedRight = buildRightLines(Math.max(1, safeWidth - leftPad.length));
					output = [...padLines(artLines), "", ...padLines(stackedRight)];
				}
			} else {
				if (!hasSideLogo) {
					output = padLines(artLines);
				} else if (safeWidth >= leftBlockWidth + PI_WORDMARK_WIDTH) {
					const rightWidth = safeWidth - leftBlockWidth;
					const clippedLogo = logoLines.map((line) => truncateToWidth(line, rightWidth));
					output = composeSideBySide(artLines, leftPad, artWidth, gap, clippedLogo, 0, safeWidth);
				} else {
					output = [...padLines(artLines), "", ...padLines(logoLines)];
				}

				if (showText) {
					const bottomText = wrapLogicalLines(rightRawText, Math.max(1, safeWidth - leftPad.length));
					output = [...output, "", ...padLines(bottomText)];
				}
			}

			cachedWidth = safeWidth;
			cachedExpanded = expanded;
			cachedColorMode = colorMode;
			cachedLines = output;
			return output;
		},

		handleMouse() {
			return undefined;
		},
	};
}

export default function (pi: ExtensionAPI) {
	let activePreset: HeaderPreset = "chibi";
	let showLogo = true;
	let showText = true;
	let textPosition: TextPosition = "below";
	let useBuiltin = false;

	const applyHeader = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		if (useBuiltin) {
			ctx.ui.setHeader(undefined);
			return;
		}
		const preset = activePreset;
		const withLogo = showLogo;
		const withText = showText;
		const position = textPosition;
		ctx.ui.setHeader((tui, theme) =>
			createCustomHeaderComponent(tui, theme, preset, withLogo, withText, position),
		);
	};

	pi.on("session_start", async (_event, ctx) => {
		applyHeader(ctx);
	});

	pi.registerCommand("header", {
		description: "Switch startup header preset, side pi logo, or description text",
		getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
			const choices: AutocompleteItem[] = [
				...Object.entries(PRESET_SPECS).map(([value, spec]) => ({
					value,
					label: value,
					description: spec.description,
				})),
				{ value: "logo", label: "logo", description: "Toggle 13x5 white pi logo on the right" },
				{ value: "logo on", label: "logo on", description: "Show 13x5 white pi logo on the right" },
				{ value: "logo off", label: "logo off", description: "Hide 13x5 white pi logo" },
				{ value: "text", label: "text", description: "Toggle Pi description and keybind text" },
				{ value: "text on", label: "text on", description: "Show Pi description and keybind text" },
				{ value: "text off", label: "text off", description: "Hide Pi description and keybind text" },
				{ value: "text below", label: "text below", description: "Place description text below the header" },
				{ value: "text side", label: "text side", description: "Place description text on the right side" },
				{ value: "builtin", label: "builtin", description: "Restore built-in Pi header" },
			];
			const needle = prefix.trim().toLowerCase();
			const filtered = choices.filter((c) => c.value.startsWith(needle));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/header is only available in interactive mode", "error");
				return;
			}
			const arg = args.trim().toLowerCase();
			if (arg === "builtin" || arg === "default") {
				useBuiltin = true;
			} else if (arg === "custom") {
				useBuiltin = false;
			} else if (arg === "logo") {
				showLogo = !showLogo;
				useBuiltin = false;
			} else if (arg === "logo on") {
				showLogo = true;
				useBuiltin = false;
			} else if (arg === "logo off") {
				showLogo = false;
				useBuiltin = false;
			} else if (arg === "text") {
				showText = !showText;
				useBuiltin = false;
			} else if (arg === "text on") {
				showText = true;
				useBuiltin = false;
			} else if (arg === "text off") {
				showText = false;
				useBuiltin = false;
			} else if (arg === "text below") {
				textPosition = "below";
				showText = true;
				useBuiltin = false;
			} else if (arg === "text side") {
				textPosition = "side";
				showText = true;
				useBuiltin = false;
			} else if (arg in PRESET_SPECS) {
				activePreset = arg as HeaderPreset;
				useBuiltin = false;
			} else if (arg === "") {
				useBuiltin = !useBuiltin;
			} else {
				ctx.ui.notify(
					"Usage: /header [chibi|chibi45|chibi68|line|line45|pi|braille|subaru|logo [on|off]|text [on|off|below|side]|builtin]",
					"warning",
				);
				return;
			}

			applyHeader(ctx);
			if (useBuiltin) {
				ctx.ui.notify("Restored built-in Pi header", "info");
			} else if (arg === "logo" || arg === "logo on" || arg === "logo off") {
				ctx.ui.notify(`Side pi logo ${showLogo ? "shown" : "hidden"}`, "info");
			} else if (arg.startsWith("text")) {
				ctx.ui.notify(
					showText ? `Header text shown (${textPosition})` : "Header text hidden",
					"info",
				);
			} else {
				ctx.ui.notify(
					`Switched header to ${PRESET_SPECS[activePreset].label} (logo ${showLogo ? "on" : "off"}, text ${showText ? textPosition : "off"})`,
					"info",
				);
			}
		},
	});
}
