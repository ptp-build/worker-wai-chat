export function generateRandomString(length: number) {
	let result = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

export function sha1(str: string): string {
	function utf8_encode(str: string): string {
		str = str.replace(/\r\n/g, '\n');
		let utf8str = '';
		for (let n = 0; n < str.length; n++) {
			let c = str.charCodeAt(n);
			if (c < 128) {
				utf8str += String.fromCharCode(c);
			} else if (c > 127 && c < 2048) {
				utf8str += String.fromCharCode((c >> 6) | 192);
				utf8str += String.fromCharCode((c & 63) | 128);
			} else {
				utf8str += String.fromCharCode((c >> 12) | 224);
				utf8str += String.fromCharCode(((c >> 6) & 63) | 128);
				utf8str += String.fromCharCode((c & 63) | 128);
			}
		}
		return utf8str;
	}

	function rotate_left(n: number, s: number): number {
		return (n << s) | (n >>> (32 - s));
	}

	function cvt_hex(val: number): string {
		let str = '';
		let i;
		let v;
		for (i = 7; i >= 0; i--) {
			v = (val >>> (i * 4)) & 0x0f;
			str += v.toString(16);
		}
		return str;
	}

	let blockstart;

	let i: number, j: number;

	let W = new Array(80);

	let H0 = 0x67452301;
	let H1 = 0xefcdab89;
	let H2 = 0x98badcfe;
	let H3 = 0x10325476;
	let H4 = 0xc3d2e1f0;

	let A, B, C, D, E;

	let temp;

	str = utf8_encode(str);

	let len = str.length * 8;

	let K = new Array(0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6);

	let str_len = str.length;

	let word_array = new Array();

	for (i = 0; i < str_len - 3; i += 4) {
		j =
			(str.charCodeAt(i) << 24) |
			(str.charCodeAt(i + 1) << 16) |
			(str.charCodeAt(i + 2) << 8) |
			str.charCodeAt(i + 3);
		word_array.push(j);
	}

	switch (str_len % 4) {
		case 0:
			i = 0x080000000;
			break;
		case 1:
			i = (str.charCodeAt(str_len - 1) << 24) | 0x0800000;
			break;

		case 2:
			i = (str.charCodeAt(str_len - 2) << 24) | (str.charCodeAt(str_len - 1) << 16) | 0x08000;
			break;

		case 3:
			i =
				(str.charCodeAt(str_len - 3) << 24) |
				(str.charCodeAt(str_len - 2) << 16) |
				(str.charCodeAt(str_len - 1) << 8) |
				0x80;
			break;
	}

	word_array.push(i);

	while (word_array.length % 16 != 14) word_array.push(0);

	word_array.push(len >>> 32);
	word_array.push(len & 0xffffffff);

	for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
		for (i = 0; i < 16; i++) W[i] = word_array[blockstart + i];
		for (i = 16; i < 80; i++)
			W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

		A = H0;
		B = H1;
		C = H2;
		D = H3;
		E = H4;

		for (i = 0; i < 20; i++) {
			temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + K[0]) & 0xffffffff;
			E = D;
			D = C;
			C = rotate_left(B, 30);
			B = A;
			A = temp;
		}

		for (i = 20; i < 40; i++) {
			temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + K[1]) & 0xffffffff;
			E = D;
			D = C;
			C = rotate_left(B, 30);
			B = A;
			A = temp;
		}

		for (i = 40; i < 60; i++) {
			temp =
				(rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + K[2]) & 0xffffffff;
			E = D;
			D = C;
			C = rotate_left(B, 30);
			B = A;
			A = temp;
		}

		for (i = 60; i < 80; i++) {
			temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + K[3]) & 0xffffffff;
			E = D;
			D = C;
			C = rotate_left(B, 30);
			B = A;
			A = temp;
		}

		H0 = (H0 + A) & 0xffffffff;
		H1 = (H1 + B) & 0xffffffff;
		H2 = (H2 + C) & 0xffffffff;
		H3 = (H3 + D) & 0xffffffff;
		H4 = (H4 + E) & 0xffffffff;
	}

	let result = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
	return result.toLowerCase();
}

export function replaceSubstring(text: string, offset: number, length: number, replace: string) {
	const prefix = text.substring(0, offset);
	const suffix = text.substring(offset + length);
	return prefix + replace + suffix;
}

export const isEmailValid = (email: string) => {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
};

export const getPasswordFromEvent = async (hint?: string, hideHitInput?: boolean) => {
	return new Promise<{ password: string; hint?: string }>(resolve => {
		const event = new CustomEvent('password', {
			detail: {
				hint,
				hideHitInput,
				callback: ({ password, hint }: { password: string; hint?: string }) => {
					resolve({ password, hint });
				},
			},
		});
		document.dispatchEvent(event);
	});
};

export function parseQueryFromUrl(urlStr: string): { url: URL; query: Record<string, string> } {
	const replacedUrl = urlStr.replace(/#/g, '?');
	const url = new URL(replacedUrl);
	const query = Array.from(url.searchParams.entries()).reduce(
		(acc, [key, value]) => ({
			...acc,
			[key]: value,
		}),
		{}
	);

	return { url, query };
}

export function getCorsHeader(Access_Control_Allow_Origin: string = '*') {
	return {
		'content-type': 'application/json;charset=UTF-8',
		'Access-Control-Allow-Origin': Access_Control_Allow_Origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
		'Access-Control-Allow-Credentials': 'true',
	};
}
export function ResponseJson(result: object, status = 200) {
	return new Response(JSON.stringify(result), {
		status,
		headers: {
			...getCorsHeader(),
		},
	});
}
